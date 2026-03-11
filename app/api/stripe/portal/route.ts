import { NextResponse } from 'next/server'
import { getStripe } from '@/lib/stripe/client'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: perfil } = await (supabase.from('profiles') as any)
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!perfil?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No tienes una suscripción activa' },
        { status: 400 }
      )
    }

    const origen = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

    // Crear sesión del portal de cliente de Stripe
    const session = await getStripe().billingPortal.sessions.create({
      customer: perfil.stripe_customer_id,
      return_url: `${origen}/configuracion`,
    })

    return NextResponse.json({ url: session.url })
  } catch (err) {
    console.error('Error creando sesión del portal de Stripe:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
