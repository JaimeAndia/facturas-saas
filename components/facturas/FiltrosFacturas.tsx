'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'

interface ClienteFiltro {
  id: string
  nombre: string
}

const ESTADOS_FILTRO = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'emitida', etiqueta: 'Emitida' },
  { valor: 'pagada', etiqueta: 'Pagada' },
  { valor: 'vencida', etiqueta: 'Vencida' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
]

const inputClass =
  'h-9 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-700 dark:text-gray-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20'
const labelClass = 'mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400'

export function FiltrosFacturas({ clientes }: { clientes: ClienteFiltro[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    router.push(`${pathname}?${params.toString()}`)
  }

  const estado = searchParams.get('estado') ?? ''
  const clienteId = searchParams.get('cliente_id') ?? ''
  const desde = searchParams.get('desde') ?? ''
  const hasta = searchParams.get('hasta') ?? ''
  const hayFiltros = !!(estado || clienteId || desde || hasta)

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-4 py-3">
      {/* Estado */}
      <div>
        <label className={labelClass}>Estado</label>
        <select
          value={estado}
          onChange={(e) => setParam('estado', e.target.value)}
          className={inputClass}
        >
          {ESTADOS_FILTRO.map((e) => (
            <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
          ))}
        </select>
      </div>

      {/* Cliente */}
      <div>
        <label className={labelClass}>Cliente</label>
        <select
          value={clienteId}
          onChange={(e) => setParam('cliente_id', e.target.value)}
          className={inputClass}
        >
          <option value="">Todos los clientes</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* Desde */}
      <div>
        <label className={labelClass}>Desde</label>
        <input
          type="date"
          value={desde}
          onChange={(e) => setParam('desde', e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Hasta */}
      <div>
        <label className={labelClass}>Hasta</label>
        <input
          type="date"
          value={hasta}
          onChange={(e) => setParam('hasta', e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Limpiar */}
      {hayFiltros && (
        <button
          onClick={() => router.push(pathname)}
          className="flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
