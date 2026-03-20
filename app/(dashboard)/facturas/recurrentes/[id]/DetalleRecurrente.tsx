'use client'

import { useState, useTransition, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Toast, type TipoToast } from '@/components/ui/Toast'
import { toggleRecurrente, eliminarRecurrente } from '@/app/(dashboard)/facturas/recurrentes/actions'
import { formatCurrency, formatDate, etiquetaFrecuencia } from '@/lib/utils'
import type { FacturaGenerada, RecurrenteConFactura, CobroStatus } from '@/components/facturas/TablaRecurrentes'

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  recurrente: RecurrenteConFactura
  cobrosActivos: boolean
}

// ── Helpers locales ───────────────────────────────────────────────────────────

function diasRestantes(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const target = new Date(fecha); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function BadgeEstado({ activo }: { activo: boolean }) {
  return activo ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      Activa
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
      <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
      Pausada
    </span>
  )
}

function CobroStatusBadge({ status }: { status: CobroStatus }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/20 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
      </svg>
      Cobro automático
    </span>
  )
  if (status === 'pending_setup') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2.5 py-0.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Pendiente de activar
    </span>
  )
  if (status === 'past_due') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2.5 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      Pago fallido
    </span>
  )
  if (status === 'canceled') return (
    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      Cancelado
    </span>
  )
  return null
}

function BadgeEstadoFactura({ estado }: { estado: FacturaGenerada['estado'] }) {
  switch (estado) {
    case 'pagada':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 dark:bg-green-900/30 px-2 py-0.5 text-xs font-medium text-green-700 dark:text-green-400">
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Pagada
        </span>
      )
    case 'vencida':
      return <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">Vencida</span>
    case 'cancelada':
      return <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">Cancelada</span>
    default:
      return <span className="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/20 px-2 py-0.5 text-xs font-medium text-orange-700 dark:text-orange-400">Pendiente</span>
  }
}

// ── Componente principal ───────────────────────────────────────────────────────

