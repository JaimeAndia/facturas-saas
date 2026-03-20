import { createClient } from '@/lib/supabase/server'
import { InformeTrimestral } from '@/components/informes/InformeTrimestral'
import type { Factura, Cliente } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Informes — FacturX',
}

interface FacturaConCliente extends Factura {
  clientes: Pick<Cliente, 'nombre' | 'nif'> | null
}

export default async function InformesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('facturas')
    .select('*, clientes(nombre, nif)')
    .eq('user_id', user!.id)
    .neq('estado', 'borrador')
    .neq('estado', 'cancelada')
    // Excluir facturas POS no pagadas (cobros instantáneos pendientes de confirmación)
    .or('source.is.null,source.neq.pos,and(source.eq.pos,estado.eq.pagada)')
    .order('fecha_emision', { ascending: false })

  const facturas = (data as FacturaConCliente[] | null) ?? []

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Informes trimestrales</h1>
      <InformeTrimestral facturas={facturas} />
    </div>
  )
}
