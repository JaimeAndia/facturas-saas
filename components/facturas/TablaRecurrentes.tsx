'use client'

import { Fragment, useState, useTransition, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Toast, type TipoToast } from '@/components/ui/Toast'
import { toggleRecurrente, eliminarRecurrente } from '@/app/(dashboard)/facturas/recurrentes/actions'
import { formatCurrency, formatDate, mrrEquivalente, etiquetaFrecuencia } from '@/lib/utils'
import type { FacturaRecurrente } from '@/types'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface FacturaGenerada {
  id: string
  numero: string
  estado: 'emitida' | 'pagada' | 'vencida' | 'cancelada'
  fecha_emision: string
  total: number
  payment_link_url: string | null
  payment_token: string | null
  factura_recurrente_id: string
}

export type CobroStatus = 'manual' | 'pending_setup' | 'active' | 'past_due' | 'canceled'

export interface RecurrenteConFactura extends FacturaRecurrente {
  cobro_automatico: boolean
  cobro_status: CobroStatus
  stripe_customer_id: string | null
  setup_url: string | null
  facturas: {
    numero: string
    total: number
    cliente_id: string
    clientes: { nombre: string } | null
  }
  facturas_generadas: FacturaGenerada[]
}

interface Props {
  recurrentes: RecurrenteConFactura[]
  esPro: boolean
  cobrosActivos: boolean  // stripe_account_status === 'active'
}

type Filtro = 'todas' | 'activas' | 'pausadas'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Días que faltan para la próxima generación (negativo = atrasada)
function diasRestantes(fecha: string): number {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const target = new Date(fecha); target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function CountdownBadge({ fecha, activo }: { fecha: string | null; activo: boolean }) {
  if (!activo || !fecha) return <span className="text-xs text-gray-400 dark:text-gray-500">Pausada</span>
  const dias = diasRestantes(fecha)
  if (dias < 0) return (
    <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
      Atrasada
    </span>
  )
  if (dias === 0) return (
    <span className="inline-flex animate-pulse items-center rounded-full bg-orange-100 dark:bg-orange-900/20 px-2 py-0.5 text-xs font-semibold text-orange-700">
      Hoy
    </span>
  )
  if (dias <= 7) return (
    <span className="inline-flex items-center rounded-full bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 text-xs font-medium text-orange-600">
      en {dias} día{dias !== 1 ? 's' : ''}
    </span>
  )
  return (
    <span className="text-sm text-violet-600">
      {formatDate(fecha)}
      <span className="ml-1 text-xs text-gray-400 dark:text-gray-500">({dias}d)</span>
    </span>
  )
}

function ResumenGeneradas({ facturas }: { facturas: FacturaGenerada[] }) {
  if (facturas.length === 0) return <span className="text-xs text-gray-400 dark:text-gray-500">Sin ciclos</span>
  const pagadas = facturas.filter(f => f.estado === 'pagada').length
  const pendientes = facturas.filter(f => f.estado === 'emitida' || f.estado === 'vencida').length
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pagadas > 0 && (
        <span className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          {pagadas} pagada{pagadas !== 1 ? 's' : ''}
        </span>
      )}
      {pendientes > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-900/20 px-1.5 py-0.5 text-xs font-semibold text-orange-700">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────────

// ── Badge de cobro automático ──────────────────────────────────────────────────

function CobroStatusBadge({ status }: { status: CobroStatus }) {
  if (status === 'active') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/20 px-2 py-0.5 text-xs font-semibold text-blue-700">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
      </svg>
      Cobro automático
    </span>
  )
  if (status === 'pending_setup') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 px-2 py-0.5 text-xs font-semibold text-yellow-700 dark:text-yellow-400">
      <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Pendiente de activar
    </span>
  )
  if (status === 'past_due') return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      Pago fallido
    </span>
  )
  if (status === 'canceled') return (
    <span className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-medium text-gray-500 dark:text-gray-400">
      Cancelado
    </span>
  )
  return null
}

