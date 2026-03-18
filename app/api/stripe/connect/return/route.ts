import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

// Stripe redirige aquí tras completar (o abandonar) el onboarding Express.
// Consultamos el estado real de la cuenta y actualizamos profiles.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const adminSupabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (adminSupabase as any)
    .from('profiles')
    .select('stripe_account_id')
    .eq('id', user.id)
    .single() as { data: { stripe_account_id: string | null } | null }

  if (!perfil?.stripe_account_id) {
    redirect('/configuracion?stripe=error')
  }

  const stripe = getStripe()
  const account = await stripe.accounts.retrieve(perfil.stripe_account_id)

  // charges_enabled = puede cobrar; details_submitted = formulario completado pero pendiente revisión
  const nuevoEstado = account.charges_enabled
    ? 'active'
    : account.details_submitted
      ? 'pending'
      : 'not_connected'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase as any)
    .from('profiles')
    .update({ stripe_account_status: nuevoEstado })
    .eq('id', user.id)

  const param = nuevoEstado === 'active' ? 'connected' : 'pending'
  redirect(`/configuracion?stripe=${param}`)
}
