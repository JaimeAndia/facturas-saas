import { createClient } from '@/lib/supabase/server'
import { ListaFacturas } from '@/components/facturas/ListaFacturas'
import { SeccionTransaccionesXRPL } from '@/components/facturas/SeccionTransaccionesXRPL'
import type { Factura, Cliente } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Facturas — FacturX',
}

interface FacturaConCliente extends Factura {
  clientes: Pick<Cliente, 'nombre' | 'email'> | null
}

export default async function FacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data }, { data: perfil }] = await Promise.all([
    supabase
      .from('facturas')
      .select('*, clientes(nombre, email)')
      .eq('user_id', user!.id)
      // Ocultar POS no pagadas y plantillas base de recurrentes
      .or('source.is.null,and(source.neq.pos,source.neq.recurrente_base),and(source.eq.pos,estado.eq.pagada)')
      .order('created_at', { ascending: false }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('profiles')
      .select('stripe_account_status, plan, xrpl_addon, xrpl_address')
      .eq('id', user!.id)
      .single() as Promise<{ data: { stripe_account_status: string | null; plan: string; xrpl_addon: boolean | null; xrpl_address: string | null } | null }>,
  ])

  const facturas = (data as FacturaConCliente[] | null) ?? []
  const cobrosActivos = perfil?.stripe_account_status === 'active'

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Facturas</h1>
      <ListaFacturas facturas={facturas} cobrosActivos={cobrosActivos} />
    </div>
  )
}
