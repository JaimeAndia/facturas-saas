import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { priceId } = await request.json() as { priceId?: string }
    if (!priceId) {
      return NextResponse.json({ error: 'Falta priceId' }, { status: 400 })
    }

    // Cargar perfil para obtener o crear el customer de Stripe
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: perfil } = await (supabase.from('profiles') as any)
      .select('stripe_customer_id, email, nombre, apellidos')
      .eq('id', user.id)
      .single()

    let customerId: string = perfil?.stripe_customer_id ?? ''

    // Si no tiene customer en Stripe, crearlo ahora
    if (!customerId) {
      const nombreCompleto = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(' ')
      const customer = await stripe.customers.create({
        email: user.email ?? perfil?.email,
        name: nombreCompleto || undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id

      // Guardar el customer_id en el perfil
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('profiles') as any)
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const origen = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Crear sesión de Stripe Checkout en modo suscripción
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origen}/configuracion?checkout=success`,
      cancel_url: `${origen}/configuracion/planes?checkout=cancelled`,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
      // Facturación automática en caso de pago fallido
      payment_method_collection: 'always',
      locale: 'es',
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Error creando sesión de Stripe Checkout:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
