import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

// Endpoint PÚBLICO — no requiere autenticación.
// El stripe_customer_id (cus_xxx) actúa como token opaco de acceso.
// Se incluye en el email enviado al cliente tras cada cobro automático.
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const cid = searchParams.get('cid')

  if (!cid) {
    return NextResponse.json({ error: 'Parámetro cid requerido' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // ── Obtener recurrente y verificar que el cid coincide ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recurrente } = await (adminSupabase.from('facturas_recurrentes') as any)
    .select('id, stripe_customer_id, cobro_automatico, user_id')
    .eq('id', id)
    .single()

  if (!recurrente || !recurrente.cobro_automatico) {
    return NextResponse.json({ error: 'Suscripción no encontrada' }, { status: 404 })
  }

  // Verificar que el cid del cliente coincide (seguridad básica)
  if (recurrente.stripe_customer_id !== cid) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  // ── Obtener cuenta Express del autónomo ──────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (adminSupabase.from('profiles') as any)
    .select('stripe_account_id')
    .eq('id', recurrente.user_id)
    .single()

  if (!perfil?.stripe_account_id) {
    return NextResponse.json({ error: 'Cuenta no disponible' }, { status: 500 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const stripe = getStripe()

  try {
    // Crear sesión del Customer Portal en la cuenta Express del autónomo
    // CRÍTICO: { stripeAccount } → es el portal de la cuenta Express, no de FacturX
    const portalSession = await stripe.billingPortal.sessions.create(
      {
        customer: cid,
        return_url: `${appUrl}/suscripcion/cancelada`,
      },
      { stripeAccount: perfil.stripe_account_id }  // SIEMPRE en la cuenta Express
    )

    // Redirigir al cliente al portal
    return NextResponse.redirect(portalSession.url)

  } catch (err) {
    console.error('[portal-publico] Error Stripe:', err)
    return NextResponse.json(
      { error: 'No se pudo abrir el portal. Inténtalo más tarde.' },
      { status: 500 }
    )
  }
}
