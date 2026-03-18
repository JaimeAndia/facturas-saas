import { NextResponse } from 'next/server'
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
    .select('id, numero, total, estado, user_id, clientes(nombre, email)')
    .eq('payment_token', token)
    .single() as {
      data: {
        id: string
        numero: string
        total: number
        estado: string
        user_id: string
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

  // Crear la sesión EN la cuenta Express del autónomo — el dinero va directo a su banco
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      // Sin payment_method_types → Stripe usa los métodos habilitados en el Dashboard
      // (tarjeta, PayPal, SEPA...) según la configuración de la cuenta
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
      ...(factura.clientes?.email ? { customer_email: factura.clientes.email } : {}),
      success_url: `${origin}/pay/${token}/success`,
      cancel_url: `${origin}/pay/${token}`,
      metadata: {
        invoice_id: factura.id,
        payment_token: token,
      },
    },
    // Ejecutar la sesión en la cuenta Express del autónomo
    { stripeAccount: perfil.stripe_account_id }
  )

  return NextResponse.json({ url: session.url })
}
