import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'

// Stripe redirige aquí si el account link de onboarding ha caducado.
// Generamos un nuevo link y redirigimos al usuario.
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

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const origin = `${protocol}://${host}`

  const stripe = getStripe()
  const accountLink = await stripe.accountLinks.create({
    account: perfil.stripe_account_id,
    refresh_url: `${origin}/api/stripe/connect/refresh`,
    return_url: `${origin}/api/stripe/connect/return`,
    type: 'account_onboarding',
  })

  redirect(accountLink.url)
}
