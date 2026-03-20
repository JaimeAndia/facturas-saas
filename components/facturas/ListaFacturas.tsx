'use client'

import { useState, useEffect, useTransition, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Toast, type TipoToast } from '@/components/ui/Toast'
import { eliminarFactura } from '@/app/(dashboard)/facturas/actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Factura, Cliente } from '@/types'

// Icono tarjeta de crédito (cobro)
function IconoCobro({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
  )
}

interface FacturaConCliente extends Factura {
  clientes: Pick<Cliente, 'nombre' | 'email'> | null
}

interface ListaFacturasProps {
  facturas: FacturaConCliente[]
  cobrosActivos?: boolean
}

const ESTADOS = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'emitida', etiqueta: 'Emitida' },
  { valor: 'pagada', etiqueta: 'Pagada' },
  { valor: 'vencida', etiqueta: 'Vencida' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
]

export const BADGE_ESTADO: Record<string, string> = {
  borrador: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  emitida: 'bg-blue-100 dark:bg-blue-900/20 text-blue-700',
  pagada: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  vencida: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  cancelada: 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500',
}

export function ListaFacturas({ facturas: facturasProp, cobrosActivos = false }: ListaFacturasProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [facturas, setFacturas] = useState(facturasProp)
  useEffect(() => { setFacturas(facturasProp) }, [facturasProp])

  const [busqueda, setBusqueda] = useState('')
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ mensaje: string; tipo: TipoToast } | null>(null)

  // Estado para links de pago: id -> url generada
  const [paymentLinks, setPaymentLinks] = useState<Record<string, string>>(() => {
    const inicial: Record<string, string> = {}
    for (const f of facturasProp) {
      if (f.payment_link_url) inicial[f.id] = f.payment_link_url
    }
    return inicial
  })
  // Qué panel de link está abierto
  const [linkAbiertoId, setLinkAbiertoId] = useState<string | null>(null)
  // Qué factura está generando su link
  const [generandoLinkId, setGenerandoLinkId] = useState<string | null>(null)
  // Feedback de copiado
  const [copiadoId, setCopiadoId] = useState<string | null>(null)

  const mostrarToast = useCallback((mensaje: string, tipo: TipoToast) => {
    setToast({ mensaje, tipo })
  }, [])

  async function handleGenerarLink(facturaId: string) {
    // Si ya tenemos la URL, solo abrir/cerrar el panel
    if (paymentLinks[facturaId]) {
      setLinkAbiertoId(prev => prev === facturaId ? null : facturaId)
      return
    }

    setGenerandoLinkId(facturaId)
    try {
      const res = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: facturaId }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        mostrarToast(json.error ?? 'Error generando el link', 'error')
        return
      }
      setPaymentLinks(prev => ({ ...prev, [facturaId]: json.url! }))
      setLinkAbiertoId(facturaId)
    } catch {
      mostrarToast('Error de conexión', 'error')
    } finally {
      setGenerandoLinkId(null)
    }
  }

  async function handleCopiarLink(facturaId: string) {
    const url = paymentLinks[facturaId]
    if (!url) return
    await navigator.clipboard.writeText(url)
    setCopiadoId(facturaId)
    setTimeout(() => setCopiadoId(null), 2000)
  }

  // Filtrado client-side: solo búsqueda por texto (estado/cliente/fecha vienen filtrados del servidor)
  const facturasFiltradas = facturas.filter((f) => {
    const q = busqueda.toLowerCase().trim()
    return (
      !q ||
      f.numero.toLowerCase().includes(q) ||
      (f.clientes?.nombre ?? '').toLowerCase().includes(q)
    )
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

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Buscador */}
        <div className="relative w-full sm:max-w-xs">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
            fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar por número o cliente..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 pl-9 pr-3 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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

      {/* Tabla */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        {facturas.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-gray-900 dark:text-gray-100">Sin facturas</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Crea tu primera factura ahora.</p>
            <div className="mt-5">
              <Link href="/facturas/nueva"><Button>Crear factura</Button></Link>
            </div>
          </div>
        ) : facturasFiltradas.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            No hay facturas que coincidan con el filtro aplicado.
          </div>
        ) : (
          <>
            {/* ── TABLA DESKTOP ──────────────────────────────────────── */}
            <table className="hidden w-full md:table">
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '20%' }} />
              </colgroup>
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  {(['Número','Cliente','Fecha','Estado'] as const).map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">{h}</th>
                  ))}
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Total</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {facturasFiltradas.map((factura) => (
                  <Fragment key={factura.id}>
                    <tr>
                      <td className="px-5 py-3.5">
                        <Link href={`/facturas/${factura.id}`}
                          className="text-sm font-medium text-blue-600 hover:underline">
                          {factura.numero}
                        </Link>
                      </td>
                      <td className="max-w-0 px-5 py-3.5">
                        <span className="block truncate text-sm text-gray-600 dark:text-gray-300">
                          {factura.clientes?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(factura.fecha_emision)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO[factura.estado] ?? ''}`}>
                            {ESTADOS.find(e => e.valor === factura.estado)?.etiqueta ?? factura.estado}
                          </span>
                          {factura.factura_recurrente_id && (
                            <Link href={`/facturas/recurrentes/${factura.factura_recurrente_id}`}
                              className="w-fit rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50">
                              ↻ Recurrente
                            </Link>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(factura.total)}
                      </td>
                      <td className="px-5 py-3.5">
                        {confirmandoId === factura.id ? (
                          <div className="flex items-center gap-1">
                            <Button variante="peligro" tamaño="sm" cargando={isPending}
                              onClick={() => handleEliminar(factura.id)}>Sí</Button>
                            <Button variante="secundario" tamaño="sm" disabled={isPending}
                              onClick={() => setConfirmandoId(null)}>No</Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-1">
                            {/* Botón Cobrar — solo facturas emitidas no recurrentes */}
                            {factura.estado === 'emitida' && !factura.factura_recurrente_id && (
                              !cobrosActivos ? (
                                <span className="group relative mr-2">
                                  <button
                                    disabled
                                    className="flex cursor-not-allowed items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500"
                                  >
                                    <IconoCobro className="h-3.5 w-3.5" />
                                    Cobrar
                                  </button>
                                  <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-gray-800 px-2.5 py-1.5 text-center text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                                    Activa tu cuenta en Configuración → Cobros para activar
                                  </span>
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleGenerarLink(factura.id)}
                                  disabled={generandoLinkId === factura.id}
                                  title={paymentLinks[factura.id] ? 'Ver link de cobro para enviar al cliente' : 'Generar link para que el cliente pague online'}
                                  className={`mr-2 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                                    paymentLinks[factura.id]
                                      ? 'bg-emerald-50 dark:bg-green-900/20 text-emerald-700 dark:text-green-400 hover:bg-emerald-100 dark:hover:bg-green-900/30'
                                      : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                                  }`}
                                >
                                  {generandoLinkId === factura.id ? (
                                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                  ) : paymentLinks[factura.id] ? (
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                  ) : (
                                    <IconoCobro className="h-3.5 w-3.5" />
                                  )}
                                  {paymentLinks[factura.id] ? 'Link de cobro' : 'Cobrar online'}
                                </button>
                              )
                            )}
                            <Link href={`/blockchain?factura=${factura.id}`}
                              className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-400 dark:text-gray-500 hover:bg-violet-50 hover:text-violet-600"
                              title="Ver verificación blockchain">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                              </svg>
                              Ver verificación
                            </Link>
                            <Link href={`/facturas/${factura.id}`}
                              className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-blue-50 hover:text-blue-600"
                              title="Ver factura">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </Link>
                            <button onClick={() => setConfirmandoId(factura.id)} title="Eliminar"
                              className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-600">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                    {/* Panel del link expandido */}
                    {linkAbiertoId === factura.id && paymentLinks[factura.id] && (
                      <tr>
                        <td colSpan={6} className="px-5 pb-3">
                          <div className="rounded-lg border border-emerald-200 dark:border-green-800 bg-emerald-50 dark:bg-green-900/20 p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-semibold text-emerald-800 dark:text-green-300">Link de cobro listo</p>
                                <span className="flex items-center gap-0.5 rounded-full bg-blue-100 dark:bg-blue-900/20 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                  </svg>
                                  Stripe
                                </span>
                              </div>
                              <p className="text-xs text-emerald-600 dark:text-green-400">Envíaselo al cliente para que pague online</p>
                              <button onClick={() => setLinkAbiertoId(null)} className="text-emerald-500 hover:text-emerald-700">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                            <div className="flex items-center gap-2 rounded-md bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700">
                              <span className="min-w-0 flex-1 truncate">{paymentLinks[factura.id]}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              <button onClick={() => handleCopiarLink(factura.id)}
                                className="flex items-center gap-1 rounded-md bg-white dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                {copiadoId === factura.id ? (
                                  <><svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>Copiado</>
                                ) : (
                                  <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>Copiar</>
                                )}
                              </button>
                              {/* Email — solo si el cliente tiene email */}
                              {factura.clientes?.email && (
                                <a
                                  href={`mailto:${factura.clientes.email}?subject=${encodeURIComponent(`Factura ${factura.numero} — link de pago`)}&body=${encodeURIComponent(`Hola,\n\nTe envío el link para pagar la factura ${factura.numero}:\n\n${paymentLinks[factura.id]}\n\nGracias.`)}`}
                                  className="flex items-center gap-1 rounded-md bg-gray-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-800"
                                >
                                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                  </svg>
                                  Email
                                </a>
                              )}
                              <a href={`https://wa.me/?text=${encodeURIComponent(`Hola, te comparto el link para pagar la factura ${factura.numero}: ${paymentLinks[factura.id]}`)}`}
                                target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#1ebe5d]">
                                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                WhatsApp
                              </a>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>

            {/* ── LISTA MÓVIL ────────────────────────────────────────── */}
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 md:hidden">
              {facturasFiltradas.map((factura) => (
                <li key={factura.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <Link href={`/facturas/${factura.id}`}
                      className="min-w-0 text-sm font-medium text-blue-600 hover:underline">
                      {factura.numero}
                    </Link>
                    <span className="ml-auto text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(factura.total)}
                    </span>
                    <div className="flex items-center gap-0.5">
                      <Link href={`/blockchain?factura=${factura.id}`}
                        className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-violet-50 hover:text-violet-600"
                        title="Ver verificación blockchain">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </Link>
                      <Link href={`/facturas/${factura.id}`}
                        className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-blue-50 hover:text-blue-600">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400">{factura.clientes?.nombre ?? '—'}</span>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">{formatDate(factura.fecha_emision)}</span>
                    <div className="ml-auto flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO[factura.estado] ?? ''}`}>
                        {ESTADOS.find(e => e.valor === factura.estado)?.etiqueta}
                      </span>
                      {factura.factura_recurrente_id && (
                        <Link href={`/facturas/recurrentes/${factura.factura_recurrente_id}`}
                          className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 hover:bg-violet-200">
                          ↻ Recurrente
                        </Link>
                      )}
                    </div>
                  </div>
                  {factura.estado === 'emitida' && !factura.factura_recurrente_id && (
                    <div className="mt-2">
                      {!cobrosActivos ? (
                        <a href="/configuracion" className="flex w-fit items-center gap-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-400 dark:text-gray-500">
                          <IconoCobro className="h-3.5 w-3.5" />
                          Activa tu cuenta en Configuración → Cobros
                        </a>
                      ) : (
                        <button
                          onClick={() => handleGenerarLink(factura.id)}
                          disabled={generandoLinkId === factura.id}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                            paymentLinks[factura.id]
                              ? 'bg-emerald-50 dark:bg-green-900/20 text-emerald-700 dark:text-green-400'
                              : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                          }`}
                        >
                          {generandoLinkId === factura.id ? (
                            <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : paymentLinks[factura.id] ? (
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <IconoCobro className="h-3.5 w-3.5" />
                          )}
                          {paymentLinks[factura.id] ? 'Link de cobro' : 'Cobrar online'}
                        </button>
                      )}
                    </div>
                  )}
                  {/* Panel link en móvil */}
                  {linkAbiertoId === factura.id && paymentLinks[factura.id] && (
                    <div className="mt-3 rounded-lg border border-emerald-200 dark:border-green-800 bg-emerald-50 dark:bg-green-900/20 p-3">
                      <div className="flex items-center gap-2 rounded-md bg-white dark:bg-gray-800 px-2.5 py-1.5 text-xs text-gray-600 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700">
                        <span className="min-w-0 flex-1 truncate">{paymentLinks[factura.id]}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button onClick={() => handleCopiarLink(factura.id)}
                          className="flex items-center gap-1 rounded-md bg-white dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 ring-1 ring-gray-200 dark:ring-gray-700">
                          {copiadoId === factura.id ? 'Copiado ✓' : 'Copiar'}
                        </button>
                        {factura.clientes?.email && (
                          <a
                            href={`mailto:${factura.clientes.email}?subject=${encodeURIComponent(`Factura ${factura.numero} — link de pago`)}&body=${encodeURIComponent(`Hola,\n\nTe envío el link para pagar la factura ${factura.numero}:\n\n${paymentLinks[factura.id]}\n\nGracias.`)}`}
                            className="flex items-center gap-1 rounded-md bg-gray-700 px-2.5 py-1 text-xs font-medium text-white"
                          >
                            Email
                          </a>
                        )}
                        <a href={`https://wa.me/?text=${encodeURIComponent(`Factura ${factura.numero}: ${paymentLinks[factura.id]}`)}`}
                          target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 rounded-md bg-[#25D366] px-2.5 py-1 text-xs font-medium text-white">
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 dark:border-gray-700 px-5 py-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">
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
