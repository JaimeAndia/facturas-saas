import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

// Webhook de Stripe v2: gestiona pagos de facturas y suscripciones de clientes
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

  const supabase = await createClient()

  try {
    switch (evento.type) {
      // Pago único de factura completado
      case 'payment_intent.succeeded': {
        const pi = evento.data.object as Stripe.PaymentIntent
        const paymentToken = pi.metadata?.payment_token

        // Registrar en payment_logs
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('payment_logs') as any).insert({
          event_type: 'payment_intent.succeeded',
          provider: 'stripe',
          provider_event_id: pi.id,
          amount: pi.amount / 100,
          status: pi.status,
          raw_payload: evento.data.object,
        })

        // Si hay payment_token, marcar la factura como pagada
        if (paymentToken) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: factura } = await (supabase.from('facturas') as any)
            .select('id')
            .eq('payment_token', paymentToken)
            .single()

          if (factura) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('facturas') as any)
              .update({ paid_at: new Date().toISOString(), estado: 'cobrada' })
              .eq('id', factura.id)

            // Actualizar payment_logs con la factura asociada
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase.from('payment_logs') as any)
              .update({ invoice_id: factura.id })
              .eq('provider_event_id', pi.id)
          }
        }
        break
      }

      // Pago de suscripción de cliente completado
      case 'invoice.payment_succeeded': {
        const inv = evento.data.object as Stripe.Invoice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('payment_logs') as any).insert({
          event_type: 'invoice.payment_succeeded',
          provider: 'stripe',
          provider_event_id: inv.id,
          amount: (inv.amount_paid ?? 0) / 100,
          status: 'succeeded',
          raw_payload: evento.data.object,
        })
        break
      }

      // Suscripción de cliente cancelada
      case 'customer.subscription.deleted': {
        const sub = evento.data.object as Stripe.Subscription
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('subscriptions') as any)
          .update({ status: 'canceled' })
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

      default:
        break
    }
  } catch (err) {
    console.error(`Error procesando evento ${evento.type}:`, err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
