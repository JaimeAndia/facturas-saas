import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Facturas — FacturApp',
}

// Tipo para la factura con join al cliente
interface FacturaConCliente {
  id: string
  numero: string
  fecha_emision: string
  estado: 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'cancelada'
  total: number
  clientes: { nombre: string } | null
}

const etiquetasEstado: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: 'Borrador', clase: 'bg-gray-100 text-gray-600' },
  emitida: { texto: 'Emitida', clase: 'bg-blue-100 text-blue-700' },
  pagada: { texto: 'Pagada', clase: 'bg-green-100 text-green-700' },
  vencida: { texto: 'Vencida', clase: 'bg-red-100 text-red-700' },
  cancelada: { texto: 'Cancelada', clase: 'bg-gray-100 text-gray-500' },
}

export default async function FacturasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('facturas')
    .select(`
      id, numero, fecha_emision, estado, total,
      clientes ( nombre )
    `)
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const facturas = data as FacturaConCliente[] | null

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Error al cargar facturas: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Facturas</h1>
        <a
          href="/facturas/nueva"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva factura
        </a>
      </div>

      {/* Tabla / Lista */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {!facturas || facturas.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500">No tienes facturas todavía</p>
            <a
              href="/facturas/nueva"
              className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:underline"
            >
              Crea tu primera factura →
            </a>
          </div>
        ) : (
          <>
            {/* Cabecera tabla — solo desktop */}
            <div className="hidden grid-cols-[1fr_1.5fr_1fr_auto_auto] gap-4 border-b border-gray-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid">
              <span>Número</span>
              <span>Cliente</span>
              <span>Fecha</span>
              <span>Estado</span>
              <span className="text-right">Total</span>
            </div>

            <ul className="divide-y divide-gray-100">
              {facturas.map((factura) => {
                const estado = etiquetasEstado[factura.estado] ?? etiquetasEstado.borrador
                const nombreCliente = factura.clientes?.nombre ?? '—'

                return (
                  <li key={factura.id}>
                    <a
                      href={`/facturas/${factura.id}`}
                      className="grid grid-cols-2 gap-2 px-5 py-3.5 hover:bg-gray-50 md:grid-cols-[1fr_1.5fr_1fr_auto_auto] md:items-center md:gap-4"
                    >
                      <span className="text-sm font-medium text-gray-900">{factura.numero}</span>
                      <span className="text-right text-sm font-semibold text-gray-900 md:text-left">
                        {formatCurrency(factura.total)}
                      </span>
                      <span className="col-span-2 text-xs text-gray-500 md:col-span-1">
                        {nombreCliente}
                      </span>
                      <span className="text-xs text-gray-400 md:text-sm">
                        {formatDate(factura.fecha_emision)}
                      </span>
                      <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}>
                        {estado.texto}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
