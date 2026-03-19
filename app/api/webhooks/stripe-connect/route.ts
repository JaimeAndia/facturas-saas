import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { render } from '@react-email/components'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { registrarEventoBlockchain } from '@/lib/blockchain-event'
import { recordXrplEvent } from '@/lib/xrpl-events'
import { settlePayment } from '@/lib/xrpl-settlement'
import { FacturaPDF } from '@/components/facturas/FacturaPDF'
import { FacturaEmail } from '@/emails/FacturaEmail'
import { formatDate } from '@/lib/utils'
import type Stripe from 'stripe'
import type { LineaFactura, Cliente } from '@/types'

// Webhook exclusivo para eventos de cuentas Express (Stripe Connect).
// Signing secret: STRIPE_CONNECT_WEBHOOK_SECRET (distinto al del webhook principal).
// Configurado en Stripe Dashboard → Webhooks → stripe-connect → "Events on connected accounts".
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sin firma' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_CONNECT_WEBHOOK_SECRET no configurado')
    return NextResponse.json({ error: 'Error de configuración' }, { status: 500 })
  }

  let evento: Stripe.Event
  try {
    evento = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[Connect webhook] Firma inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  try {
    switch (evento.type) {

      // ─── checkout.session.completed ───────────────────────────────────────
      // Dos casos:
      //  A) Pago único de factura (mode: payment + invoice_id en metadata)
      //  B) Setup de cobro automático recurrente (mode: subscription + recurrente_id)
      case 'checkout.session.completed': {
        const session = evento.data.object as Stripe.Checkout.Session
        console.log('[Connect] checkout.session.completed', {
          mode: session.mode,
          metadata: session.metadata,
          payment_status: session.payment_status,
          subscription: session.subscription,
        })

        // ─ A) Pago único de factura ──────────────────────────────────────────
        if (session.mode === 'payment' &&
            session.metadata?.invoice_id &&
            session.payment_status === 'paid') {
          const invoiceId = session.metadata.invoice_id
          const paidAt    = new Date().toISOString()
          const amountEur = (session.amount_total ?? 0) / 100

          // Marcar factura como pagada
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('facturas') as any)
            .update({ estado: 'pagada', paid_at: paidAt })
            .eq('id', invoiceId)

          // Registrar en payment_logs con settlement XRPL pendiente — guardar id para actualizar después
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: logRow } = await (supabase.from('payment_logs') as any).insert({
            invoice_id:             invoiceId,
            event_type:             'checkout.session.completed',
            provider:               'stripe_connect',
            provider_event_id:      session.id,
            amount:                 amountEur,
            status:                 'succeeded',
            raw_payload:            evento.data.object,
            xrpl_settlement_status: 'pending',
          }).select('id').single() as { data: { id: string } | null }

          // Obtener user_id + datos XRPL del perfil
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: facturaRow } = await (supabase.from('facturas') as any)
            .select('user_id, total, blockchain_hash, profiles!facturas_user_id_fkey(plan, xrpl_addon, xrpl_address)')
            .eq('id', invoiceId)
            .single() as {
              data: {
                user_id: string
                total: number
                blockchain_hash: string | null
                profiles: { plan: string; xrpl_addon: boolean | null; xrpl_address: string | null } | null
              } | null
            }

          if (facturaRow?.user_id) {
            const perfil = facturaRow.profiles
            const tieneXrpl = perfil?.plan === 'pro' || !!perfil?.xrpl_addon

            // blockchain_events (fire-and-forget)
            registrarEventoBlockchain(invoiceId, facturaRow.user_id, 'pago').then(
              (res: { txHash: string } | null) => {
                if (res) console.log(`[Connect/Pago] Factura ${invoiceId}: ${res.txHash}`)
              }
            )

            // XRPL settlement → actualiza payment_logs.xrpl_settlement_status (fire-and-forget)
            if (tieneXrpl && logRow?.id) {
              const paymentLogId = logRow.id
              settlePayment({
                paymentLogId,
                invoiceId,
                amountEur:        facturaRow.total ?? amountEur,
                userId:           facturaRow.user_id,
                userXrplAddress:  perfil?.xrpl_address ?? undefined,
                invoiceHash:      facturaRow.blockchain_hash ?? undefined,
              }).then(async (txHash) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (supabase.from('payment_logs') as any)
                  .update(txHash
                    ? { xrpl_settlement_status: 'settled', xrpl_settlement_tx: txHash, xrpl_settled_at: new Date().toISOString() }
                    : { xrpl_settlement_status: 'failed' }
                  )
                  .eq('id', paymentLogId)
                console.log(`[Connect/XRPL] ${invoiceId}: ${txHash ?? 'failed'}`)
              }).catch((err) => {
                console.error('[Connect/XRPL] settlePayment error:', err)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ;(supabase.from('payment_logs') as any)
                  .update({ xrpl_settlement_status: 'failed' })
                  .eq('id', paymentLogId)
                  .then(() => {})
              })
            } else if (logRow?.id && !tieneXrpl) {
              // Sin acceso XRPL → marcar como not_applicable
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ;(supabase.from('payment_logs') as any)
                .update({ xrpl_settlement_status: 'not_applicable' })
                .eq('id', logRow.id)
                .then(() => {})
            }

          }
          break
        }

        // ─ B) Setup de cobro automático recurrente ───────────────────────────
        if (session.mode !== 'subscription' || !session.metadata?.recurrente_id) break

        const recurrenteId      = session.metadata.recurrente_id
        const stripeSubscriptionId = session.subscription as string
        const stripeCustomerId  = session.customer as string

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: recActivada } = await (supabase.from('facturas_recurrentes') as any)
          .update({
            stripe_subscription_id: stripeSubscriptionId,
            stripe_customer_id:     stripeCustomerId,
            cobro_automatico:       true,
            cobro_status:           'active',
            setup_url:              null,
          })
          .eq('id', recurrenteId)
          .select(`
            user_id, frecuencia,
            facturas!factura_base_id ( total, clientes ( nombre ) )
          `)
          .single() as {
            data: {
              user_id: string
              frecuencia: string
              facturas: { total: number; clientes: { nombre: string } | null } | null
            } | null
          }

        // XRPL: subscription_created (fire-and-forget)
        if (recActivada?.user_id) {
          recordXrplEvent({
            userId:    recActivada.user_id,
            eventType: 'subscription_created',
            payload: {
              interval:   recActivada.frecuencia,
              amount:     recActivada.facturas?.total ?? 0,
              currency:   'EUR',
              clientName: recActivada.facturas?.clientes?.nombre ?? 'Desconocido',
              provider:   'stripe_connect',
            },
          }).catch(() => {})
        }
        break
      }

      // ─── invoice.payment_succeeded ────────────────────────────────────────
      // Stripe ha cobrado al cliente → generar factura en estado 'pagada' y enviar email.
      case 'invoice.payment_succeeded': {
        const inv = evento.data.object as Stripe.Invoice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripeSubscriptionId = (inv as any).subscription as string | null
        if (!stripeSubscriptionId) break

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: recurrente } = await (supabase as any)
          .from('facturas_recurrentes')
          .select(`
            id, user_id, frecuencia,
            profiles!inner (
              nombre, apellidos, email, nif, telefono,
              direccion, ciudad, codigo_postal, provincia,
              logo_url, plan, xrpl_addon, xrpl_address,
              stripe_account_id
            ),
            facturas!factura_base_id (
              id, numero, estado, base_imponible, iva_porcentaje, iva_importe,
              irpf_porcentaje, irpf_importe, total, notas, cliente_id,
              clientes ( id, nombre, email, nif, direccion, ciudad, codigo_postal, provincia, pais ),
              lineas_factura ( descripcion, cantidad, precio_unitario, subtotal, orden )
            )
          `)
          .eq('stripe_subscription_id', stripeSubscriptionId)
          .single() as {
            data: {
              id: string
              user_id: string
              frecuencia: string
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              profiles: any
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              facturas: any
            } | null
          }

        if (!recurrente) {
          console.warn(`[Connect] No se encontró recurrente para suscripción ${stripeSubscriptionId}`)
          break
        }

        const perfil   = recurrente.profiles
        const original = recurrente.facturas
        const cliente  = original.clientes as Cliente
        const hoy      = new Date().toISOString().split('T')[0]

        // ── Determinar si reusar la primera factura generada (primer pago pendiente) ──
        // La primera factura real (factura_recurrente_id = recurrente.id) puede estar
        // sin pagar si el cliente activó el cobro automático antes de pagar manualmente.
        // En ese caso, marcarla como pagada en lugar de generar un duplicado.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: primeraGenerada } = await (supabase as any)
          .from('facturas')
          .select('id, numero')
          .eq('factura_recurrente_id', recurrente.id)
          .not('estado', 'in', '(pagada,cancelada)')
          .order('fecha_emision', { ascending: true })
          .limit(1)
          .maybeSingle() as { data: { id: string; numero: string } | null }

        let nuevaFactura: { id: string; numero: string }

        if (primeraGenerada) {
          // Primer cobro: marcar la factura pendiente existente como pagada
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('facturas')
            .update({
              estado:            'pagada',
              paid_at:           new Date().toISOString(),
              fecha_envio:       new Date().toISOString(),
              stripe_invoice_id: inv.id,
            })
            .eq('id', primeraGenerada.id)
          nuevaFactura = primeraGenerada
        } else {
          // No hay factura sin pagar. Comprobar si es el primer cobro de la suscripción
          // y si activar-cobro ya la marcó como pagada (sin stripe_invoice_id aún).
          // Si es así, solo enlazar el stripe_invoice_id y salir para evitar duplicados.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const billingReason = (inv as any).billing_reason as string | undefined
          if (billingReason === 'subscription_create') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: prePagada } = await (supabase as any)
              .from('facturas')
              .select('id')
              .eq('factura_recurrente_id', recurrente.id)
              .eq('estado', 'pagada')
              .is('stripe_invoice_id', null)
              .order('fecha_emision', { ascending: true })
              .limit(1)
              .maybeSingle() as { data: { id: string } | null }

            if (prePagada) {
              // La factura ya fue pagada por activar-cobro — solo enlazar el ID de Stripe
              // El evento blockchain ya fue registrado por activar-cobro o success/page
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase as any)
                .from('facturas')
                .update({ stripe_invoice_id: inv.id })
                .eq('id', prePagada.id)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase.from('facturas_recurrentes') as any)
                .update({ ultima_generacion: new Date().toISOString() })
                .eq('id', recurrente.id)
              console.log(`[Connect] Primera factura ya pagada por activar-cobro — enlazando ${inv.id}`)
              break
            }
          }

          // Ciclos siguientes (o primer ciclo sin factura previa): generar factura nueva
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: nuevoNumero } = await (supabase.rpc as any)(
            'fn_generar_numero_factura',
            { p_user_id: recurrente.user_id }
          ) as { data: string | null }

          if (!nuevoNumero) {
            console.error(`[Connect] Error generando número para recurrente ${recurrente.id}`)
            break
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: facturaCreada, error: errFactura } = await (supabase as any)
            .from('facturas')
            .insert({
              user_id:               recurrente.user_id,
              cliente_id:            original.cliente_id,
              numero:                nuevoNumero,
              fecha_emision:         hoy,
              estado:                'pagada',
              base_imponible:        original.base_imponible,
              iva_porcentaje:        original.iva_porcentaje,
              iva_importe:           original.iva_importe,
              irpf_porcentaje:       original.irpf_porcentaje,
              irpf_importe:          original.irpf_importe,
              total:                 original.total,
              notas:                 original.notas,
              paid_at:               new Date().toISOString(),
              fecha_envio:           new Date().toISOString(),
              factura_recurrente_id: recurrente.id,
              stripe_invoice_id:     inv.id,
            })
            .select('id, numero')
            .single() as { data: { id: string; numero: string } | null; error: unknown }

          if (errFactura || !facturaCreada) {
            console.error('[Connect] Error creando factura:', errFactura)
            break
          }

          const lineas = (original.lineas_factura ?? []).map((l: LineaFactura) => ({
            factura_id:      facturaCreada.id,
            descripcion:     l.descripcion,
            cantidad:        l.cantidad,
            precio_unitario: l.precio_unitario,
            subtotal:        l.subtotal,
            orden:           l.orden,
          }))
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('lineas_factura').insert(lineas)

          nuevaFactura = facturaCreada
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('facturas_recurrentes') as any)
          .update({ ultima_generacion: new Date().toISOString() })
          .eq('id', recurrente.id)

        // Líneas para el PDF/email — siempre las de la factura base
        const lineasEmail = (original.lineas_factura ?? []) as LineaFactura[]

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: recLogRow } = await (supabase.from('payment_logs') as any).insert({
          invoice_id:             nuevaFactura.id,
          event_type:             'cobro_automatico.recurrente',
          provider:               'stripe',
          provider_event_id:      inv.id,
          amount:                 (inv.amount_paid ?? 0) / 100,
          status:                 'succeeded',
          raw_payload:            { stripe_subscription_id: stripeSubscriptionId },
          xrpl_settlement_status: 'pending',
        }).select('id').single() as { data: { id: string } | null }

        // Email al cliente con PDF y enlace al portal de gestión
        if (cliente.email) {
          try {
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
            const nombreEmisor = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') ||
              'Tu proveedor'

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: recRaw } = await (supabase as any)
              .from('facturas_recurrentes')
              .select('stripe_customer_id')
              .eq('id', recurrente.id)
              .single() as { data: { stripe_customer_id: string } | null }

            const urlGestionSuscripcion = recRaw?.stripe_customer_id
              ? `${appUrl}/api/stripe/recurrentes/${recurrente.id}/portal-publico?cid=${recRaw.stripe_customer_id}`
              : null

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pdfBuffer = await (renderToBuffer as any)(
              createElement(FacturaPDF, {
                factura: {
                  ...(original as object),
                  id:                    nuevaFactura.id,
                  numero:                nuevaFactura.numero,
                  fecha_emision:         hoy,
                  estado:                'pagada',
                  factura_recurrente_id: recurrente.id,
                  lineas:                lineasEmail.map((l: LineaFactura, i: number) => ({
                    ...original.lineas_factura[i],
                    ...l,
                  })),
                  cliente,
                },
                perfil,
              })
            ) as Buffer

            const html = await render(
              createElement(FacturaEmail, {
                numeroFactura:        nuevaFactura.numero,
                nombreEmisor,
                nombreCliente:        cliente.nombre,
                fechaEmision:         formatDate(hoy),
                fechaVencimiento:     null,
                lineas:               lineasEmail.map((l: LineaFactura) => ({
                  descripcion:     l.descripcion,
                  cantidad:        l.cantidad,
                  precio_unitario: l.precio_unitario,
                  subtotal:        l.subtotal,
                })),
                baseImponible:   original.base_imponible,
                ivaPorcentaje:   original.iva_porcentaje,
                ivaImporte:      original.iva_importe,
                irpfPorcentaje:  original.irpf_porcentaje,
                irpfImporte:     original.irpf_importe,
                total:           original.total,
                notas:           original.notas,
                urlDescarga:     `${appUrl}/api/facturas/${nuevaFactura.id}/pdf`,
                urlGestionSuscripcion,
              })
            )

            await getResend().emails.send({
              from:        process.env.RESEND_FROM ?? `${nombreEmisor} <onboarding@resend.dev>`,
              to:          cliente.email,
              subject:     `Factura ${nuevaFactura.numero} de ${nombreEmisor} — cobro realizado`,
              html,
              attachments: [{ filename: `${nuevaFactura.numero}.pdf`, content: pdfBuffer }],
            })
          } catch (emailErr) {
            // El email falla silenciosamente — la factura ya está creada y el cobro hecho
            console.error('[Connect] Error enviando email al cliente:', emailErr)
          }
        }

        // XRPL fire-and-forget — siempre registrar (la función valida acceso internamente)
        registrarEventoBlockchain(nuevaFactura.id, recurrente.user_id, 'pago').then(
          async (res: { txHash: string; ledger: number } | null) => {
            if (recLogRow?.id) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await (supabase.from('payment_logs') as any)
                .update(res
                  ? { xrpl_settlement_status: 'settled', xrpl_settlement_tx: res.txHash, xrpl_settled_at: new Date().toISOString() }
                  : { xrpl_settlement_status: 'failed' }
                )
                .eq('id', recLogRow.id)
            }
            if (res) console.log(`[Connect/Recurrente] ${nuevaFactura.id}: ${res.txHash}`)
          }
        ).catch(() => {
          if (recLogRow?.id) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(supabase.from('payment_logs') as any)
              .update({ xrpl_settlement_status: 'failed' })
              .eq('id', recLogRow.id)
              .then(() => {})
          }
        })

        break
      }

      // ─── invoice.payment_failed ───────────────────────────────────────────
      // Cobro automático fallido → marcar past_due y avisar al autónomo.
      case 'invoice.payment_failed': {
        const inv = evento.data.object as Stripe.Invoice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripeSubscriptionId = (inv as any).subscription as string | null
        if (!stripeSubscriptionId) break

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('facturas_recurrentes') as any)
          .update({ cobro_status: 'past_due' })
          .eq('stripe_subscription_id', stripeSubscriptionId)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: recurrente } = await (supabase as any)
          .from('facturas_recurrentes')
          .select(`
            id, user_id,
            profiles!inner ( email, nombre, apellidos ),
            facturas!factura_base_id ( clientes ( nombre ) )
          `)
          .eq('stripe_subscription_id', stripeSubscriptionId)
          .single() as {
            data: {
              id: string
              user_id: string
              profiles: { email: string; nombre: string; apellidos: string }
              facturas: { clientes: { nombre: string } | null }
            } | null
          }

        if (recurrente?.profiles?.email) {
          const nombreCliente  = recurrente.facturas?.clientes?.nombre ?? 'tu cliente'
          const nombreAutonomo = [recurrente.profiles.nombre, recurrente.profiles.apellidos]
            .filter(Boolean).join(' ') || 'usuario'

          console.warn(
            `[Connect] Pago fallido — autónomo: ${nombreAutonomo}` +
            ` — cliente: ${nombreCliente} — suscripción: ${stripeSubscriptionId}`
          )
          // TODO: enviar email de aviso al autónomo vía Resend

          // XRPL: subscription_failed (fire-and-forget)
          recordXrplEvent({
            userId:    recurrente.user_id,
            eventType: 'subscription_failed',
            payload:   { clientName: nombreCliente, failureReason: 'payment_failed', stripeSubscriptionId },
          }).catch(() => {})
        }
        break
      }

      // ─── customer.subscription.deleted ───────────────────────────────────
      // El cliente canceló o Stripe anuló la suscripción → volver a modo manual.
      case 'customer.subscription.deleted': {
        const sub = evento.data.object as Stripe.Subscription

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: recCancelada } = await (supabase.from('facturas_recurrentes') as any)
          .update({
            cobro_automatico:       false,
            cobro_status:           'canceled',
            stripe_subscription_id: null,
          })
          .eq('stripe_subscription_id', sub.id)
          .select('user_id')
          .single() as { data: { user_id: string } | null }

        // XRPL: subscription_cancelled (fire-and-forget)
        if (recCancelada?.user_id) {
          recordXrplEvent({
            userId:    recCancelada.user_id,
            eventType: 'subscription_cancelled',
            payload:   { cancelledBy: 'stripe', effectiveDate: new Date().toISOString(), stripeSubId: sub.id },
          }).catch(() => {})
        }
        break
      }

      // ─── account.updated ─────────────────────────────────────────────────
      // Onboarding del autónomo actualizado → sincronizar stripe_account_status.
      case 'account.updated': {
        const account = evento.data.object as Stripe.Account
        const nuevoEstado = account.charges_enabled
          ? 'active'
          : account.details_submitted
            ? 'pending'
            : 'not_connected'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('profiles')
          .update({ stripe_account_status: nuevoEstado })
          .eq('stripe_account_id', account.id)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`[Connect webhook] Error procesando ${evento.type}:`, err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
