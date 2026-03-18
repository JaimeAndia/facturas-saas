'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Toast, type TipoToast } from '@/components/ui/Toast'
import {
  actualizarEstadoFactura,
  duplicarFactura,
  eliminarFactura,
} from '@/app/(dashboard)/facturas/actions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { BADGE_ESTADO } from '@/components/facturas/ListaFacturas'
import type { Factura, LineaFactura, Cliente, Profile } from '@/types'

interface FacturaDetalle extends Factura {
  lineas: LineaFactura[]
  cliente: Cliente
}

interface DetalleFacturaProps {
  factura: FacturaDetalle
  perfil: Pick<Profile, 'nombre' | 'apellidos' | 'nif' | 'direccion' | 'ciudad' | 'codigo_postal' | 'provincia' | 'email' | 'telefono'>
}

const ESTADOS_CAMBIO = [
  { valor: 'borrador', etiqueta: 'Borrador' },
  { valor: 'emitida', etiqueta: 'Emitida' },
  { valor: 'pagada', etiqueta: 'Pagada' },
  { valor: 'vencida', etiqueta: 'Vencida' },
  { valor: 'cancelada', etiqueta: 'Cancelada' },
] as const

export function DetalleFactura({ factura, perfil }: DetalleFacturaProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ mensaje: string; tipo: TipoToast } | null>(null)
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const [paymentLinkUrl, setPaymentLinkUrl] = useState<string | null>(factura.payment_link_url ?? null)
  const [generandoLink, setGenerandoLink] = useState(false)
  const [linkVisible, setLinkVisible] = useState(false)
  const [copiado, setCopiado] = useState(false)

  function mostrarToast(mensaje: string, tipo: TipoToast) {
    setToast({ mensaje, tipo })
  }

  function handleCambiarEstado(nuevoEstado: string) {
    startTransition(async () => {
      const resultado = await actualizarEstadoFactura(
        factura.id,
        nuevoEstado as 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'cancelada'
      )
      if (resultado.ok) {
        mostrarToast('Estado actualizado', 'exito')
        router.refresh()
      } else {
        mostrarToast(resultado.error, 'error')
      }
    })
  }

  function handleDuplicar() {
    startTransition(async () => {
      const resultado = await duplicarFactura(factura.id)
      if (resultado.ok && resultado.datos) {
        mostrarToast('Factura duplicada como borrador', 'exito')
        router.push(`/facturas/${resultado.datos.id}`)
      } else if (!resultado.ok) {
        mostrarToast(resultado.error, 'error')
      }
    })
  }

  function handleEliminar() {
    startTransition(async () => {
      const resultado = await eliminarFactura(factura.id)
      if (resultado.ok) {
        router.push('/facturas')
      } else {
        mostrarToast(resultado.error, 'error')
        setConfirmandoEliminar(false)
      }
    })
  }

  async function handleGenerarLink() {
    if (paymentLinkUrl) {
      setLinkVisible(v => !v)
      return
    }
    setGenerandoLink(true)
    try {
      const res = await fetch('/api/stripe/payment-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: factura.id }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        mostrarToast(json.error ?? 'Error generando el link', 'error')
        return
      }
      setPaymentLinkUrl(json.url)
      setLinkVisible(true)
    } catch {
      mostrarToast('Error de conexión', 'error')
    } finally {
      setGenerandoLink(false)
    }
  }

  async function handleCopiarLink() {
    if (!paymentLinkUrl) return
    await navigator.clipboard.writeText(paymentLinkUrl)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  function handleEnviarEmail() {
    startTransition(async () => {
      const res = await fetch(`/api/facturas/${factura.id}/enviar`, { method: 'POST' })
      const json = await res.json() as { ok?: boolean; error?: string }
      if (json.ok) {
        mostrarToast('Email enviado con el PDF adjunto', 'exito')
        router.refresh()
      } else {
        mostrarToast(json.error ?? 'Error enviando el email', 'error')
      }
    })
  }

  const nombreEmisor = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') || 'Sin nombre'
  const direccionEmisor = [perfil.direccion, perfil.ciudad, perfil.codigo_postal, perfil.provincia]
    .filter(Boolean).join(', ')
  const direccionCliente = [factura.cliente.direccion, factura.cliente.ciudad, factura.cliente.codigo_postal, factura.cliente.provincia]
    .filter(Boolean).join(', ')

  return (
    <div className="space-y-5">
      {/* Toolbar de acciones */}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/facturas">
          <Button variante="fantasma" tamaño="sm">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </Button>
        </Link>

        {/* Cambiar estado */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5">
          <span className="text-xs text-gray-500">Estado:</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO[factura.estado] ?? ''}`}>
            {ESTADOS_CAMBIO.find(e => e.valor === factura.estado)?.etiqueta ?? factura.estado}
          </span>
          <select
            value={factura.estado}
            onChange={(e) => handleCambiarEstado(e.target.value)}
            disabled={isPending}
            className="border-0 bg-transparent text-xs text-gray-500 focus:outline-none focus:ring-0 cursor-pointer"
          >
            {ESTADOS_CAMBIO.map((e) => (
              <option key={e.valor} value={e.valor}>{e.etiqueta}</option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          {/* Descargar PDF */}
          <a
            href={`/api/facturas/${factura.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variante="secundario" tamaño="sm">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Descargar PDF
            </Button>
          </a>

          {/* Enviar por email */}
          <Button
            variante="secundario"
            tamaño="sm"
            cargando={isPending}
            onClick={handleEnviarEmail}
            disabled={!factura.cliente.email}
            title={!factura.cliente.email ? 'El cliente no tiene email' : undefined}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Enviar email
          </Button>

          {/* Recordatorios automáticos — solo facturas vencidas */}
          {factura.estado === 'vencida' && (
            <div
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5"
              title={
                factura.reminders_sent >= 3
                  ? 'Se han enviado los 3 recordatorios automáticos'
                  : `${factura.reminders_sent} de 3 recordatorios enviados — el siguiente se envía automáticamente`
              }
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className={`text-xs font-medium ${factura.reminders_sent >= 3 ? 'text-gray-400' : 'text-gray-600'}`}>
                {factura.reminders_sent >= 3
                  ? 'Recordatorios agotados'
                  : `${factura.reminders_sent}/3 recordatorios`}
              </span>
              {/* Indicadores visuales */}
              <div className="flex gap-0.5">
                {[1, 2, 3].map((n) => (
                  <span
                    key={n}
                    className={`h-1.5 w-1.5 rounded-full ${
                      n <= factura.reminders_sent
                        ? n === 3 ? 'bg-red-500' : n === 2 ? 'bg-orange-400' : 'bg-amber-400'
                        : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Link de pago — solo para facturas emitidas */}
          {factura.estado === 'emitida' && (
            <Button
              variante="secundario"
              tamaño="sm"
              cargando={generandoLink}
              onClick={handleGenerarLink}
              title={paymentLinkUrl ? 'Ver link de cobro para enviar al cliente' : 'Generar link de cobro para que el cliente pague online'}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              {paymentLinkUrl ? 'Link de cobro' : 'Enviar link de cobro'}
            </Button>
          )}

          {/* Duplicar */}
          <Button
            variante="secundario"
            tamaño="sm"
            cargando={isPending}
            onClick={handleDuplicar}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Duplicar
          </Button>

          {/* Eliminar */}
          {confirmandoEliminar ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">¿Eliminar?</span>
              <Button variante="peligro" tamaño="sm" cargando={isPending} onClick={handleEliminar}>Sí</Button>
              <Button variante="secundario" tamaño="sm" onClick={() => setConfirmandoEliminar(false)}>No</Button>
            </div>
          ) : (
            <Button variante="peligro" tamaño="sm" onClick={() => setConfirmandoEliminar(true)}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </Button>
          )}
        </div>
      </div>

      {/* Banner: factura pertenece a una recurrente */}
      {factura.factura_recurrente_id && (
        <div className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
          <svg className="h-4 w-4 shrink-0 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <p className="text-sm text-violet-700">
            Esta factura forma parte de una suscripción recurrente.{' '}
            <Link
              href={`/facturas/recurrentes/${factura.factura_recurrente_id}`}
              className="font-semibold underline hover:text-violet-900"
            >
              Ver recurrente →
            </Link>
          </p>
        </div>
      )}

      {/* Panel del link de pago */}
      {linkVisible && paymentLinkUrl && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-emerald-800">Link de cobro listo para enviar</p>
              <span className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Stripe
              </span>
            </div>
            <button onClick={() => setLinkVisible(false)} className="text-emerald-500 hover:text-emerald-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mb-2 text-xs text-emerald-700">Envía este link a tu cliente para que pague online con tarjeta o transferencia bancaria.</p>
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm text-gray-600 ring-1 ring-gray-200">
            <span className="min-w-0 flex-1 truncate">{paymentLinkUrl}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCopiarLink}
              className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50"
            >
              {copiado ? (
                <>
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copiado
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copiar link
                </>
              )}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(`Hola, te comparto el link para pagar la factura ${factura.numero}: ${paymentLinkUrl}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-[#25D366] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#1ebe5d]"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Compartir por WhatsApp
            </a>
          </div>
        </div>
      )}

      {/* Vista previa de la factura */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 md:p-10 print:border-0 print:p-0">
        {/* Cabecera */}
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">FACTURA</h1>
            <p className="mt-1 text-lg font-semibold text-blue-600">{factura.numero}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="font-semibold text-gray-900">{nombreEmisor}</p>
            {perfil.nif && <p className="text-sm text-gray-500">NIF: {perfil.nif}</p>}
            {direccionEmisor && <p className="text-sm text-gray-500">{direccionEmisor}</p>}
            {perfil.email && <p className="text-sm text-gray-500">{perfil.email}</p>}
            {perfil.telefono && <p className="text-sm text-gray-500">{perfil.telefono}</p>}
          </div>
        </div>

        {/* Fechas */}
        <div className="mt-6 grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4 md:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-gray-400">Fecha de emisión</p>
            <p className="text-sm font-medium text-gray-900">{formatDate(factura.fecha_emision)}</p>
          </div>
          {factura.fecha_vencimiento && (
            <div>
              <p className="text-xs font-medium text-gray-400">Fecha de vencimiento</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(factura.fecha_vencimiento)}</p>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-gray-400">Estado</p>
            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_ESTADO[factura.estado] ?? ''}`}>
              {ESTADOS_CAMBIO.find(e => e.valor === factura.estado)?.etiqueta ?? factura.estado}
            </span>
          </div>
          {factura.paid_at && (
            <div>
              <p className="text-xs font-medium text-gray-400">Fecha de cobro</p>
              <p className="text-sm font-medium text-green-700">
                {new Intl.DateTimeFormat('es-ES', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }).format(new Date(factura.paid_at))}
              </p>
            </div>
          )}
        </div>

        {/* Datos del cliente */}
        <div className="mt-6">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Facturado a</p>
          <p className="font-semibold text-gray-900">{factura.cliente.nombre}</p>
          {factura.cliente.nif && <p className="text-sm text-gray-500">NIF: {factura.cliente.nif}</p>}
          {direccionCliente && <p className="text-sm text-gray-500">{direccionCliente}</p>}
          {factura.cliente.email && <p className="text-sm text-gray-500">{factura.cliente.email}</p>}
        </div>

        {/* Líneas de factura */}
        <div className="mt-8">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-400">
                <th className="pb-2 pr-4">Descripción</th>
                <th className="pb-2 pr-4 text-right">Cantidad</th>
                <th className="pb-2 pr-4 text-right">Precio unit.</th>
                <th className="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {factura.lineas
                .sort((a, b) => a.orden - b.orden)
                .map((linea) => (
                  <tr key={linea.id}>
                    <td className="py-3 pr-4 text-sm text-gray-900">{linea.descripcion}</td>
                    <td className="py-3 pr-4 text-right text-sm text-gray-600">{linea.cantidad}</td>
                    <td className="py-3 pr-4 text-right text-sm text-gray-600">{formatCurrency(linea.precio_unitario)}</td>
                    <td className="py-3 text-right text-sm font-medium text-gray-900">{formatCurrency(linea.subtotal)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="mt-6 flex justify-end">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Base imponible</span>
              <span className="font-medium text-gray-900">{formatCurrency(factura.base_imponible)}</span>
            </div>
            {factura.iva_porcentaje > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IVA ({factura.iva_porcentaje}%)</span>
                <span className="font-medium text-gray-900">+ {formatCurrency(factura.iva_importe)}</span>
              </div>
            )}
            {factura.irpf_porcentaje > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">IRPF ({factura.irpf_porcentaje}%)</span>
                <span className="font-medium text-red-600">− {formatCurrency(factura.irpf_importe)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-xl font-bold text-blue-600">{formatCurrency(factura.total)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        {factura.notas && (
          <div className="mt-8 border-t border-gray-100 pt-5">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Notas</p>
            <p className="whitespace-pre-line text-sm text-gray-600">{factura.notas}</p>
          </div>
        )}
      </div>

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </div>
  )
}
