import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
import type Stripe from 'stripe'

// Mapea el priceId de Stripe al plan interno
function obtenerPlanDesdePriceId(priceId: string): 'free' | 'basico' | 'pro' {
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC) return 'basico'
  if (priceId === process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO) return 'pro'
  return 'free'
}

// Webhook de Stripe: gestiona eventos de suscripción
export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Sin firma' }, { status: 400 })
  }

  let evento: Stripe.Event

  try {
    evento = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error('Error verificando webhook de Stripe:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (evento.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const suscripcion = evento.data.object as Stripe.Subscription
        const customerId = suscripcion.customer as string
        const priceId = suscripcion.items.data[0]?.price.id ?? ''
        const planStatus = suscripcion.status as 'active' | 'canceled' | 'past_due' | 'trialing'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            stripe_subscription_id: suscripcion.id,
            plan: obtenerPlanDesdePriceId(priceId),
            plan_status: planStatus,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      case 'customer.subscription.deleted': {
        const suscripcion = evento.data.object as Stripe.Subscription
        const customerId = suscripcion.customer as string

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({
            plan: 'free',
            plan_status: 'canceled',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', customerId)
        break
      }

      default:
        break
    }
  } catch (err) {
    console.error(`Error procesando evento ${evento.type}:`, err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ recibido: true })
}
