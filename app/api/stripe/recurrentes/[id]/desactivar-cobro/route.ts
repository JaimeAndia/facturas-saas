import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const adminSupabase = await createAdminClient()

  // ── 1. Obtener recurrente ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recurrente } = await (adminSupabase.from('facturas_recurrentes') as any)
    .select('id, cobro_automatico, stripe_subscription_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!recurrente) {
    return NextResponse.json({ error: 'Recurrente no encontrada' }, { status: 404 })
  }

  // ── 2. Obtener cuenta Express del autónomo ───────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (adminSupabase.from('profiles') as any)
    .select('stripe_account_id')
    .eq('id', user.id)
    .single()

  if (!perfil?.stripe_account_id) {
    return NextResponse.json({ error: 'No hay cuenta Stripe Connect configurada' }, { status: 400 })
  }

  const stripe = getStripe()

  // ── 3. Cancelar suscripción en Stripe si existe ──────────────────────────────
  if (recurrente.stripe_subscription_id) {
    try {
      // Cancelar al final del período actual (no cortar de golpe al cliente)
      await stripe.subscriptions.update(
        recurrente.stripe_subscription_id,
        { cancel_at_period_end: true },
        { stripeAccount: perfil.stripe_account_id }  // SIEMPRE en la cuenta Express
      )
    } catch (err) {
      console.error('[desactivar-cobro] Error cancelando suscripción Stripe:', err)
      // Continuamos aunque falle Stripe — la BD se actualiza de todas formas
    }
  }

  // ── 4. Actualizar la BD ──────────────────────────────────────────────────────
  // NO borrar stripe_subscription_id aquí: Stripe puede cobrar un ciclo más
  // (cancel_at_period_end=true) y el webhook invoice.payment_succeeded necesita
  // encontrar la recurrente por stripe_subscription_id para generar la factura.
  // La limpieza final (stripe_subscription_id=null, cobro_automatico=false) la
  // hace el bloque customer.subscription.deleted del webhook Connect.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase.from('facturas_recurrentes') as any)
    .update({
      cobro_status: 'canceling',
    })
    .eq('id', id)
    .eq('user_id', user.id)

  return NextResponse.json({ ok: true })
}
