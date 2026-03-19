import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe/client'
import { createAdminClient } from '@/lib/supabase/server'

interface CheckoutBody {
  token: string
}

// Crea una Stripe Checkout Session en la cuenta Express del autónomo.
// El dinero va directamente a su cuenta bancaria (D+2 vía Stripe Express).
export async function POST(request: Request) {
  let body: CheckoutBody
  try {
    body = await request.json() as CheckoutBody
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { token } = body
  if (!token) {
    return NextResponse.json({ error: 'token requerido' }, { status: 400 })
  }

  const supabase = await createAdminClient()

  // Obtener factura + perfil del autónomo (para su stripe_account_id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase as any)
    .from('facturas')
    .select('id, numero, total, estado, user_id, factura_recurrente_id, clientes(nombre, email)')
    .eq('payment_token', token)
    .single() as {
      data: {
        id: string
        numero: string
        total: number
        estado: string
        user_id: string
        factura_recurrente_id: string | null
        clientes: { nombre: string; email: string | null } | null
      } | null
    }

  if (!factura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  if (factura.estado === 'pagada') {
    return NextResponse.json({ error: 'Esta factura ya ha sido pagada' }, { status: 400 })
  }

  // Obtener la cuenta Express del autónomo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase as any)
    .from('profiles')
    .select('stripe_account_id, stripe_account_status')
    .eq('id', factura.user_id)
    .single() as { data: { stripe_account_id: string | null; stripe_account_status: string | null } | null }

  if (!perfil?.stripe_account_id || perfil.stripe_account_status !== 'active') {
    return NextResponse.json(
      { error: 'El autónomo no tiene los cobros activados todavía' },
      { status: 403 }
    )
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const stripe = getStripe()

  // ── Verificar si esta factura está ligada a una recurrente ────────────────
  // Dos casos:
  //  A) factura es la plantilla base → facturas_recurrentes.factura_base_id = factura.id
  //  B) factura es una hija generada → factura.factura_recurrente_id apunta a la recurrente
  // En ambos casos creamos/reutilizamos un Customer en la cuenta Express para
  // guardar el método de pago y poder activar cobros automáticos sin nuevo checkout.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let { data: recurrente } = await (supabase as any)
    .from('facturas_recurrentes')
    .select('id, stripe_customer_id')
    .eq('factura_base_id', factura.id)
    .maybeSingle() as { data: { id: string; stripe_customer_id: string | null } | null }

  // Caso B: factura hija generada por cron o webhook
  if (!recurrente && factura.factura_recurrente_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: recurrenteHija } = await (supabase as any)
      .from('facturas_recurrentes')
      .select('id, stripe_customer_id')
      .eq('id', factura.factura_recurrente_id)
      .maybeSingle() as { data: { id: string; stripe_customer_id: string | null } | null }
    recurrente = recurrenteHija
  }

  let stripeCustomerId: string | undefined = undefined

  if (recurrente) {
    if (recurrente.stripe_customer_id) {
      stripeCustomerId = recurrente.stripe_customer_id
    } else if (factura.clientes?.email) {
      // Crear Customer en la cuenta Express para poder guardar el método de pago
      const customer = await stripe.customers.create(
        {
          email: factura.clientes.email,
          name: factura.clientes.nombre ?? undefined,
          metadata: {
            factura_recurrente_id: recurrente.id,
            facturx_user_id: factura.user_id,
          },
        },
        { stripeAccount: perfil.stripe_account_id }
      )
      stripeCustomerId = customer.id
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('facturas_recurrentes')
        .update({ stripe_customer_id: customer.id })
        .eq('id', recurrente.id)
    }
  }

  // Parámetros de sesión — si hay customer en recurrente, guardamos el método de pago
  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'eur',
          product_data: {
            name: `Factura ${factura.numero}`,
            ...(factura.clientes?.nombre
              ? { description: `Emitida a ${factura.clientes.nombre}` }
              : {}),
          },
          unit_amount: Math.round(factura.total * 100),
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/pay/${token}/success`,
    cancel_url:  `${origin}/pay/${token}`,
    metadata: {
      invoice_id:    factura.id,
      payment_token: token,
    },
  }

  if (stripeCustomerId) {
    // Guardar el método de pago para uso futuro en suscripciones
    sessionParams.customer = stripeCustomerId
    sessionParams.payment_intent_data = { setup_future_usage: 'off_session' }
  } else if (factura.clientes?.email) {
    sessionParams.customer_email = factura.clientes.email
  }

  // Crear la sesión EN la cuenta Express del autónomo — el dinero va directo a su banco
  const session = await stripe.checkout.sessions.create(
    sessionParams,
    { stripeAccount: perfil.stripe_account_id }
  )

  return NextResponse.json({ url: session.url })
}
