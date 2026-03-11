import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'
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

// Webhook de Stripe: gestiona eventos de suscripción
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
    console.error('Error verificando webhook de Stripe:', err)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    switch (evento.type) {
      // Checkout completado: guardar customer_id y activar el plan
      case 'checkout.session.completed': {
        const session = evento.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const customerId = session.customer as string
        const subscriptionId = session.subscription as string
        const userId = session.metadata?.supabase_user_id

        // Recuperar la suscripción para obtener el priceId y status
        const suscripcion = await getStripe().subscriptions.retrieve(subscriptionId)
        const priceId = suscripcion.items.data[0]?.price.id ?? ''
        const plan = obtenerPlanDesdePriceId(priceId)

        // Actualizar por user_id (disponible en metadata) o por customer_id
        const filtro = userId
          ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase.from('profiles') as any).update({
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              plan,
              plan_status: 'active',
            }).eq('id', userId)
          : // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (supabase.from('profiles') as any).update({
              stripe_subscription_id: subscriptionId,
              plan,
              plan_status: 'active',
            }).eq('stripe_customer_id', customerId)

        await filtro
        break
      }

      // Suscripción creada o actualizada (cambio de plan, renovación, etc.)
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

      // Suscripción cancelada: degradar a plan free
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

      // Pago fallido: marcar como past_due sin cancelar el plan todavía
      case 'invoice.payment_failed': {
        const invoice = evento.data.object as Stripe.Invoice
        const customerId = invoice.customer as string

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any)
          .update({ plan_status: 'past_due' })
          .eq('stripe_customer_id', customerId)

        console.warn(`Pago fallido para customer ${customerId} — factura ${invoice.id}`)
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
