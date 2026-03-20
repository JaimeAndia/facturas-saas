import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { ListaFacturas } from '@/components/facturas/ListaFacturas'
import { FiltrosFacturas } from '@/components/facturas/FiltrosFacturas'
import { SeccionTransaccionesXRPL } from '@/components/facturas/SeccionTransaccionesXRPL'
import type { Factura, Cliente } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Facturas — FacturX',
}

interface FacturaConCliente extends Factura {
  clientes: Pick<Cliente, 'nombre' | 'email'> | null
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; cliente_id?: string; desde?: string; hasta?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const estado = params.estado && params.estado !== 'todas' ? params.estado : null
  const clienteId = params.cliente_id ?? null
  const desde = params.desde ?? null
  const hasta = params.hasta ?? null
  const hayFiltros = !!(estado || clienteId || desde || hasta)

  // URL de exportación con los mismos filtros activos
  const exportQs = new URLSearchParams()
  if (estado) exportQs.set('estado', estado)
  if (clienteId) exportQs.set('cliente_id', clienteId)
  if (desde) exportQs.set('desde', desde)
  if (hasta) exportQs.set('hasta', hasta)
  const exportUrl = `/api/facturas/export/csv${exportQs.size > 0 ? `?${exportQs.toString()}` : ''}`

  // Construir query con filtros opcionales
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('facturas')
    .select('*, clientes(nombre, email)')
    .eq('user_id', user!.id)
    .or('source.is.null,and(source.neq.pos,source.neq.recurrente_base),and(source.eq.pos,estado.eq.pagada)')
    .order('created_at', { ascending: false })

  if (estado) query = query.eq('estado', estado)
  if (clienteId) query = query.eq('cliente_id', clienteId)
  if (desde) query = query.gte('fecha_emision', desde)
  if (hasta) query = query.lte('fecha_emision', hasta)

  const [{ data }, { data: clientesData }, { data: perfil }] = await Promise.all([
    query as Promise<{ data: FacturaConCliente[] | null }>,
    supabase.from('clientes').select('id, nombre').eq('user_id', user!.id).order('nombre'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('profiles')
      .select('stripe_account_status, plan, xrpl_addon, xrpl_address')
      .eq('id', user!.id)
      .single() as Promise<{ data: { stripe_account_status: string | null; plan: string; xrpl_addon: boolean | null; xrpl_address: string | null } | null }>,
  ])

  const facturas = (data as FacturaConCliente[] | null) ?? []
  const clientes = (clientesData ?? []) as { id: string; nombre: string }[]
  const cobrosActivos = perfil?.stripe_account_status === 'active'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Facturas</h1>
        {hayFiltros && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {facturas.length} {facturas.length === 1 ? 'factura' : 'facturas'}
          </span>
        )}
        <a
          href={exportUrl}
          className="ml-auto flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
          title={hayFiltros ? 'Exportar facturas filtradas a CSV' : 'Exportar todas las facturas a CSV'}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Exportar CSV
        </a>
      </div>
      <Suspense>
        <FiltrosFacturas clientes={clientes} />
      </Suspense>
      <ListaFacturas facturas={facturas} cobrosActivos={cobrosActivos} />
    </div>
  )
}