export function TablaRecurrentes({ recurrentes, esPro, cobrosActivos }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ mensaje: string; tipo: TipoToast } | null>(null)
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<Filtro>('todas')
  // ID de la recurrente cuyo panel de activación está abierto + URL de setup
  const [activandoId, setActivandoId] = useState<string | null>(null)
  const [setupUrl, setSetupUrl] = useState<string | null>(null)
  const [loadingActivar, setLoadingActivar] = useState<string | null>(null)
  const [loadingDesactivar, setLoadingDesactivar] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [portalModal, setPortalModal] = useState<{ recurrenteId: string; customerId: string; clienteNombre: string } | null>(null)
  const [copiadoPortal, setCopiadoPortal] = useState(false)

  const mostrarToast = useCallback((m: string, t: TipoToast) => setToast({ mensaje: m, tipo: t }), [])

  // Polling: si hay alguna recurrente en pending_setup, consultar cada 3s hasta que pase a active
  const hayPendingSetup = recurrentes.some(r => r.cobro_status === 'pending_setup')
  useEffect(() => {
    if (!hayPendingSetup) return
    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [hayPendingSetup, router])

  // ── Gate de plan ──────────────────────────────────────────────────────────

  if (!esPro) {
    return (
      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
          <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <p className="font-semibold text-gray-900 dark:text-gray-100">Facturas recurrentes</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Automatiza tu facturación con el Plan Básico o superior.</p>
        <Link href="/configuracion/planes"
          className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
          Ver planes
        </Link>
      </div>
    )
  }

  // ── Cálculos ──────────────────────────────────────────────────────────────

  const activas = recurrentes.filter(r => r.activo)
  const mrrTotal = activas.reduce((acc, r) => acc + mrrEquivalente(r.facturas.total, r.frecuencia), 0)
  const arrTotal = mrrTotal * 12

  // Total acumulado sin cobrar en todas las recurrentes
  const totalPendiente = recurrentes.reduce((acc, r) => {
    const pendientes = r.facturas_generadas.filter(f => f.estado === 'emitida' || f.estado === 'vencida')
    return acc + pendientes.reduce((s, f) => s + f.total, 0)
  }, 0)
  const numPendientes = recurrentes.reduce((acc, r) =>
    acc + r.facturas_generadas.filter(f => f.estado === 'emitida' || f.estado === 'vencida').length, 0)

  // Próxima generación
  const proximaFecha = activas
    .filter(r => r.proxima_fecha)
    .map(r => r.proxima_fecha!)
    .sort()[0] ?? null
  const importeProximoCiclo = proximaFecha
    ? activas.filter(r => r.proxima_fecha === proximaFecha).reduce((acc, r) => acc + r.facturas.total, 0)
    : 0

  const filtradas = recurrentes.filter((r) => {
    if (filtro === 'activas') return r.activo
    if (filtro === 'pausadas') return !r.activo
    return true
  })

  // ── Acciones ──────────────────────────────────────────────────────────────

  function handleToggle(id: string, activoActual: boolean) {
    startTransition(async () => {
      const r = await toggleRecurrente(id, !activoActual)
      if (r.ok) { mostrarToast(activoActual ? 'Recurrencia pausada' : 'Recurrencia activada', 'exito'); router.refresh() }
      else mostrarToast(r.error, 'error')
    })
  }

  function handleEliminar(id: string) {
    startTransition(async () => {
      const r = await eliminarRecurrente(id)
      setConfirmandoId(null)
      if (r.ok) { mostrarToast('Recurrencia eliminada', 'exito'); router.refresh() }
      else mostrarToast(r.error, 'error')
    })
  }

  async function handleActivarCobro(id: string, setupUrlExistente: string | null) {
    // Si ya tiene URL de setup (pending_setup), mostrarla directamente
    if (setupUrlExistente) {
      setSetupUrl(setupUrlExistente)
      setActivandoId(id)
      return
    }
    setLoadingActivar(id)
    try {
      const res = await fetch(`/api/stripe/recurrentes/${id}/activar-cobro`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al activar', 'error'); return }
      if (data.activated) {
        // Suscripción creada directamente — tarjeta ya guardada, sin popup
        mostrarToast('¡Cobro automático activado!', 'exito')
        router.refresh()
        return
      }
      setSetupUrl(data.setup_url)
      setActivandoId(id)
      router.refresh()
    } catch {
      mostrarToast('Error de red. Inténtalo de nuevo.', 'error')
    } finally {
      setLoadingActivar(null)
    }
  }

  async function handleDesactivarCobro(id: string) {
    setLoadingDesactivar(id)
    try {
      const res = await fetch(`/api/stripe/recurrentes/${id}/desactivar-cobro`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { mostrarToast(data.error ?? 'Error al desactivar', 'error'); return }
      mostrarToast('Cobro automático desactivado', 'exito')
      router.refresh()
    } catch {
      mostrarToast('Error de red. Inténtalo de nuevo.', 'error')
    } finally {
      setLoadingDesactivar(null)
    }
  }

  function handleCopiarUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  function handleCopiarPortal(recurrenteId: string, stripeCustomerId: string, clienteNombre: string) {
    setPortalModal({ recurrenteId, customerId: stripeCustomerId, clienteNombre })
  }

  function handleCopiarUrlPortal() {
    if (!portalModal) return
    const portalUrl = `${window.location.origin}/api/stripe/recurrentes/${portalModal.recurrenteId}/portal-publico?cid=${portalModal.customerId}`
    navigator.clipboard.writeText(portalUrl).then(() => {
      setCopiadoPortal(true)
      setTimeout(() => setCopiadoPortal(false), 2000)
    })
  }

  // ── Vista principal ───────────────────────────────────────────────────────

  return (
    <>
      {/* Cabecera + botón nueva */}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400">Resumen</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg p-2 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300"
            title="Actualizar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <Link href="/facturas/recurrentes/nueva"
            className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva factura recurrente
          </Link>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
          <p className="text-xs font-medium text-green-600">MRR</p>
          <p className="mt-1 text-2xl font-bold text-green-800 dark:text-green-300">{formatCurrency(mrrTotal)}</p>
          <p className="mt-0.5 text-xs text-green-600 dark:text-green-400">ingresos / mes</p>
        </div>
        <div className="rounded-xl border border-blue-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">ARR</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatCurrency(arrTotal)}</p>
          <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">proyección anual</p>
        </div>
        <div className={`rounded-xl border p-4 ${numPendientes > 0 ? 'border-orange-200 bg-orange-50 dark:bg-yellow-900/20 dark:border-yellow-800' : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800'}`}>
          <p className={`text-xs font-medium ${numPendientes > 0 ? 'text-orange-600' : 'text-gray-500 dark:text-gray-400'}`}>
            Sin cobrar
          </p>
          <p className={`mt-1 text-2xl font-bold ${numPendientes > 0 ? 'text-orange-700' : 'text-gray-400 dark:text-gray-500'}`}>
            {numPendientes > 0 ? formatCurrency(totalPendiente) : '—'}
          </p>
          <p className={`mt-0.5 text-xs ${numPendientes > 0 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`}>
            {numPendientes > 0 ? `${numPendientes} factura${numPendientes !== 1 ? 's' : ''} acumulada${numPendientes !== 1 ? 's' : ''}` : 'todo cobrado'}
          </p>
        </div>
        <div className="rounded-xl border border-orange-100 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Próximo envío</p>
          {proximaFecha ? (
            <>
              <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{formatDate(proximaFecha)}</p>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{formatCurrency(importeProximoCiclo)} a facturar</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">Sin programadas</p>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {(['todas', 'activas', 'pausadas'] as Filtro[]).map((f) => {
          const etiquetas: Record<Filtro, string> = { todas: 'Todas', activas: 'Activas', pausadas: 'Pausadas' }
          const conteo = f === 'todas' ? recurrentes.length
            : f === 'activas' ? recurrentes.filter(r => r.activo).length
            : recurrentes.filter(r => !r.activo).length
          return (
            <button key={f} onClick={() => setFiltro(f)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                filtro === f ? 'bg-violet-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {etiquetas[f]}
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${filtro === f ? 'bg-violet-500' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                {conteo}
              </span>
            </button>
          )
        })}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {recurrentes.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">Sin facturas recurrentes</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Crea una factura recurrente y se generará automáticamente en cada ciclo.</p>
            <Link href="/facturas/recurrentes/nueva"
              className="mt-5 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
              Nueva factura recurrente
            </Link>
          </div>
        ) : filtradas.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No hay elementos que coincidan con el filtro.</div>
        ) : (
          <>
            {/* ── Desktop ── */}
            <table className="hidden w-full md:table">
              <colgroup>
                <col style={{ width: '18%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '22%' }} />
                <col style={{ width: '13%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {['Cliente', 'Nº Base', 'Importe', 'Frecuencia', 'Próximo envío', 'Ciclos cobrados', 'Estado'].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => {
                  const pendientes = (r.facturas_generadas ?? []).filter(f => f.estado === 'emitida' || f.estado === 'vencida').length
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="group cursor-pointer border-b border-gray-100 dark:border-gray-700 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                        onClick={() => router.push(`/facturas/recurrentes/${r.id}`)}
                      >
                        <td className="px-5 py-3.5 text-sm text-gray-700 dark:text-gray-300">
                          <div className="flex items-center gap-1.5">
                            {pendientes > 0 && (
                              <span className="flex h-2 w-2 rounded-full bg-orange-400" title={`${pendientes} pendientes`} />
                            )}
                            {r.facturas.clientes?.nombre ?? '—'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-medium text-gray-900 dark:text-gray-100">{r.facturas.numero}</td>
                        <td className="px-5 py-3.5 text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(r.facturas.total)}</td>
                        <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">{etiquetaFrecuencia(r.frecuencia)}</td>
                        <td className="px-5 py-3.5">
                          <CountdownBadge fecha={r.proxima_fecha} activo={r.activo} />
                        </td>
                        <td className="px-5 py-3.5">
                          <ResumenGeneradas facturas={r.facturas_generadas} />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                            {/* Badge de cobro automático si aplica */}
                            {(r.cobro_automatico || r.cobro_status !== 'manual') && (
                              <CobroStatusBadge status={r.cobro_status} />
                            )}
                            {/* Toggle pausar/activar — siempre visible */}
                            <button
                              onClick={() => handleToggle(r.id, r.activo)}
                              disabled={isPending}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                                r.activo
                                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                              }`}
                            >
                              {isPending ? '...' : r.activo ? 'Pausar recurrencia' : 'Activar recurrencia'}
                            </button>

                            {/* Botón activar cobro automático (solo si manual + cobros activos) */}
                            {r.cobro_status === 'manual' && cobrosActivos && (
                              <button
                                type="button"
                                onClick={() => handleActivarCobro(r.id, r.setup_url)}
                                disabled={loadingActivar === r.id}
                                className="flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-900/20 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                              >
                                {loadingActivar === r.id ? (
                                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                  </svg>
                                ) : (
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                )}
                                Cobro auto
                              </button>
                            )}

                            {/* Botón mostrar enlace de setup pendiente */}
                            {r.cobro_status === 'pending_setup' && r.setup_url && (
                              <button
                                type="button"
                                onClick={() => handleActivarCobro(r.id, r.setup_url)}
                                className="rounded-lg px-2 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                              >
                                Ver enlace
                              </button>
                            )}

                            {/* Botón copiar portal del cliente */}
                            {r.cobro_status === 'active' && r.stripe_customer_id && (
                              <button
                                type="button"
                                onClick={() => handleCopiarPortal(r.id, r.stripe_customer_id!, r.facturas.clientes?.nombre ?? '—')}
                                title="Copiar enlace de gestión para el cliente"
                                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-violet-50 hover:text-violet-600"
                              >
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Portal cliente
                              </button>
                            )}

                            {/* Botón desactivar cobro automático */}
                            {(r.cobro_status === 'active' || r.cobro_status === 'past_due' || r.cobro_status === 'pending_setup') && (
                              <button
                                type="button"
                                onClick={() => handleDesactivarCobro(r.id)}
                                disabled={loadingDesactivar === r.id}
                                title="Desactivar cobro automático"
                                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-500"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                </svg>
                              </button>
                            )}

                            {/* Botón eliminar (solo si modo manual) */}
                            {r.cobro_status === 'manual' && (
                              confirmandoId === r.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => handleEliminar(r.id)} disabled={isPending}
                                    className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700">Sí</button>
                                  <button onClick={() => setConfirmandoId(null)}
                                    className="rounded-lg border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400">No</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmandoId(r.id)} title="Eliminar"
                                  className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-500">
                                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>
                    </Fragment>
                  )
                })}
              </tbody>
            </table>

            {/* ── Móvil ── */}
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">
              {filtradas.map((r) => {
                const pendientes = r.facturas_generadas.filter(f => f.estado === 'emitida' || f.estado === 'vencida').length
                return (
                  <li key={r.id}>
                    <div
                      className="cursor-pointer px-5 py-4"
                      onClick={() => router.push(`/facturas/recurrentes/${r.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {pendientes > 0 && <span className="flex h-2 w-2 rounded-full bg-orange-400" />}
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                              {r.facturas.clientes?.nombre ?? '—'}
                            </p>
                          </div>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{r.facturas.numero} · {etiquetaFrecuencia(r.frecuencia)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(r.facturas.total)}</p>
                          <CountdownBadge fecha={r.proxima_fecha} activo={r.activo} />
                        </div>
                      </div>
                      <div className="mt-2">
                        <ResumenGeneradas facturas={r.facturas_generadas} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                        {/* Badge de cobro automático */}
                        {r.cobro_status !== 'manual' && (
                          <CobroStatusBadge status={r.cobro_status} />
                        )}

                        {/* Toggle pausar/activar — siempre visible */}
                        <button onClick={() => handleToggle(r.id, r.activo)} disabled={isPending}
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            r.activo
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                              : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                          }`}>
                          {isPending ? '...' : r.activo ? 'Pausar recurrencia' : 'Activar recurrencia'}
                        </button>

                        {/* Activar cobro automático (móvil) */}
                        {r.cobro_status === 'manual' && cobrosActivos && (
                          <button
                            type="button"
                            onClick={() => handleActivarCobro(r.id, r.setup_url)}
                            disabled={loadingActivar === r.id}
                            className="rounded-full bg-blue-50 dark:bg-blue-900/20 px-2.5 py-1 text-xs font-medium text-blue-700"
                          >
                            {loadingActivar === r.id ? 'Activando...' : '⚡ Cobro auto'}
                          </button>
                        )}

                        {/* Mostrar enlace pendiente (móvil) */}
                        {r.cobro_status === 'pending_setup' && r.setup_url && (
                          <button
                            type="button"
                            onClick={() => handleActivarCobro(r.id, r.setup_url)}
                            className="rounded-full bg-yellow-50 dark:bg-yellow-900/20 px-2.5 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400"
                          >
                            Ver enlace
                          </button>
                        )}

                        {/* Desactivar (móvil) */}
                        {(r.cobro_status === 'active' || r.cobro_status === 'past_due') && (
                          <button
                            type="button"
                            onClick={() => handleDesactivarCobro(r.id)}
                            disabled={loadingDesactivar === r.id}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Desactivar
                          </button>
                        )}

                        {r.cobro_status === 'manual' && (
                          confirmandoId === r.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleEliminar(r.id)} disabled={isPending}
                                className="rounded bg-red-600 px-2 py-1 text-xs text-white">Sí</button>
                              <button onClick={() => setConfirmandoId(null)}
                                className="rounded border border-gray-200 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-400">No</button>
                            </div>
                          ) : (
                            <button onClick={() => setConfirmandoId(r.id)} className="text-xs text-red-400 hover:text-red-600">
                              Eliminar
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {filtradas.length === recurrentes.length
                  ? `${recurrentes.length} factura${recurrentes.length !== 1 ? 's' : ''} recurrente${recurrentes.length !== 1 ? 's' : ''}`
                  : `${filtradas.length} de ${recurrentes.length}`}
                {' · '}
                {activas.length} activas
                {numPendientes > 0 && ` · `}
                {numPendientes > 0 && (
                  <span className="text-orange-600">{numPendientes} pendiente{numPendientes !== 1 ? 's' : ''} de cobro</span>
                )}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Panel de activación — aparece cuando se genera la URL de setup */}
      {activandoId && setupUrl && (
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
                onClick={() => { setActivandoId(null); setSetupUrl(null) }}
                className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="flex-1 truncate text-sm font-mono text-gray-700 dark:text-gray-300">{setupUrl}</p>
              <button
                type="button"
                onClick={() => handleCopiarUrl(setupUrl)}
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

      {/* Modal portal del cliente */}
      {portalModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center">
          <div className="w-full max-w-md rounded-t-2xl bg-white dark:bg-gray-800 p-6 shadow-xl sm:rounded-2xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900 dark:text-gray-100">Portal de gestión del cliente</p>
                <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                  Envía este enlace a <span className="font-medium text-gray-700 dark:text-gray-300">{portalModal.clienteNombre}</span> para
                  que pueda ver su historial de pagos, actualizar su tarjeta o cancelar la suscripción.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPortalModal(null)}
                className="ml-3 shrink-0 rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 px-3 py-2">
              <p className="flex-1 truncate font-mono text-sm text-gray-500 dark:text-gray-400">
                {window.location.origin}/api/stripe/recurrentes/…/portal-publico
              </p>
              <button
                type="button"
                onClick={handleCopiarUrlPortal}
                className="shrink-0 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700"
              >
                {copiadoPortal ? '✓ Copiado' : 'Copiar enlace'}
              </button>
            </div>
            <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
              El enlace redirige directamente al portal de Stripe — no requiere que el cliente tenga cuenta en FacturX.
            </p>
          </div>
        </div>
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </>
  )
}
