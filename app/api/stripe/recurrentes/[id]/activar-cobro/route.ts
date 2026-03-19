import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { render } from '@react-email/components'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { getResend } from '@/lib/resend/client'
import { registrarEventoBlockchain } from '@/lib/blockchain-event'
import { SubscriptionSetupEmail } from '@/emails/subscription-setup'
import { SubscriptionConfirmedEmail } from '@/emails/subscription-confirmed'
import { formatCurrency } from '@/lib/utils'
import type Stripe from 'stripe'

// Convierte la frecuencia interna al intervalo de Stripe
function frecuenciaAStripeInterval(
  frecuencia: string
): { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number } {
  if (frecuencia === 'mensual')    return { interval: 'month', interval_count: 1 }
  if (frecuencia === 'trimestral') return { interval: 'month', interval_count: 3 }
  if (frecuencia === 'anual')      return { interval: 'year',  interval_count: 1 }

  const match = frecuencia.match(/^personalizado_(\d+)_(dias|semanas|meses)$/)
  if (match) {
    const count = parseInt(match[1], 10)
    const unidad = match[2]
    if (unidad === 'dias')    return { interval: 'day',   interval_count: count }
    if (unidad === 'semanas') return { interval: 'week',  interval_count: count }
    if (unidad === 'meses')   return { interval: 'month', interval_count: count }
  }

  // Fallback seguro
  return { interval: 'month', interval_count: 1 }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const adminSupabase = await createAdminClient()

  // ── 1. Obtener recurrente con factura base y cliente ─────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recurrente, error: errRec } = await (adminSupabase.from('facturas_recurrentes') as any)
    .select(`
      id, frecuencia, cobro_automatico, stripe_customer_id, stripe_price_id, proxima_fecha,
      facturas!factura_base_id (
        total, base_imponible, iva_porcentaje, iva_importe,
        irpf_porcentaje, irpf_importe, notas, cliente_id,
        clientes ( nombre, email )
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (errRec || !recurrente) {
    return NextResponse.json({ error: 'Recurrente no encontrada' }, { status: 404 })
  }

  if (recurrente.cobro_automatico) {
    return NextResponse.json({ error: 'Esta recurrente ya tiene cobro automático activo' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const facturaBase = recurrente.facturas as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cliente = facturaBase?.clientes as any

  if (!cliente?.email) {
    return NextResponse.json(
      { error: 'El cliente no tiene email. Añade un email al cliente para activar el cobro automático.' },
      { status: 400 }
    )
  }

  // ── 2. Obtener perfil del autónomo y verificar cuenta Express ────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (adminSupabase.from('profiles') as any)
    .select('stripe_account_id, stripe_account_status, nombre, apellidos')
    .eq('id', user.id)
    .single()

  // REGLA ABSOLUTA: solo si la cuenta Express está activa
  if (perfil?.stripe_account_status !== 'active' || !perfil?.stripe_account_id) {
    return NextResponse.json(
      { error: 'Activa tu cuenta en Configuración → Cobros para poder activar el cobro automático.' },
      { status: 403 }
    )
  }

  const stripeAccountId: string = perfil.stripe_account_id
  const stripe = getStripe()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Importe en céntimos (Stripe requiere entero)
  const importeCentimos = Math.round(Number(facturaBase.total) * 100)
  if (importeCentimos <= 0) {
    return NextResponse.json({ error: 'El importe de la recurrente debe ser mayor que 0' }, { status: 400 })
  }

  try {
    // ── 3. Crear o reutilizar Customer en la cuenta Express ───────────────────
    // CRÍTICO: { stripeAccount } → dinero va al banco del autónomo, NUNCA a FacturX
    let stripeCustomerId: string = recurrente.stripe_customer_id ?? ''

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: cliente.email,
          name: cliente.nombre,
          metadata: {
            cliente_id: facturaBase.cliente_id,
            factura_recurrente_id: id,
            facturx_user_id: user.id,
          },
        },
        { stripeAccount: stripeAccountId }  // SIEMPRE en la cuenta Express
      )
      stripeCustomerId = customer.id
    }

    // ── 4. Crear Product en la cuenta Express ─────────────────────────────────
    const nombreEmisor = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') || 'Tu proveedor'

    const product = await stripe.products.create(
      {
        name: `Facturación recurrente — ${cliente.nombre}`,
        metadata: {
          factura_recurrente_id: id,
          emisor: nombreEmisor,
        },
      },
      { stripeAccount: stripeAccountId }  // SIEMPRE en la cuenta Express
    )

    // ── 5. Crear Price en la cuenta Express ───────────────────────────────────
    const { interval, interval_count } = frecuenciaAStripeInterval(recurrente.frecuencia)

    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: importeCentimos,
        currency: 'eur',
        recurring: { interval, interval_count },
        metadata: { factura_recurrente_id: id },
      },
      { stripeAccount: stripeAccountId }  // SIEMPRE en la cuenta Express
    )

    // ── 6. Calcular cuándo debe arrancar el primer cobro ──────────────────────
    // Si la primera factura generada (factura_recurrente_id = id) YA está pagada,
    // usar proxima_fecha como trial_end para no cobrar dos veces el ciclo actual.
    // Si NO está pagada, cobrar inmediatamente (sin trial) — se cobra al introducir la tarjeta.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: primeraGenerada } = await (adminSupabase.from('facturas') as any)
      .select('estado')
      .eq('factura_recurrente_id', id)
      .order('fecha_emision', { ascending: true })
      .limit(1)
      .maybeSingle() as { data: { estado: string } | null }

    const primerPagoPendiente = !primeraGenerada || primeraGenerada.estado !== 'pagada'

    const MIN_48H = Date.now() + 48 * 3600 * 1000

    let proximaDate: Date | null = null
    if (!primerPagoPendiente) {
      // Primera factura ya pagada → respetar proxima_fecha
      if (recurrente.proxima_fecha) {
        const d = new Date(recurrente.proxima_fecha)
        if (d.getTime() > MIN_48H) proximaDate = d
      }
      if (!proximaDate) {
        const d = new Date()
        const { interval, interval_count } = frecuenciaAStripeInterval(recurrente.frecuencia)
        if (interval === 'day')   d.setDate(d.getDate() + interval_count)
        if (interval === 'week')  d.setDate(d.getDate() + interval_count * 7)
        if (interval === 'month') d.setMonth(d.getMonth() + interval_count)
        if (interval === 'year')  d.setFullYear(d.getFullYear() + interval_count)
        proximaDate = d
      }
    }

    // trialEnd = undefined cuando el primer pago está pendiente → Stripe cobra de inmediato
    const trialEnd = proximaDate ? Math.floor(proximaDate.getTime() / 1000) : undefined

    // ── 7. Verificar si el cliente ya tiene un método de pago guardado ────────
    // Si pagó la factura base con setup_future_usage: 'off_session', su tarjeta
    // está guardada → crear suscripción directamente sin nuevo checkout.
    const paymentMethods = await stripe.paymentMethods.list(
      { customer: stripeCustomerId, type: 'card' },
      { stripeAccount: stripeAccountId }
    )
    const defaultPM = paymentMethods.data[0]?.id

    if (defaultPM) {
      // ── 7a. Suscripción directa — sin Checkout, sin popup ─────────────────
      const subscription = await stripe.subscriptions.create(
        {
          customer: stripeCustomerId,
          items: [{ price: price.id }],
          default_payment_method: defaultPM,
          ...(trialEnd !== undefined && { trial_end: trialEnd }),
          metadata: {
            factura_recurrente_id: id,
            facturx_user_id: user.id,
          },
        },
        { stripeAccount: stripeAccountId }
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase.from('facturas_recurrentes') as any)
        .update({
          stripe_customer_id:     stripeCustomerId,
          stripe_price_id:        price.id,
          stripe_subscription_id: subscription.id,
          cobro_automatico:       true,
          cobro_status:           'active',
          setup_url:              null,
        })
        .eq('id', id)
        .eq('user_id', user.id)

      // ── Marcar primera factura pendiente como pagada (sin esperar al webhook) ─
      if (primerPagoPendiente) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: factPendiente } = await (adminSupabase.from('facturas') as any)
          .select('id')
          .eq('factura_recurrente_id', id)
          .not('estado', 'in', '(pagada,cancelada)')
          .order('fecha_emision', { ascending: true })
          .limit(1)
          .maybeSingle() as { data: { id: string } | null }

        if (factPendiente) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (adminSupabase.from('facturas') as any)
            .update({ estado: 'pagada', paid_at: new Date().toISOString() })
            .eq('id', factPendiente.id)

          // Registrar pago en blockchain (fire-and-forget)
          registrarEventoBlockchain(factPendiente.id, user.id, 'pago').catch((err) =>
            console.error('[activar-cobro] blockchain event error:', err)
          )
        }
      }

      // ── Email de confirmación al cliente ──────────────────────────────────
      if (cliente.email) {
        try {
          const intervalLabels: Record<string, string> = {
            mensual: 'mensual', trimestral: 'trimestral', anual: 'anual',
          }
          const intervalLabel = intervalLabels[recurrente.frecuencia] ?? recurrente.frecuencia
          const portalUrl = `${appUrl}/api/stripe/recurrentes/${id}/portal-publico?cid=${stripeCustomerId}`
          const startDate = (proximaDate ?? new Date()).toLocaleDateString('es-ES', {
            day: '2-digit', month: 'long', year: 'numeric',
          })

          const html = await render(
            createElement(SubscriptionConfirmedEmail, {
              clientName:  cliente.nombre,
              companyName: nombreEmisor,
              amount:      formatCurrency(Number(facturaBase.total)),
              interval:    intervalLabel,
              startDate,
              portalUrl,
            })
          )

          await getResend().emails.send({
            from:    process.env.RESEND_FROM ?? `${nombreEmisor} <onboarding@resend.dev>`,
            to:      cliente.email,
            subject: `Tu suscripción con ${nombreEmisor} está activa`,
            html,
          })
        } catch (emailErr) {
          console.error('[activar-cobro] Error enviando email de confirmación:', emailErr)
        }
      }

      return NextResponse.json({ activated: true })
    }

    // ── 8. Fallback: Checkout Session (cliente no tiene tarjeta guardada) ────
    // El cliente introduce su tarjeta aquí — el dinero va DIRECTO al banco del autónomo
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: price.id, quantity: 1 }],
        subscription_data: {
          ...(trialEnd !== undefined && { trial_end: trialEnd }),
          metadata: {
            factura_recurrente_id: id,  // para identificar en el webhook
            facturx_user_id: user.id,
          },
        },
        metadata: {
          recurrente_id: id,            // para el webhook checkout.session.completed
          user_id: user.id,
        },
        success_url: `${appUrl}/pay/recurrente/${id}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${appUrl}/facturas/recurrentes`,
        locale: 'es',
        payment_method_types: ['card'],
      },
      { stripeAccount: stripeAccountId }  // SIEMPRE en la cuenta Express
    )

    // ── 9. Guardar en la BD ───────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase.from('facturas_recurrentes') as any)
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_price_id:    price.id,
        setup_url:          session.url,
        cobro_status:       'pending_setup',
      })
      .eq('id', id)
      .eq('user_id', user.id)

    // ── 10. Enviar email al cliente con el link de configuración ──────────────
    if (session.url && cliente.email) {
      try {
        const intervalLabels: Record<string, string> = {
          mensual: 'mensual', trimestral: 'trimestral', anual: 'anual',
        }
        const intervalLabel = intervalLabels[recurrente.frecuencia] ?? recurrente.frecuencia

        const html = await render(
          createElement(SubscriptionSetupEmail, {
            clientName:  cliente.nombre,
            companyName: nombreEmisor,
            amount:      formatCurrency(Number(facturaBase.total)),
            interval:    intervalLabel,
            setupUrl:    session.url,
          })
        )

        await getResend().emails.send({
          from:    process.env.RESEND_FROM ?? `${nombreEmisor} <onboarding@resend.dev>`,
          to:      cliente.email,
          subject: `${nombreEmisor} ha activado el cobro automático — configura tu pago`,
          html,
        })
      } catch (emailErr) {
        // El email falla silenciosamente — el setup_url sigue disponible en la app
        console.error('[activar-cobro] Error enviando email:', emailErr)
      }
    }

    return NextResponse.json({ setup_url: session.url })

  } catch (err) {
    console.error('[activar-cobro] Error Stripe:', err)
    return NextResponse.json(
      { error: 'Error al crear la suscripción en Stripe. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }
}
