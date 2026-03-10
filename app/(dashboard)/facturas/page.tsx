import { createClient } from '@/lib/supabase/server'
import { ListaFacturas } from '@/components/facturas/ListaFacturas'
import type { Factura, Cliente } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Facturas — FacturApp',
}

interface FacturaConCliente extends Factura {
  clientes: Pick<Cliente, 'nombre'> | null
}

export default async function FacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('facturas')
    .select('*, clientes(nombre)')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const facturas = (data as FacturaConCliente[] | null) ?? []

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900">Facturas</h1>
      <ListaFacturas facturas={facturas} />
    </div>
  )
}