export function DetalleRecurrente({ recurrente: recurrenteInicial, cobrosActivos }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ mensaje: string; tipo: TipoToast } | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [loadingActivar, setLoadingActivar] = useState(false)
  const [loadingDesactivar, setLoadingDesactivar] = useState(false)
  const [loadingRegenerar, setLoadingRegenerar] = useState(false)
  const [setupUrl, setSetupUrl] = useState<string | null>(recurrenteInicial.setup_url)
  const [mostrandoSetupPanel, setMostrandoSetupPanel] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [copiadoFacturaId, setCopiadoFacturaId] = useState<string | null>(null)

  const mostrarToast = useCallback((m: string, t: TipoToast) => setToast({ mensaje: m, tipo: t }), [])

  const r = recurrenteInicial

  // ── Métricas calculadas ────────────────────────────────────────────────────

  const facturasPagadas = r.facturas_generadas.filter(f => f.estado === 'pagada')
  const totalRecaudado = facturasPagadas.reduce((acc, f) => acc + f.total, 0)
  const ciclosPendientes = r.facturas_generadas.filter(f => f.estado === 'emitida' || f.estado === 'vencida').length
  const importePorCiclo = r.facturas.total
  const proximaFecha = r.proxima_fecha

  // ── Acciones ──────────────────────────────────────────────────────────────

  function handleToggle() {
    startTransition(async () => {
      const res = await toggleRecurrente(r.id, !r.activo)
      if (res.ok) {
        mostrarToast(r.activo ? 'Recurrencia pausada' : 'Recurrencia activada', 'exito')
        router.refresh()
      } else {
        mostrarToast(res.error, 'error')
      }
    })
  }

  function handleEliminar() {
    startTransition(async () => {
      const res = await eliminarRecurrente(r.id)
      if (res.ok) {
        mostrarToast('Recurrencia eliminada', 'exito')
        router.push('/facturas/recurrentes')
      } else {
        mostrarToast(res.error, 'error')
        setConfirmandoEliminar(false)
      }
    })
  }

  async function handleActivarCobro() {
    if (setupUrl) {
      setMostrandoSetupPanel(true)
      return
    }
    setLoadingActivar(true)
    try {
      const res = await fetch(`/api/stripe/recurrentes/${r.id}/activar-cobro`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al activar', 'error'); return }
      if (data.activated) {
        mostrarToast('¡Cobro automático activado!', 'exito')
        router.refresh()
        return
      }
      setSetupUrl(data.setup_url)
      setMostrandoSetupPanel(true)
      router.refresh()
    } catch {
      mostrarToast('Error de red. Inténtalo de nuevo.', 'error')
    } finally {
      setLoadingActivar(false)
    }
  }

  async function handleDesactivarCobro() {
    setLoadingDesactivar(true)
    try {
      const res = await fetch(`/api/stripe/recurrentes/${r.id}/desactivar-cobro`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al desactivar', 'error'); return }
      mostrarToast('Cobro automático desactivado', 'exito')
      router.refresh()
    } catch {
      mostrarToast('Error de red. Inténtalo de nuevo.', 'error')
    } finally {
      setLoadingDesactivar(false)
    }
  }

  async function handleRegenerarEnlace() {
    setLoadingRegenerar(true)
    try {
      const res = await fetch(`/api/stripe/recurrentes/${r.id}/activar-cobro`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al regenerar el enlace', 'error'); return }
      if (data.setup_url) {
        setSetupUrl(data.setup_url)
        setMostrandoSetupPanel(true)
        mostrarToast('Enlace regenerado correctamente', 'exito')
      }
    } catch {
      mostrarToast('Error de red. Inténtalo de nuevo.', 'error')
    } finally {
      setLoadingRegenerar(false)
    }
  }

  function handleCopiarSetupUrl() {
    if (!setupUrl) return
    navigator.clipboard.writeText(setupUrl).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  function handleCopiarEnlaceFactura(facturaId: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiadoFacturaId(facturaId)
      setTimeout(() => setCopiadoFacturaId(null), 2000)
    })
  }

  function handleCopiarPortal() {
    if (!r.stripe_customer_id) return
    const portalUrl = `${window.location.origin}/api/stripe/recurrentes/${r.id}/portal-publico?cid=${r.stripe_customer_id}`
    navigator.clipboard.writeText(portalUrl).then(() => {
      mostrarToast('Enlace de gestión copiado', 'exito')
    })
  }

  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  function getEnlacePago(f: { payment_link_url: string | null; payment_token: string | null }) {
    return f.payment_link_url ?? (f.payment_token ? `${appUrl}/pay/${f.payment_token}` : null)
  }

  const nombreCliente = r.facturas.clientes?.nombre ?? '—'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Cabecera ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            href="/facturas/recurrentes"
            className="mt-0.5 flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-violet-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{nombreCliente}</h1>
              <BadgeEstado activo={r.activo} />
              {(r.cobro_automatico || r.cobro_status !== 'manual') && (
                <CobroStatusBadge status={r.cobro_status} />
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Base: <span className="font-medium text-gray-700 dark:text-gray-300">{r.facturas.numero}</span>
              {' · '}
              {etiquetaFrecuencia(r.frecuencia)}
            </p>
          </div>
        </div>
      </div>

      {/* ── Métricas ── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Importe / ciclo</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(importePorCiclo)}</p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{etiquetaFrecuencia(r.frecuencia)}</p>
        </div>
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-xs font-medium text-green-600 dark:text-green-400">Total recaudado</p>
          <p className="mt-1 text-2xl font-bold text-green-800 dark:text-green-300">{formatCurrency(totalRecaudado)}</p>
          <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">
            {facturasPagadas.length} ciclo{facturasPagadas.length !== 1 ? 's' : ''} cobrado{facturasPagadas.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={`rounded-xl border p-4 ${ciclosPendientes > 0 ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
          <p className={`text-xs font-medium ${ciclosPendientes > 0 ? 'text-orange-600' : 'text-gray-500 dark:text-gray-400'}`}>
            Ciclos pendientes
          </p>
          <p className={`mt-1 text-2xl font-bold ${ciclosPendientes > 0 ? 'text-orange-700' : 'text-gray-400 dark:text-gray-500'}`}>
            {ciclosPendientes > 0 ? ciclosPendientes : '—'}
          </p>
          <p className={`mt-0.5 text-xs ${ciclosPendientes > 0 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {ciclosPendientes > 0 ? 'sin cobrar' : 'todo cobrado'}
          </p>
        </div>
        <div className="rounded-xl border border-violet-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Próximo envío</p>
          {proximaFecha && r.activo ? (
            <>
              <p className="mt-1 text-lg font-bold text-gray-900 dark:text-gray-100">{formatDate(proximaFecha)}</p>
              {(() => {
                const dias = diasRestantes(proximaFecha)
                if (dias < 0) return <p className="mt-0.5 text-xs text-red-500">Atrasada</p>
                if (dias === 0) return <p className="mt-0.5 text-xs font-semibold text-orange-600">Hoy</p>
                return <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">en {dias} día{dias !== 1 ? 's' : ''}</p>
              })()}
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">{r.activo ? 'Sin programar' : 'Pausada'}</p>
          )}
        </div>
      </div>

      {/* ── Panel de acciones ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">Acciones</h2>
        <div className="flex flex-wrap items-center gap-3">

          {/* Pausar/activar — visible siempre, independientemente de cobro_automatico */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={isPending}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              r.activo
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {isPending ? 'Procesando...' : r.activo ? 'Pausar recurrencia' : 'Activar recurrencia'}
          </button>

          {/* Estado: manual → activar cobro + eliminar */}
          {r.cobro_status === 'manual' && (
            <>
              {cobrosActivos && (
                <button
                  type="button"
                  onClick={handleActivarCobro}
                  disabled={loadingActivar}
                  className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loadingActivar ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  Activar cobro automático
                </button>
              )}

              <div className="ml-auto">
                {confirmandoEliminar ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">¿Eliminar esta recurrencia?</span>
                    <button
                      type="button"
                      onClick={handleEliminar}
                      disabled={isPending}
                      className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmandoEliminar(false)}
                      className="rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmandoEliminar(true)}
                    className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Eliminar
                  </button>
                )}
              </div>
            </>
          )}

          {/* Estado: pending_setup → ver enlace de activación + regenerar + desactivar */}
          {r.cobro_status === 'pending_setup' && (
            <div className="flex w-full flex-wrap items-center gap-3">
              {/* Badge de enlace caducado si ultima_generacion tiene más de 23h */}
              {r.ultima_generacion && (
                (Date.now() - new Date(r.ultima_generacion).getTime()) > 23 * 60 * 60 * 1000
              ) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 dark:bg-orange-900/30 px-2.5 py-0.5 text-xs font-semibold text-orange-700 dark:text-orange-400">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Enlace caducado
                </span>
              )}
              <button
                type="button"
                onClick={handleActivarCobro}
                className="flex items-center gap-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 px-3 py-2 text-sm font-semibold text-yellow-800 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                Ver enlace de activación
              </button>
              <button
                type="button"
                onClick={handleRegenerarEnlace}
                disabled={loadingRegenerar}
                className="flex items-center gap-2 rounded-lg border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 px-3 py-2 text-sm font-medium text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/30 disabled:opacity-60"
              >
                {loadingRegenerar ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                )}
                Regenerar enlace de pago
              </button>
              <button
                type="button"
                onClick={handleDesactivarCobro}
                disabled={loadingDesactivar}
                className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-60"
              >
                {loadingDesactivar ? 'Desactivando...' : 'Desactivar cobro'}
              </button>
            </div>
          )}

          {/* Estado: active → badge + copiar portal + desactivar */}
          {r.cobro_status === 'active' && (
            <div className="flex w-full items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2">
                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-semibold text-blue-700 dark:text-blue-400">Cobro automático activo</span>
              </div>

              {r.stripe_customer_id && (
                <button
                  type="button"
                  onClick={handleCopiarPortal}
                  className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar portal del cliente
                </button>
              )}

              <button
                type="button"
                onClick={handleDesactivarCobro}
                disabled={loadingDesactivar}
                className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
                {loadingDesactivar ? 'Desactivando...' : 'Desactivar cobro'}
              </button>
            </div>
          )}

          {/* Estado: past_due → badge + desactivar */}
          {r.cobro_status === 'past_due' && (
            <>
              <CobroStatusBadge status="past_due" />
              <button
                type="button"
                onClick={handleDesactivarCobro}
                disabled={loadingDesactivar}
                className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 disabled:opacity-60"
              >
                {loadingDesactivar ? 'Desactivando...' : 'Desactivar cobro'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Tabla de facturas generadas ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Facturas generadas</h2>
          <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2.5 py-0.5 text-xs font-semibold text-violet-700 dark:text-violet-400">
            {r.facturas_generadas.length}
          </span>
        </div>

        {r.facturas_generadas.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Aún no se ha generado ningún ciclo.</p>
          </div>
        ) : (
          <>
            {/* Vista desktop */}
            <table className="hidden w-full md:table">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700">
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Nº Factura</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Fecha</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Importe</th>
                  <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Estado</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {r.facturas_generadas.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/facturas/${f.id}`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-violet-600 hover:underline"
                      >
                        {f.numero}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{formatDate(f.fecha_emision)}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(f.total)}</td>
                    <td className="px-5 py-3.5 text-center">
                      <BadgeEstadoFactura estado={f.estado} />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {(() => {
                        const enlace = getEnlacePago(f)
                        if (!enlace || f.estado === 'pagada' || f.estado === 'cancelada') return null
                        return (
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={enlace}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Abrir link de cobro"
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                            >
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                              </svg>
                              Cobrar
                            </a>
                            <button
                              type="button"
                              onClick={() => handleCopiarEnlaceFactura(f.id, enlace)}
                              title="Copiar enlace de pago"
                              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                              {copiadoFacturaId === f.id ? (
                                <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              ) : (
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              )}
                              {copiadoFacturaId === f.id ? 'Copiado' : 'Copiar'}
                            </button>
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Vista móvil */}
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">
              {r.facturas_generadas.map((f) => (
                <li key={f.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/facturas/${f.id}`}
                        className="font-medium text-gray-900 dark:text-gray-100 hover:text-violet-600"
                      >
                        {f.numero}
                      </Link>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(f.fecha_emision)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(f.total)}</p>
                      <BadgeEstadoFactura estado={f.estado} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <Link
                      href={`/facturas/${f.id}`}
                      className="text-xs text-violet-600 hover:underline"
                    >
                      Ver detalle →
                    </Link>
                    {(() => {
                      const enlace = getEnlacePago(f)
                      if (!enlace || f.estado === 'pagada' || f.estado === 'cancelada') return null
                      return (
                        <div className="flex items-center gap-3">
                          <a
                            href={enlace}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            Link de cobro →
                          </a>
                          <button
                            type="button"
                            onClick={() => handleCopiarEnlaceFactura(f.id, enlace)}
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {copiadoFacturaId === f.id ? '✓ Copiado' : 'Copiar'}
                          </button>
                        </div>
                      )
                    })()}
                  </div>
                </li>
              ))}
            </ul>

            {/* Pie de tabla */}
            <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {r.facturas_generadas.length} ciclo{r.facturas_generadas.length !== 1 ? 's' : ''} generado{r.facturas_generadas.length !== 1 ? 's' : ''}
                {facturasPagadas.length > 0 && ` · ${facturasPagadas.length} cobrado${facturasPagadas.length !== 1 ? 's' : ''}`}
                {ciclosPendientes > 0 && (
                  <span className="text-orange-600"> · {ciclosPendientes} pendiente{ciclosPendientes !== 1 ? 's' : ''}</span>
                )}
              </p>
            </div>
          </>
        )}
      </div>

      {/* ── Modal de enlace de activación (setup_url) ── */}
      {mostrandoSetupPanel && setupUrl && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white dark:bg-gray-800 p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">Enlace de activación</p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Comparte este enlace con tu cliente para que introduzca su tarjeta.
                  Una vez lo haga, los cobros serán automáticos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMostrandoSetupPanel(false)}
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="flex-1 truncate font-mono text-sm text-gray-700 dark:text-gray-300">{setupUrl}</p>
              <button
                type="button"
                onClick={handleCopiarSetupUrl}
                className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
              >
                {copiado ? '✓ Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              Este enlace puede compartirse por email, WhatsApp o cualquier otro medio.
              Expira en 24 horas — si caduca, vuelve a hacer clic en &quot;Activar cobro automático&quot;.
            </p>
          </div>
        </div>
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </div>
  )
}
