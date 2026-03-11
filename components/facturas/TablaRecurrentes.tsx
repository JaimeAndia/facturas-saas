'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Toast, type TipoToast } from '@/components/ui/Toast'
import { toggleRecurrente, eliminarRecurrente } from '@/app/(dashboard)/facturas/recurrentes/actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { FacturaRecurrente, Factura } from '@/types'

interface RecurrenteConFactura extends FacturaRecurrente {
  facturas: Pick<Factura, 'numero' | 'total' | 'cliente_id'> & {
    clientes: { nombre: string } | null
  }
}

interface Props {
  recurrentes: RecurrenteConFactura[]
  esPro: boolean
}

const ETIQUETA_FRECUENCIA: Record<string, string> = {
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  anual: 'Anual',
}

const ICONO_FRECUENCIA: Record<string, string> = {
  mensual: '📅',
  trimestral: '🗓️',
  anual: '📆',
}

export function TablaRecurrentes({ recurrentes, esPro }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ mensaje: string; tipo: TipoToast } | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  function handleToggle(id: string, activoActual: boolean) {
    startTransition(async () => {
      const resultado = await toggleRecurrente(id, !activoActual)
      if (resultado.ok) {
        setToast({ mensaje: activoActual ? 'Recurrencia pausada' : 'Recurrencia activada', tipo: 'exito' })
        router.refresh()
      } else {
        setToast({ mensaje: resultado.error, tipo: 'error' })
      }
    })
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      const resultado = await eliminarRecurrente(id)
      setConfirmandoId(null)
      if (resultado.ok) {
        setToast({ mensaje: 'Recurrencia eliminada', tipo: 'exito' })
        router.refresh()
      } else {
        setToast({ mensaje: resultado.error, tipo: 'error' })
      }
    })
  }

  if (!esPro) {
    return (
      <div className="rounded-xl border border-violet-200 bg-violet-50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
          <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900">Facturas recurrentes</p>
        <p className="mt-1 text-sm text-gray-500">Automatiza tu facturación con el Plan Pro.</p>
        <Link
          href="/configuracion/planes"
          className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
        >
          Ver Plan Pro
        </Link>
      </div>
    )
  }

  if (recurrentes.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
        <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <p className="mt-3 text-sm font-medium text-gray-900">Sin facturas recurrentes</p>
        <p className="mt-1 text-sm text-gray-500">
          Al crear una factura, activa la opción <strong>Repetir esta factura</strong>.
        </p>
        <Link
          href="/facturas/nueva"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Nueva factura
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-xl border border-gray-200 bg-white">
        {/* Cabecera tabla */}
        <div className="hidden border-b border-gray-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:gap-4">
          <span>Factura base / Cliente</span>
          <span>Frecuencia</span>
          <span>Próxima generación</span>
          <span>Última generación</span>
          <span>Acciones</span>
        </div>

        <ul className="divide-y divide-gray-100">
          {recurrentes.map((r) => (
            <li key={r.id} className="px-5 py-4">
              {/* Desktop */}
              <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.facturas.numero}</p>
                  <p className="text-xs text-gray-400">{r.facturas.clientes?.nombre ?? '—'} · {formatCurrency(r.facturas.total)}</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span>{ICONO_FRECUENCIA[r.frecuencia]}</span>
                  <span className="text-sm text-gray-700">{ETIQUETA_FRECUENCIA[r.frecuencia]}</span>
                </div>

                <span className={`text-sm font-medium ${r.activo ? 'text-blue-600' : 'text-gray-400'}`}>
                  {r.activo ? formatDate(r.proxima_fecha) : '—'}
                </span>

                <span className="text-sm text-gray-500">
                  {r.ultima_generacion ? formatDate(r.ultima_generacion) : 'Nunca'}
                </span>

                <div className="flex items-center gap-1">
                  {/* Toggle activo/pausado */}
                  <button
                    onClick={() => handleToggle(r.id, r.activo)}
                    disabled={isPending}
                    title={r.activo ? 'Pausar' : 'Activar'}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      r.activo
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {r.activo ? 'Activa' : 'Pausada'}
                  </button>

                  {/* Eliminar con confirmación */}
                  {confirmandoId === r.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEliminar(r.id)}
                        disabled={isPending}
                        className="rounded-lg bg-red-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                      >
                        Sí
                      </button>
                      <button
                        onClick={() => setConfirmandoId(null)}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmandoId(r.id)}
                      title="Eliminar recurrencia"
                      className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Móvil */}
              <div className="flex items-start justify-between md:hidden">
                <div>
                  <p className="text-sm font-medium text-gray-900">{r.facturas.numero}</p>
                  <p className="text-xs text-gray-400">{r.facturas.clientes?.nombre ?? '—'}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500">{ICONO_FRECUENCIA[r.frecuencia]} {ETIQUETA_FRECUENCIA[r.frecuencia]}</span>
                    {r.activo && (
                      <span className="text-xs text-blue-600">→ {formatDate(r.proxima_fecha)}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(r.id, r.activo)}
                  disabled={isPending}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    r.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {r.activo ? 'Activa' : 'Pausada'}
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-gray-100 px-5 py-3">
          <p className="text-xs text-gray-400">
            {recurrentes.filter(r => r.activo).length} activas · {recurrentes.length} en total
          </p>
        </div>
      </div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </>
  )
}
