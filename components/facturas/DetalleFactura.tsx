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
