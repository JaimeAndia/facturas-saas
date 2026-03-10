'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Toast, type TipoToast } from '@/components/ui/Toast'
import { eliminarFactura } from '@/app/(dashboard)/facturas/actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Factura, Cliente } from '@/types'

type EstadoFiltro = 'todas' | 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'cancelada'

interface FacturaConCliente extends Factura {
  clientes: Pick<Cliente, 'nombre'> | null
}

interface ListaFacturasProps {
  facturas: FacturaConCliente[]
}

const ESTADOS: { valor: EstadoFiltro; etiqueta: string }[] = [
  { valor: 'todas', etiqueta: 'Todas' },
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'emitida', etiqueta: 'Emitida' },
  { valor: 'pagada', etiqueta: 'Pagada' },
  { valor: 'vencida', etiqueta: 'Vencida' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
]

export const BADGE_ESTADO: Record<string, string> = {
  borrador: 'bg-gray-100 text-gray-600',
  emitida: 'bg-blue-100 text-blue-700',
  pagada: 'bg-green-100 text-green-700',
  vencida: 'bg-red-100 text-red-700',
  cancelada: 'bg-gray-100 text-gray-400',
}

export function ListaFacturas({ facturas: facturasProp }: ListaFacturasProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [facturas, setFacturas] = useState(facturasProp)
  useEffect(() => { setFacturas(facturasProp) }, [facturasProp])

  const [busqueda, setBusqueda] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<EstadoFiltro>('todas')
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ mensaje: string; tipo: TipoToast } | null>(null)

  const mostrarToast = useCallback((mensaje: string, tipo: TipoToast) => {
    setToast({ mensaje, tipo })
  }, [])

  // Filtrado: por estado y búsqueda
  const facturasFiltradas = facturas.filter((f) => {
    const pasaEstado = filtroEstado === 'todas' || f.estado === filtroEstado
    const q = busqueda.toLowerCase().trim()
    const pasaBusqueda =
      !q ||
      f.numero.toLowerCase().includes(q) ||
      (f.clientes?.nombre ?? '').toLowerCase().includes(q)
    return pasaEstado && pasaBusqueda
  })

  function handleEliminar(id: string) {
    startTransition(async () => {
      const resultado = await eliminarFactura(id)
      setConfirmandoId(null)
      if (resultado.ok) {
        mostrarToast('Factura eliminada', 'exito')
        router.refresh()
      } else {
        mostrarToast(resultado.error, 'error')
      }
    })
  }

  // Conteo por estado para las pestañas
  const conteo = facturas.reduce<Record<string, number>>((acc, f) => {
    acc[f.estado] = (acc[f.estado] ?? 0) + 1
    return acc
  }, {})

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Buscador */}
        <div className="relative w-full sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por número o cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <Link href="/facturas/nueva">
          <Button className="w-full sm:w-auto">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva factura
          </Button>
        </Link>
      </div>

      {/* Filtros por estado */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {ESTADOS.map(({ valor, etiqueta }) => (
          <button
            key={valor}
            onClick={() => setFiltroEstado(valor)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              filtroEstado === valor
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {etiqueta}
            {valor !== 'todas' && conteo[valor] ? (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                filtroEstado === valor ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {conteo[valor]}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {facturas.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-900">Sin facturas</p>
            <p className="mt-1 text-sm text-gray-500">Crea tu primera factura ahora.</p>
            <div className="mt-5">
              <Link href="/facturas/nueva"><Button>Crear factura</Button></Link>
            </div>
          </div>
        ) : facturasFiltradas.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No hay facturas que coincidan con el filtro aplicado.
          </div>
        ) : (
          <>
            {/* Cabecera — desktop */}
            <div className="hidden border-b border-gray-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid md:grid-cols-[1fr_1.5fr_1fr_auto_auto_auto] md:gap-4">
              <span>Número</span>
              <span>Cliente</span>
              <span>Fecha</span>
              <span>Estado</span>
              <span className="text-right">Total</span>
              <span></span>
            </div>

            <ul className="divide-y divide-gray-100">
              {facturasFiltradas.map((factura) => (
                <li key={factura.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-3 md:grid md:grid-cols-[1fr_1.5fr_1fr_auto_auto_auto] md:gap-4">
                    {/* Número + link */}
                    <Link href={`/facturas/${factura.id}`}
                      className="min-w-0 text-sm font-medium text-blue-600 hover:underline">
                      {factura.numero}
                    </Link>

                    {/* Cliente */}
                    <span className="hidden truncate text-sm text-gray-600 md:block">
                      {factura.clientes?.nombre ?? '—'}
                    </span>

                    {/* Fecha */}
                    <span className="hidden text-sm text-gray-500 md:block">
                      {formatDate(factura.fecha_emision)}
                    </span>

                    {/* Estado */}
                    <span className={`hidden rounded-full px-2 py-0.5 text-xs font-medium md:block ${BADGE_ESTADO[factura.estado] ?? ''}`}>
                      {ESTADOS.find(e => e.valor === factura.estado)?.etiqueta ?? factura.estado}
                    </span>

                    {/* Total */}
                    <span className="ml-auto text-sm font-semibold text-gray-900 md:ml-0 md:text-right">
                      {formatCurrency(factura.total)}
                    </span>

                    {/* Acciones */}
                    {confirmandoId === factura.id ? (
                      <div className="flex items-center gap-1">
                        <Button variante="peligro" tamaño="sm"
                          cargando={isPending}
                          onClick={() => handleEliminar(factura.id)}>
                          Sí
                        </Button>
                        <Button variante="secundario" tamaño="sm"
                          disabled={isPending}
                          onClick={() => setConfirmandoId(null)}>
                          No
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-0.5">
                        <Link href={`/facturas/${factura.id}`}
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                          title="Ver factura">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </Link>
                        <button
                          onClick={() => setConfirmandoId(factura.id)}
                          title="Eliminar factura"
                          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Info extra en móvil */}
                  <div className="mt-1 flex items-center gap-2 md:hidden">
                    <span className="text-xs text-gray-500">{factura.clientes?.nombre ?? '—'}</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-xs text-gray-400">{formatDate(factura.fecha_emision)}</span>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO[factura.estado] ?? ''}`}>
                      {ESTADOS.find(e => e.valor === factura.estado)?.etiqueta}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 px-5 py-3">
              <p className="text-xs text-gray-400">
                {facturasFiltradas.length === facturas.length
                  ? `${facturas.length} factura${facturas.length !== 1 ? 's' : ''}`
                  : `${facturasFiltradas.length} de ${facturas.length} facturas`}
              </p>
            </div>
          </>
        )}
      </div>

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />
      )}
    </>
  )
}
