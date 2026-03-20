'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { crearFacturaRecurrente } from '@/app/(dashboard)/facturas/recurrentes/actions'
import { formatCurrency, etiquetaFrecuencia } from '@/lib/utils'
import type { Cliente } from '@/types'

interface LineaFormulario {
  _id: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  orden: number
}

interface Props {
  clientes: Pick<Cliente, 'id' | 'nombre' | 'nif'>[]
}

// Mismo combobox de búsqueda que en FormFactura
function SelectorCliente({ clientes, value, onChange, error }: {
  clientes: Pick<Cliente, 'id' | 'nombre' | 'nif'>[]
  value: string
  onChange: (id: string) => void
  error?: string
}) {
  const clienteActual = clientes.find((c) => c.id === value) ?? null
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setAbierto(false); setBusqueda('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtrados = busqueda.trim()
    ? clientes.filter(c => c.nombre.toLowerCase().includes(busqueda.toLowerCase()) || (c.nif ?? '').toLowerCase().includes(busqueda.toLowerCase()))
    : clientes

  return (
    <div ref={ref} className="relative">
      <div
        className={`flex h-10 w-full items-center gap-2 rounded-lg border bg-white dark:bg-gray-800 px-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-blue-500/20 ${error ? 'border-red-400' : 'border-gray-300 dark:border-gray-600 focus-within:border-blue-500'}`}
        onClick={() => !abierto && setAbierto(true)}
      >
        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {clienteActual && !abierto ? (
          <span className="flex-1 truncate text-gray-900 dark:text-gray-100">
            {clienteActual.nombre}
            {clienteActual.nif && <span className="ml-1.5 text-gray-400 dark:text-gray-500">{clienteActual.nif}</span>}
          </span>
        ) : (
          <input
            type="text" autoComplete="off"
            placeholder={clienteActual ? clienteActual.nombre : 'Buscar cliente…'}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setAbierto(true) }}
            onFocus={() => setAbierto(true)}
            className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
          />
        )}
        {clienteActual && (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); setBusqueda('') }}
            className="rounded p-0.5 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      {abierto && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
          {filtrados.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500">Sin resultados</p>
          ) : (
            <ul>
              {filtrados.map(c => (
                <li key={c.id}>
                  <button type="button" onClick={() => { onChange(c.id); setBusqueda(''); setAbierto(false) }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-gray-700 ${c.id === value ? 'bg-blue-50 dark:bg-gray-700 font-medium text-blue-700' : 'text-gray-900 dark:text-gray-100'}`}>
                    <span>{c.nombre}</span>
                    {c.nif && <span className="ml-3 text-xs text-gray-400 dark:text-gray-500">{c.nif}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

type UnidadPersonalizada = 'dias' | 'semanas' | 'meses'

const IVA_OPCIONES = [
  { valor: 21, etiqueta: '21%' },
  { valor: 10, etiqueta: '10%' },
  { valor: 4,  etiqueta: '4%' },
  { valor: 0,  etiqueta: 'Exento' },
]
const IRPF_OPCIONES = [19, 15, 7, 0] as const
const FRECUENCIAS = [
  { valor: 'mensual',     etiqueta: 'Mensual',     desc: 'Cada mes' },
  { valor: 'trimestral',  etiqueta: 'Trimestral',  desc: 'Cada 3 meses' },
  { valor: 'anual',       etiqueta: 'Anual',        desc: 'Cada año' },
  { valor: 'personalizado', etiqueta: 'Personalizado', desc: 'Elige el intervalo' },
] as const

function crearLinea(orden: number): LineaFormulario {
  return { _id: crypto.randomUUID(), descripcion: '', cantidad: 1, precioUnitario: 0, orden }
}

export function FormFacturaRecurrente({ clientes }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const hoy = new Date().toISOString().split('T')[0]

  const [clienteId, setClienteId] = useState('')
  const [fechaEmision, setFechaEmision] = useState(hoy)
  const [frecuenciaBase, setFrecuenciaBase] = useState<'mensual' | 'trimestral' | 'anual' | 'personalizado'>('mensual')
  const [customN, setCustomN] = useState(15)
  const [customUnidad, setCustomUnidad] = useState<UnidadPersonalizada>('dias')

  // Valor de frecuencia que se envía al servidor
  const frecuencia = frecuenciaBase === 'personalizado'
    ? `personalizado_${customN}_${customUnidad}`
    : frecuenciaBase
  const [ivaPorcentaje, setIvaPorcentaje] = useState(21)
  const [irpfPorcentaje, setIrpfPorcentaje] = useState(15)
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<LineaFormulario[]>([crearLinea(0)])
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  const subtotales = lineas.map(l => parseFloat((l.cantidad * l.precioUnitario).toFixed(2)))
  const baseImponible = parseFloat(subtotales.reduce((s, v) => s + v, 0).toFixed(2))
  const ivaImporte = parseFloat(((baseImponible * ivaPorcentaje) / 100).toFixed(2))
  const irpfImporte = parseFloat(((baseImponible * irpfPorcentaje) / 100).toFixed(2))
  const total = parseFloat((baseImponible + ivaImporte - irpfImporte).toFixed(2))

  function actualizarLinea(id: string, campo: 'descripcion' | 'cantidad' | 'precioUnitario', valor: string) {
    setLineas(prev => prev.map(l => {
      if (l._id !== id) return l
      if (campo === 'descripcion') return { ...l, descripcion: valor }
      return { ...l, [campo]: parseFloat(valor) || 0 }
    }))
  }

  function validar(): boolean {
    const errs: Record<string, string> = {}
    if (!clienteId) errs.clienteId = 'Selecciona un cliente'
    if (!fechaEmision) errs.fechaEmision = 'Obligatorio'
    if (frecuenciaBase === 'personalizado' && customN < 1) errs.customN = 'El intervalo debe ser al menos 1'
    lineas.forEach((l, i) => {
      if (!l.descripcion.trim()) errs[`linea_${i}_desc`] = 'Obligatorio'
      if (l.cantidad <= 0) errs[`linea_${i}_cant`] = 'Debe ser > 0'
    })
    setErrores(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = useCallback(() => {
    if (!validar()) return
    setErrorServidor(null)

    startTransition(async () => {
      const resultado = await crearFacturaRecurrente({
        cliente_id: clienteId,
        frecuencia,
        fecha_emision: fechaEmision,
        base_imponible: baseImponible,
        iva_porcentaje: ivaPorcentaje,
        iva_importe: ivaImporte,
        irpf_porcentaje: irpfPorcentaje,
        irpf_importe: irpfImporte,
        total,
        notas: notas.trim() || null,
        lineas: lineas.map((l, i) => ({
          descripcion: l.descripcion.trim(),
          cantidad: l.cantidad,
          precio_unitario: l.precioUnitario,
          subtotal: subtotales[i],
          orden: l.orden,
        })),
      })

      if (!resultado.ok) setErrorServidor(resultado.error)
      // Si ok, la acción hace redirect automáticamente
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, frecuencia, fechaEmision, baseImponible, ivaPorcentaje, ivaImporte, irpfPorcentaje, irpfImporte, total, notas, lineas])

  return (
    <div className="space-y-6">
      {errorServidor && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-600">
          {errorServidor}
        </div>
      )}

      {/* ── Frecuencia — destacada al principio ── */}
      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 p-5">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Frecuencia de repetición</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FRECUENCIAS.map(({ valor, etiqueta, desc }) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFrecuenciaBase(valor)}
              className={`flex flex-col items-center rounded-xl border-2 px-3 py-3 transition-all ${
                frecuenciaBase === valor
                  ? 'border-violet-600 bg-white dark:bg-gray-800 shadow-sm'
                  : 'border-transparent bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-800'
              }`}
            >
              <span className={`text-sm font-semibold ${frecuenciaBase === valor ? 'text-violet-700' : 'text-gray-700 dark:text-gray-300'}`}>
                {etiqueta}
              </span>
              <span className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{desc}</span>
            </button>
          ))}
        </div>

        {/* Inputs del intervalo personalizado */}
        {frecuenciaBase === 'personalizado' && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Repetir cada</span>
            <input
              type="number"
              min={1}
              max={365}
              value={customN}
              onChange={(e) => setCustomN(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden text-sm">
              {(['dias', 'semanas', 'meses'] as UnidadPersonalizada[]).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setCustomUnidad(u)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    customUnidad === u
                      ? 'bg-violet-600 text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <span className="text-xs text-violet-600 font-medium">
              → {etiquetaFrecuencia(frecuencia)}
            </span>
          </div>
        )}
      </div>

      {/* ── Cliente + fecha ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Datos principales</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Cliente <span className="text-red-500">*</span>
            </label>
            <SelectorCliente
              clientes={clientes}
              value={clienteId}
              onChange={(id) => { setClienteId(id); setErrores(p => ({ ...p, clienteId: undefined! })) }}
              error={errores.clienteId}
            />
            {errores.clienteId && <p className="text-xs text-red-500">{errores.clienteId}</p>}
          </div>
          <DatePicker
            label="Fecha de emisión"
            value={fechaEmision}
            onChange={(v) => { setFechaEmision(v); setErrores(p => ({ ...p, fechaEmision: undefined! })) }}
            error={errores.fechaEmision}
            required
            ayuda="Fecha de la primera factura generada"
          />
        </div>
      </div>

      {/* ── Líneas ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Líneas de factura</h2>
        <div className="space-y-3">
          <div className="hidden grid-cols-[1fr_80px_110px_90px_32px] gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 md:grid">
            <span>Descripción</span><span>Cantidad</span><span>Precio unit.</span><span className="text-right">Subtotal</span><span />
          </div>
          {lineas.map((linea, idx) => (
            <div key={linea._id}
              className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 dark:border-gray-700 p-3 md:grid-cols-[1fr_80px_110px_90px_32px] md:items-start md:border-0 md:p-0">
              <div>
                <input type="text" placeholder="Descripción del servicio o producto"
                  value={linea.descripcion}
                  onChange={(e) => actualizarLinea(linea._id, 'descripcion', e.target.value)}
                  className={`h-10 w-full rounded-lg border px-3 text-sm text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${errores[`linea_${idx}_desc`] ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'}`}
                />
                {errores[`linea_${idx}_desc`] && <p className="mt-0.5 text-xs text-red-500">{errores[`linea_${idx}_desc`]}</p>}
              </div>
              <input type="number" min="0" step="0.01" placeholder="1"
                value={linea.cantidad || ''}
                onChange={(e) => actualizarLinea(linea._id, 'cantidad', e.target.value)}
                className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="relative">
                <input type="number" min="0" step="0.01" placeholder="0,00"
                  value={linea.precioUnitario || ''}
                  onChange={(e) => actualizarLinea(linea._id, 'precioUnitario', e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 py-2 pl-3 pr-7 text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500">€</span>
              </div>
              <div className="flex h-10 items-center justify-end text-sm font-medium text-gray-900 dark:text-gray-100">
                {formatCurrency(subtotales[idx])}
              </div>
              <div className="flex items-center md:justify-center">
                {lineas.length > 1 && (
                  <button type="button"
                    onClick={() => setLineas(prev => prev.filter(l => l._id !== linea._id).map((l, i) => ({ ...l, orden: i })))}
                    className="rounded-lg p-1.5 text-gray-400 dark:text-gray-500 hover:bg-red-50 hover:text-red-500">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button"
          onClick={() => setLineas(prev => [...prev, crearLinea(prev.length)])}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Añadir línea
        </button>
      </div>

      {/* ── Impuestos + resumen ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Impuestos</h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">IVA</label>
              <div className="flex flex-wrap gap-2">
                {IVA_OPCIONES.map(({ valor, etiqueta }) => (
                  <button key={valor} type="button" onClick={() => setIvaPorcentaje(valor)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${ivaPorcentaje === valor ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'}`}>
                    {etiqueta}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">IRPF (retención)</label>
              <div className="flex flex-wrap gap-2">
                {IRPF_OPCIONES.map(p => (
                  <button key={p} type="button" onClick={() => setIrpfPorcentaje(p)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${irpfPorcentaje === p ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400'}`}>
                    {p === 0 ? 'Sin retención' : `${p}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Resumen</h2>
            <div className="space-y-2 rounded-lg bg-gray-50 dark:bg-gray-900 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Base imponible</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(baseImponible)}</span>
              </div>
              {ivaPorcentaje > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">IVA ({ivaPorcentaje}%)</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">+ {formatCurrency(ivaImporte)}</span>
                </div>
              )}
              {irpfPorcentaje > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">IRPF ({irpfPorcentaje}%)</span>
                  <span className="font-medium text-red-600">− {formatCurrency(irpfImporte)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between">
                <span className="text-base font-bold text-gray-900 dark:text-gray-100">Total por emisión</span>
                <span className="text-xl font-bold text-blue-600">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Notas ── */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <Textarea
          label="Notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Condiciones, datos bancarios…"
          ayuda="Opcional. Aparecerá en cada factura generada."
        />
      </div>

      {/* ── Acciones ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button variante="secundario" onClick={() => router.back()} disabled={isPending}>
          Cancelar
        </Button>
        <Button cargando={isPending} onClick={handleSubmit}>
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Activar factura recurrente
        </Button>
      </div>
    </div>
  )
}
