import { createClient } from '@/lib/supabase/server'
import { PantallaPos } from '@/components/pos/PantallaPos'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'TPV — FacturX',
}

export default async function PosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: perfil }, { data: clientes }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('profiles')
      .select('stripe_account_status')
      .eq('id', user!.id)
      .single() as Promise<{ data: { stripe_account_status: string | null } | null }>,

    supabase
      .from('clientes')
      .select('id, nombre')
      .eq('user_id', user!.id)
      .order('nombre'),
  ])

  const stripeActivo = perfil?.stripe_account_status === 'active'
  const listaClientes = (clientes ?? []) as { id: string; nombre: string }[]

  return (
    <PantallaPos
      stripeActivo={stripeActivo}
      clientes={listaClientes}
    />
  )
}
