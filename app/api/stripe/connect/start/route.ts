import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

// Crea una cuenta Express de Stripe Connect para el usuario y devuelve la URL de onboarding.
// Si ya tiene cuenta, devuelve un nuevo link de onboarding (por si caducó o quiere reanudar).
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const adminSupabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (adminSupabase as any)
    .from('profiles')
    .select('stripe_account_id, email, nombre, apellidos')
    .eq('id', user.id)
    .single() as {
      data: {
        stripe_account_id: string | null
        email: string
        nombre: string | null
        apellidos: string | null
      } | null
    }

  if (!perfil) {
    return NextResponse.json({ error: 'Perfil no encontrado' }, { status: 404 })
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    const stripe = getStripe()
    let accountId = perfil.stripe_account_id

    // Crear cuenta Express si no existe todavía
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'ES',
        email: perfil.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: { user_id: user.id },
      })

      accountId = account.id

      // Guardar el ID de cuenta en profiles
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (adminSupabase as any)
        .from('profiles')
        .update({
          stripe_account_id: accountId,
          stripe_account_status: 'pending',
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('[Stripe Connect] Error guardando stripe_account_id:', updateError)
        // Continuamos — la cuenta ya existe en Stripe, solo falla el guardado local
      }
    }

    // Generar el link de onboarding (válido 24h — siempre creamos uno nuevo)
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/api/stripe/connect/refresh`,
      return_url: `${origin}/api/stripe/connect/return`,
      type: 'account_onboarding',
    })

    return NextResponse.json({ url: accountLink.url })

  } catch (err) {
    const mensaje = err instanceof Error ? err.message : 'Error desconocido'
    console.error('[Stripe Connect] Error en /connect/start:', mensaje)

    // Mensajes de error específicos de Stripe para el usuario
    if (mensaje.includes('Connect')) {
      return NextResponse.json(
        { error: 'Stripe Connect no está activado en tu cuenta. Actívalo en el Dashboard de Stripe.' },
        { status: 500 }
      )
    }

    return NextResponse.json(
      { error: `Error al conectar con Stripe: ${mensaje}` },
      { status: 500 }
    )
  }
}
