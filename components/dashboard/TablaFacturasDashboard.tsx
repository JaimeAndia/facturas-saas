'use client'

import { useState, useMemo, useCallback, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Toast, type TipoToast } from '@/components/ui/Toast'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface FacturaTabla {
  id: string
  numero: string
  cliente_nombre: string
  cliente_email: string | null
  fecha_emision: string
  fecha_vencimiento: string | null
  total: number
  estado: 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'cancelada'
  source: string | null
  payment_link_url: string | null
  reminders_sent: number
  last_reminder_at: string | null
}

type TabFiltro = 'todas' | 'emitida' | 'pagada' | 'vencida'

interface Props {
  facturas: FacturaTabla[]
  cobrosActivos: boolean
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const BADGE: Record<string, { label: string; clase: string }> = {
  pagada:    { label: 'Cobrada',    clase: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  emitida:   { label: 'Pendiente', clase: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  vencida:   { label: 'Vencida',   clase: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  cancelada: { label: 'Incobrable', clase: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
  borrador:  { label: 'Borrador',  clase: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400' },
}

const TABS: { valor: TabFiltro; label: string }[] = [
  { valor: 'todas',   label: 'Todas' },
  { valor: 'emitida', label: 'Pendientes' },
  { valor: 'vencida', label: 'Vencidas' },
  { valor: 'pagada',  label: 'Cobradas' },
]

// ─── Dropdown de acciones ─────────────────────────────────────────────────────

function AccionesDropdown({
  factura,
  cobrosActivos,
  onReminder,
  onMarkPaid,
}: {
  factura: FacturaTabla
  cobrosActivos: boolean
  onReminder: (f: FacturaTabla) => void
  onMarkPaid: (f: FacturaTabla) => void
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [abierto])

  const [copiadoLink, setCopiadoLink] = useState(false)

  async function copiarLink() {
    if (!factura.payment_link_url) return
    await navigator.clipboard.writeText(factura.payment_link_url)
    setCopiadoLink(true)
    setTimeout(() => setCopiadoLink(false), 2000)
    setAbierto(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto(v => !v)}
        className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300"
        title="Acciones"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm0 7a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
        </svg>
      </button>

      {abierto && (
        <div className="absolute right-0 top-8 z-20 w-52 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-1 shadow-lg">
          {/* Ver PDF */}
          <a
            href={`/api/facturas/${factura.id}/pdf`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            onClick={() => setAbierto(false)}
          >
            <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            Ver PDF
          </a>

          {/* Copiar link de cobro */}
          {factura.payment_link_url && cobrosActivos && (
            <button
              onClick={copiarLink}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              {copiadoLink ? 'Copiado ✓' : 'Copiar link de cobro'}
            </button>
          )}

          {/* Enviar recordatorio */}
          {(factura.estado === 'emitida' || factura.estado === 'vencida') && (
            <button
              onClick={() => { onReminder(factura); setAbierto(false) }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Enviar recordatorio
              {(factura.reminders_sent ?? 0) > 0 && (
                <span className="ml-auto rounded-full bg-orange-100 dark:bg-orange-900/30 px-1.5 py-0.5 text-xs text-orange-600 dark:text-orange-400">
                  {factura.reminders_sent}
                </span>
              )}
            </button>
          )}


          {/* Marcar como cobrada */}
          {factura.estado !== 'pagada' && factura.estado !== 'cancelada' && (
            <>
              <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
              <button
                onClick={() => { onMarkPaid(factura); setAbierto(false) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Marcar como cobrada
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal recordatorio ───────────────────────────────────────────────────────

function ModalRecordatorio({
  factura,
  onConfirmar,
  onCerrar,
  cargando,
}: {
  factura: FacturaTabla
  onConfirmar: () => void
  onCerrar: () => void
  cargando: boolean
}) {
  const siguiente = (factura.reminders_sent ?? 0) + 1
  const esUrgente = siguiente > 1

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onCerrar} />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-xl">
        <div className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${esUrgente ? 'bg-red-100 dark:bg-red-900/30' : 'bg-orange-100 dark:bg-orange-900/20'}`}>
          <svg className={`h-5 w-5 ${esUrgente ? 'text-red-600' : 'text-orange-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </div>
        <h3 className="mt-3 text-center text-base font-semibold text-gray-900 dark:text-gray-100">
          {esUrgente ? 'Recordatorio urgente' : 'Enviar recordatorio'}
        </h3>
        <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-900 p-3 text-sm text-gray-600 dark:text-gray-300">
          <p><span className="text-gray-400 dark:text-gray-500">Factura:</span> {factura.numero}</p>
          <p><span className="text-gray-400 dark:text-gray-500">Cliente:</span> {factura.cliente_nombre}</p>
          <p><span className="text-gray-400 dark:text-gray-500">Importe:</span> {formatCurrency(factura.total)}</p>
          {factura.cliente_email ? (
            <p><span className="text-gray-400 dark:text-gray-500">Email destino:</span> {factura.cliente_email}</p>
          ) : (
            <p className="mt-1 text-orange-600 text-xs">⚠ El cliente no tiene email — se registrará el recordatorio pero no se enviará email.</p>
          )}
        </div>
        <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">Recordatorio nº {siguiente}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCerrar}
            disabled={cargando}
            className="flex-1 rounded-lg border border-gray-200 dark:border-gray-600 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60 ${esUrgente ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'}`}
          >
            {cargando ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function TablaFacturasDashboard({ facturas: facturasProp, cobrosActivos }: Props) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // ── Filtros ──
  const [tab, setTab] = useState<TabFiltro>('todas')
  const [filtroCliente, setFiltroCliente] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [fechaDesde, setFechaDesde] = useState('')
  const [fechaHasta, setFechaHasta] = useState('')

  // ── Estado interactivo ──
  const [modalRecordatorio, setModalRecordatorio] = useState<FacturaTabla | null>(null)
  const [enviandoReminder, setEnviandoReminder] = useState(false)
  const [confirmandoPagadaId, setConfirmandoPagadaId] = useState<string | null>(null)
  const [marcandoPagadaId, setMarcandoPagadaId] = useState<string | null>(null)
  const [toast, setToast] = useState<{ mensaje: string; tipo: TipoToast } | null>(null)

  const mostrarToast = useCallback((mensaje: string, tipo: TipoToast) => setToast({ mensaje, tipo }), [])

  // ── Lista de clientes únicos para el dropdown ──
  const clientes = useMemo(() => {
    const set = new Set(facturasProp.map(f => f.cliente_nombre))
    return Array.from(set).sort()
  }, [facturasProp])

  // ── Filtrado ──
  const facturasFiltradas = useMemo(() => {
    return facturasProp.filter(f => {
      if (tab !== 'todas' && f.estado !== tab) return false
      if (filtroCliente && f.cliente_nombre !== filtroCliente) return false
      if (busqueda) {
        const q = busqueda.toLowerCase()
        if (!f.numero.toLowerCase().includes(q) && !f.cliente_nombre.toLowerCase().includes(q)) return false
      }
      if (fechaDesde && f.fecha_emision < fechaDesde) return false
      if (fechaHasta && f.fecha_emision > fechaHasta) return false
      return true
    })
  }, [facturasProp, tab, filtroCliente, busqueda, fechaDesde, fechaHasta])

  // ── Columnas TanStack Table ──
  const columns = useMemo<ColumnDef<FacturaTabla>[]>(() => {
    const cols: ColumnDef<FacturaTabla>[] = [
      {
        accessorKey: 'numero',
        header: 'Número',
        cell: ({ row }) => (
          <Link href={`/facturas/${row.original.id}`} className="font-medium text-blue-600 hover:underline">
            {row.original.numero}
          </Link>
        ),
      },
      {
        accessorKey: 'cliente_nombre',
        header: 'Cliente',
        cell: ({ getValue }) => (
          <span className="truncate text-sm text-gray-700 dark:text-gray-300">{getValue() as string}</span>
        ),
      },
      {
        accessorKey: 'fecha_emision',
        header: 'Fecha',
        cell: ({ getValue }) => (
          <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(getValue() as string)}</span>
        ),
      },
      {
        accessorKey: 'fecha_vencimiento',
        header: 'Vencimiento',
        cell: ({ getValue }) => {
          const v = getValue() as string | null
          if (!v) return <span className="text-sm text-gray-300 dark:text-gray-600">—</span>
          const esVencida = new Date(v) < new Date()
          return (
            <span className={`text-sm ${esVencida ? 'font-medium text-red-600' : 'text-gray-500 dark:text-gray-400'}`}>
              {formatDate(v)}
            </span>
          )
        },
      },
      {
        accessorKey: 'total',
        header: () => <span className="block text-right">Importe</span>,
        cell: ({ getValue }) => (
          <span className="block text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
            {formatCurrency(getValue() as number)}
          </span>
        ),
      },
      {
        id: 'estado',
        header: 'Estado',
        cell: ({ row }) => {
          if (row.original.source === 'recurrente_base') {
            return <span className="rounded-full bg-violet-100 dark:bg-violet-900/30 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-400">Recurrente</span>
          }
          const b = BADGE[row.original.estado] ?? BADGE.borrador
          return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.clase}`}>{b.label}</span>
        },
      },
    ]

    cols.push({
      id: 'acciones',
      header: '',
      cell: ({ row }) => {
        const f = row.original
        if (confirmandoPagadaId === f.id) {
          return (
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => handleConfirmarPagada(f.id)}
                disabled={marcandoPagadaId === f.id}
                className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {marcandoPagadaId === f.id ? '…' : 'Confirmar'}
              </button>
              <button
                onClick={() => setConfirmandoPagadaId(null)}
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
            </div>
          )
        }
        return (
          <div className="flex justify-end">
            <AccionesDropdown
              factura={f}
              cobrosActivos={cobrosActivos}
              onReminder={setModalRecordatorio}
              onMarkPaid={(fac) => setConfirmandoPagadaId(fac.id)}
            />
          </div>
        )
      },
    })

    return cols
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobrosActivos, confirmandoPagadaId, marcandoPagadaId])

  // ── TanStack Table ──
  const table = useReactTable({
    data: facturasFiltradas,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  })

  // ── Handlers ──

  async function handleEnviarRecordatorio() {
    if (!modalRecordatorio) return
    setEnviandoReminder(true)
    try {
      const res = await fetch(`/api/invoices/${modalRecordatorio.id}/reminder`, { method: 'POST' })
      const json = await res.json() as { ok?: boolean; emailSent?: boolean; error?: string }
      if (!res.ok) { mostrarToast(json.error ?? 'Error al enviar', 'error'); return }
      mostrarToast(
        json.emailSent ? 'Recordatorio enviado por email' : 'Recordatorio registrado (sin email)',
        'exito'
      )
      setModalRecordatorio(null)
      startTransition(() => router.refresh())
    } catch { mostrarToast('Error de conexión', 'error') }
    finally { setEnviandoReminder(false) }
  }

  async function handleConfirmarPagada(facturaId: string) {
    setMarcandoPagadaId(facturaId)
    try {
      const res = await fetch(`/api/invoices/${facturaId}/mark-paid`, { method: 'PATCH' })
      if (!res.ok) { mostrarToast('Error al marcar como cobrada', 'error'); return }
      mostrarToast('Factura marcada como cobrada', 'exito')
      setConfirmandoPagadaId(null)
      startTransition(() => router.refresh())
    } catch { mostrarToast('Error de conexión', 'error') }
    finally { setMarcandoPagadaId(null) }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const { pageIndex, pageSize } = table.getState().pagination
  const totalPaginas = table.getPageCount()

  return (
    <div className="space-y-3">
      {/* ── Filtros ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-700">
          {TABS.map(({ valor, label }) => (
            <button
              key={valor}
              onClick={() => { setTab(valor); table.setPageIndex(0) }}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                tab === valor
                  ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-600 dark:text-gray-100'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Selector cliente */}
        <select
          value={filtroCliente}
          onChange={e => { setFiltroCliente(e.target.value); table.setPageIndex(0) }}
          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
        >
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Rango fechas */}
        <input
          type="date"
          value={fechaDesde}
          onChange={e => { setFechaDesde(e.target.value); table.setPageIndex(0) }}
          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          title="Desde"
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          type="date"
          value={fechaHasta}
          onChange={e => { setFechaHasta(e.target.value); table.setPageIndex(0) }}
          className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
          title="Hasta"
        />

        {/* Buscador */}
        <div className="relative ml-auto">
          <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Buscar factura o cliente…"
            value={busqueda}
            onChange={e => { setBusqueda(e.target.value); table.setPageIndex(0) }}
            className="h-8 w-52 rounded-lg border border-gray-200 bg-white pl-8 pr-3 text-xs text-gray-700 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* ── Tabla ── */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
                {table.getHeaderGroups().map(hg =>
                  hg.headers.map(header => (
                    <th key={header.id} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    No hay facturas que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Paginación ── */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 dark:border-gray-700">
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {pageIndex * pageSize + 1}–{Math.min((pageIndex + 1) * pageSize, facturasFiltradas.length)} de {facturasFiltradas.length}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-700"
              >
                ← Anterior
              </button>
              <button
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                className="rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal recordatorio ── */}
      {modalRecordatorio && (
        <ModalRecordatorio
          factura={modalRecordatorio}
          onConfirmar={handleEnviarRecordatorio}
          onCerrar={() => setModalRecordatorio(null)}
          cargando={enviandoReminder}
        />
      )}

      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />}
    </div>
  )
}
