import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'
import { generateUserWallet } from '@/lib/xrpl-wallet'
import { registrarEventoBlockchain } from '@/lib/blockchain-event'
import { recordXrplEvent } from '@/lib/xrpl-events'
import type Stripe from 'stripe'

// Mapea el priceId de Stripe al plan interno (mensual y anual)
function obtenerPlanDesdePriceId(priceId: string): 'free' | 'basico' | 'pro' {
  const basicoIds = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_ANUAL,
  ]
  const proIds = [
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANUAL,
  ]
  if (basicoIds.includes(priceId)) return 'basico'
  if (proIds.includes(priceId)) return 'pro'
  return 'free'
}

// Calcula la próxima fecha de cobro según la periodicidad
function calcularProximaFecha(interval: string, desde: Date = new Date()): string {
  const d = new Date(desde)
  if (interval === 'anual') d.setFullYear(d.getFullYear() + 1)
  else if (interval === 'trimestral') d.setMonth(d.getMonth() + 3)
  else d.setMonth(d.getMonth() + 1) // mensual por defecto
  return d.toISOString().split('T')[0]
}

// Webhook de Stripe para la cuenta principal de FacturX.
// Gestiona: planes (basico/pro), pagos de facturas, suscripciones de clientes y wallets XRPL.
// Los eventos de cuentas Express van a /api/webhooks/stripe-connect (STRIPE_CONNECT_WEBHOOK_SECRET).
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sin firma' }, { status: 400 })
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET no configurado')
    return NextResponse.json({ error: 'Error de configuración' }, { status: 500 })
  }

  let evento: Stripe.Event
  try {
    evento = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Firma de webhook inválida:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  // Admin client: los webhooks no tienen sesión de usuario activa
  const supabase = await createAdminClient()

  try {
    switch (evento.type) {

      // ─── checkout.session.completed ───────────────────────────────────────
      // Cubre tres casos: (1) compra de plan FacturX, (2) pago de factura,
      // (3) generación de wallet XRPL tras upgrade a Pro.
      case 'checkout.session.completed': {
        const session = evento.data.object as Stripe.Checkout.Session

        // 1) Compra/renovación del plan de FacturX (modo suscripción)
        if (session.mode === 'subscription') {
          const customerId = session.customer as string
          const subscriptionId = session.subscription as string
          const userId = session.metadata?.supabase_user_id

          const suscripcion = await getStripe().subscriptions.retrieve(subscriptionId)
          const priceId = suscripcion.items.data[0]?.price.id ?? ''
          const plan = obtenerPlanDesdePriceId(priceId)

          const filtro = userId
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (supabase.from('profiles') as any).update({
                stripe_customer_id: customerId,
                stripe_subscription_id: subscriptionId,
                plan,
                plan_status: 'active',
              }).eq('id', userId)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            : (supabase.from('profiles') as any).update({
                stripe_subscription_id: subscriptionId,
                plan,
                plan_status: 'active',
              }).eq('stripe_customer_id', customerId)

          await filtro
        }

        // 2) Pago de factura (modo pago único con invoice_id en metadata)
        const invoiceId = session.metadata?.invoice_id
        if (invoiceId && session.payment_status === 'paid') {
          const paidAt = new Date().toISOString()

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('facturas')
            .update({ estado: 'pagada', paid_at: paidAt })
            .eq('id', invoiceId)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('payment_logs') as any).insert({
            invoice_id: invoiceId,
            event_type: 'checkout.session.completed',
            provider: 'stripe',
            provider_event_id: session.id,
            amount: (session.amount_total ?? 0) / 100,
            status: 'succeeded',
            raw_payload: evento.data.object,
          })

          // Registrar en XRPL (fire-and-forget)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: facturaRow } = await (supabase as any)
            .from('facturas')
            .select('user_id')
            .eq('id', invoiceId)
            .single() as { data: { user_id: string } | null }

          if (facturaRow?.user_id) {
            registrarEventoBlockchain(invoiceId, facturaRow.user_id, 'pago').then(res => {
              if (res) console.log(`[Blockchain] Factura ${invoiceId} registrada tras pago: ${res.txHash}`)
            })
            recordXrplEvent({
              userId: facturaRow.user_id, eventType: 'invoice_paid', invoiceId,
              payload: { paidAt: new Date().toISOString(), provider: 'stripe_checkout' },
            }).catch(() => {})
          }
        }

        // 3) Generar wallet XRPL para usuarios Pro o con addon XRPL
        const xrplUserId = session.metadata?.user_id
        const xrplPlan = session.metadata?.plan
        const xrplAddon = session.metadata?.xrpl_addon
        if (xrplUserId && (xrplPlan === 'pro' || xrplAddon === 'true')) {
          generateUserWallet(xrplUserId).then(address => {
            if (address) console.log(`[XRPL] Wallet generada para ${xrplUserId}: ${address}`)
          })
        }
        break
      }

      // ─── customer.subscription.created / updated ──────────────────────────
      // Cambio de plan, renovación o actualización de la suscripción de FacturX.
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = evento.data.object as Stripe.Subscription
        const customerId = sub.customer as string
        const priceId = sub.items.data[0]?.price.id ?? ''
        const planStatus = sub.status as 'active' | 'canceled' | 'past_due' | 'trialing'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            stripe_subscription_id: sub.id,
            plan: obtenerPlanDesdePriceId(priceId),
            plan_status: planStatus,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      // ─── customer.subscription.deleted ───────────────────────────────────
      // Dos casos:
      //  a) Cancelación del plan de FacturX del usuario
      //  b) Cancelación de suscripción de cliente (tabla subscriptions)
      // (La cancelación de cobros automáticos Express va a /api/webhooks/stripe-connect)
      case 'customer.subscription.deleted': {
        const sub = evento.data.object as Stripe.Subscription
        const customerId = sub.customer as string

        // ── a) Degradar plan de FacturX si coincide con la suscripción del perfil
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ plan: 'free', plan_status: 'canceled', stripe_subscription_id: null })
          .eq('stripe_customer_id', customerId)
          .eq('stripe_subscription_id', sub.id)

        // ── b) Marcar suscripción de cliente como cancelada
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('subscriptions') as any)
          .update({ status: 'canceled', cancelled_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('payment_logs') as any).insert({
          event_type: 'customer.subscription.deleted',
          provider: 'stripe',
          provider_event_id: sub.id,
          status: 'canceled',
          raw_payload: evento.data.object,
        })
        break
      }

      // ─── invoice.payment_failed ───────────────────────────────────────────
      // Pago de plan de FacturX fallido → marcar past_due.
      // (Los fallos en cobros Express van a /api/webhooks/stripe-connect)
      case 'invoice.payment_failed': {
        const inv = evento.data.object as Stripe.Invoice
        const customerId = inv.customer as string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ plan_status: 'past_due' })
          .eq('stripe_customer_id', customerId)

        console.warn(`[Stripe] Pago fallido para customer ${customerId} — factura ${inv.id}`)
        break
      }

      // ─── invoice.payment_succeeded ────────────────────────────────────────
      // Pago de suscripción de cliente (tabla subscriptions).
      // (Los cobros automáticos de recurrentes Express van a /api/webhooks/stripe-connect)
      case 'invoice.payment_succeeded': {
        const inv = evento.data.object as Stripe.Invoice

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const stripeSubscriptionId = (inv as any).subscription as string | null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('payment_logs') as any).insert({
          event_type: 'invoice.payment_succeeded',
          provider: 'stripe',
          provider_event_id: inv.id,
          amount: (inv.amount_paid ?? 0) / 100,
          status: 'succeeded',
          raw_payload: evento.data.object,
        })

        if (!stripeSubscriptionId) break

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: suscripcion } = await (supabase as any)
          .from('subscriptions')
          .select('id, user_id, cliente_id, plan_name, amount, interval')
          .eq('stripe_subscription_id', stripeSubscriptionId)
          .single() as {
            data: {
              id: string
              user_id: string
              cliente_id: string
              plan_name: string
              amount: number
              interval: string
            } | null
          }

        if (!suscripcion) break

        const paidAt = new Date().toISOString()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: numero } = await (supabase.rpc as any)(
          'fn_generar_numero_factura', { p_user_id: suscripcion.user_id }
        ) as { data: string | null }

        if (!numero) break

        const amount = Number(suscripcion.amount)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: nuevaFactura } = await (supabase as any)
          .from('facturas')
          .insert({
            user_id: suscripcion.user_id,
            cliente_id: suscripcion.cliente_id,
            numero,
            fecha_emision: paidAt.split('T')[0],
            estado: 'pagada',
            base_imponible: amount,
            iva_porcentaje: 0,
            iva_importe: 0,
            irpf_porcentaje: 0,
            irpf_importe: 0,
            total: amount,
            paid_at: paidAt,
            notas: `Generada automáticamente — suscripción: ${suscripcion.plan_name}`,
          })
          .select('id')
          .single() as { data: { id: string } | null }

        if (!nuevaFactura) break

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from('lineas_factura').insert({
          factura_id: nuevaFactura.id,
          descripcion: suscripcion.plan_name,
          cantidad: 1,
          precio_unitario: amount,
          subtotal: amount,
          orden: 0,
        })

        // Registrar en XRPL (fire-and-forget)
        registrarEventoBlockchain(nuevaFactura.id, suscripcion.user_id, 'pago').then(res => {
          if (res) console.log(`[Blockchain] Factura suscripción ${nuevaFactura.id} registrada en XRPL: ${res.txHash}`)
        })
        recordXrplEvent({
          userId:         suscripcion.user_id,
          eventType:      'subscription_payment',
          invoiceId:      nuevaFactura.id,
          subscriptionId: suscripcion.id,
          payload: {
            planName:     suscripcion.plan_name,
            amount:       amount,
            interval:     suscripcion.interval,
            billingCycle: new Date().toISOString().slice(0, 7),
          },
        }).catch(() => {})

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('payment_logs') as any).insert({
          invoice_id: nuevaFactura.id,
          event_type: 'subscription.invoice.paid',
          provider: 'stripe',
          provider_event_id: `${inv.id}_factura`,
          amount,
          status: 'succeeded',
          raw_payload: { subscription_id: suscripcion.id, stripe_subscription_id: stripeSubscriptionId },
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('subscriptions')
          .update({ next_billing_date: calcularProximaFecha(suscripcion.interval) })
          .eq('id', suscripcion.id)
        break
      }

      // ─── payment_intent.succeeded ─────────────────────────────────────────
      // Flujo legacy con payment_token (por si algún pago no pasa por checkout).
      case 'payment_intent.succeeded': {
        const pi = evento.data.object as Stripe.PaymentIntent
        const paymentToken = pi.metadata?.payment_token

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('payment_logs') as any).insert({
          event_type: 'payment_intent.succeeded',
          provider: 'stripe',
          provider_event_id: pi.id,
          amount: pi.amount / 100,
          status: pi.status,
          raw_payload: evento.data.object,
        })

        if (!paymentToken) break

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: factura } = await (supabase as any)
          .from('facturas')
          .select('id, user_id')
          .eq('payment_token', paymentToken)
          .single() as { data: { id: string; user_id: string } | null }

        if (!factura) break

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('facturas')
          .update({ paid_at: new Date().toISOString(), estado: 'pagada' })
          .eq('id', factura.id)

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('payment_logs') as any)
          .update({ invoice_id: factura.id })
          .eq('provider_event_id', pi.id)

        registrarEventoBlockchain(factura.id, factura.user_id, 'pago').then(res => {
          if (res) console.log(`[Blockchain] Factura ${factura.id} registrada tras payment_intent: ${res.txHash}`)
        })
        recordXrplEvent({
          userId: factura.user_id, eventType: 'invoice_paid', invoiceId: factura.id,
          payload: { paidAt: new Date().toISOString(), provider: 'stripe_payment_intent' },
        }).catch(() => {})
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`[Stripe Webhook] Error procesando ${evento.type}:`, err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
