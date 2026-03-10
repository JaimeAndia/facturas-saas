'use client'

import { useState, useTransition, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Button } from '@/components/ui/Button'
import { DatePicker } from '@/components/ui/DatePicker'
import { crearFactura } from '@/app/(dashboard)/facturas/actions'
import { formatCurrency } from '@/lib/utils'
import type { Cliente } from '@/types'

interface LineaFormulario {
  _id: string
  descripcion: string
  cantidad: number
  precioUnitario: number
  orden: number
}

interface FormFacturaProps {
  clientes: Pick<Cliente, 'id' | 'nombre' | 'nif'>[]
}

interface ErroresForm {
  clienteId?: string
  fechaEmision?: string
  lineas?: string
  lineasDetalle?: Record<string, { descripcion?: string; cantidad?: string; precio?: string }>
}

// Combobox de búsqueda de clientes
interface SelectorClienteProps {
  clientes: Pick<Cliente, 'id' | 'nombre' | 'nif'>[]
  value: string
  onChange: (id: string) => void
  error?: string
}

function SelectorCliente({ clientes, value, onChange, error }: SelectorClienteProps) {
  const clienteActual = clientes.find((c) => c.id === value) ?? null
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const contenedorRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
        setBusqueda('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtrados = busqueda.trim()
    ? clientes.filter((c) => {
        const q = busqueda.toLowerCase()
        return (
          c.nombre.toLowerCase().includes(q) ||
          (c.nif ?? '').toLowerCase().includes(q)
        )
      })
    : clientes

  function seleccionar(cliente: Pick<Cliente, 'id' | 'nombre' | 'nif'>) {
    onChange(cliente.id)
    setBusqueda('')
    setAbierto(false)
  }

  function limpiar(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setBusqueda('')
    setAbierto(false)
  }

  return (
    <div ref={contenedorRef} className="relative">
      {/* Input principal */}
      <div
        className={`flex h-10 w-full items-center gap-2 rounded-lg border bg-white px-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-blue-500/20 ${
          error
            ? 'border-red-400 focus-within:border-red-400'
            : 'border-gray-300 focus-within:border-blue-500'
        }`}
        onClick={() => { if (!abierto) setAbierto(true) }}
      >
        {/* Icono búsqueda */}
        <svg className="h-3.5 w-3.5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>

        {clienteActual && !abierto ? (
          /* Cliente seleccionado — solo lectura hasta que se abra */
          <span className="flex-1 truncate text-gray-900">
            {clienteActual.nombre}
            {clienteActual.nif && (
              <span className="ml-1.5 text-gray-400">{clienteActual.nif}</span>
            )}
          </span>
        ) : (
          <input
            type="text"
            autoComplete="off"
            placeholder={clienteActual ? clienteActual.nombre : 'Buscar cliente por nombre o NIF…'}
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setAbierto(true) }}
            onFocus={() => setAbierto(true)}
            className="flex-1 bg-transparent text-gray-900 placeholder:text-gray-400 focus:outline-none"
          />
        )}

        {/* Botón limpiar */}
        {clienteActual && (
          <button
            type="button"
            onClick={limpiar}
            className="rounded p-0.5 text-gray-400 hover:text-gray-600"
            title="Quitar cliente"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown */}
      {abierto && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
          {filtrados.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-400">
              {busqueda ? `Sin resultados para "${busqueda}"` : 'Sin clientes'}
            </p>
          ) : (
            <ul>
              {filtrados.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => seleccionar(c)}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm transition-colors hover:bg-blue-50 ${
                      c.id === value ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-900'
                    }`}
                  >
                    <span>{c.nombre}</span>
                    {c.nif && <span className="ml-3 text-xs text-gray-400">{c.nif}</span>}
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

const IVA_OPCIONES = [21, 10, 4, 0] as const
const IRPF_OPCIONES = [15, 7, 0] as const

function crearLineaVacia(orden: number): LineaFormulario {
  return {
    _id: crypto.randomUUID(),
    descripcion: '',
    cantidad: 1,
    precioUnitario: 0,
    orden,
  }
}

export function FormFactura({ clientes }: FormFacturaProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const hoy = new Date().toISOString().split('T')[0]

  const [clienteId, setClienteId] = useState('')
  const [fechaEmision, setFechaEmision] = useState(hoy)
  const [fechaVencimiento, setFechaVencimiento] = useState('')
  const [ivaPorcentaje, setIvaPorcentaje] = useState<number>(21)
  const [irpfPorcentaje, setIrpfPorcentaje] = useState<number>(15)
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<LineaFormulario[]>([crearLineaVacia(0)])
  const [errores, setErrores] = useState<ErroresForm>({})
  const [errorServidor, setErrorServidor] = useState<string | null>(null)

  // Cálculos en tiempo real
  const subtotales = lineas.map((l) =>
    parseFloat((l.cantidad * l.precioUnitario).toFixed(2))
  )
  const baseImponible = parseFloat(subtotales.reduce((s, v) => s + v, 0).toFixed(2))
  const ivaImporte = parseFloat(((baseImponible * ivaPorcentaje) / 100).toFixed(2))
  const irpfImporte = parseFloat(((baseImponible * irpfPorcentaje) / 100).toFixed(2))
  const total = parseFloat((baseImponible + ivaImporte - irpfImporte).toFixed(2))

  // Gestión de líneas
  function agregarLinea() {
    setLineas((prev) => [...prev, crearLineaVacia(prev.length)])
  }

  function eliminarLinea(id: string) {
    setLineas((prev) => prev.filter((l) => l._id !== id).map((l, i) => ({ ...l, orden: i })))
  }

  function actualizarLinea(id: string, campo: keyof Omit<LineaFormulario, '_id' | 'orden'>, valor: string) {
    setLineas((prev) =>
      prev.map((l) => {
        if (l._id !== id) return l
        if (campo === 'descripcion') return { ...l, descripcion: valor }
        const num = parseFloat(valor) || 0
        return { ...l, [campo]: num }
      })
    )
    // Limpiar error de línea al editar
    if (errores.lineasDetalle?.[id]) {
      setErrores((prev) => ({
        ...prev,
        lineasDetalle: { ...prev.lineasDetalle, [id]: {} },
      }))
    }
  }

  function validar(): boolean {
    const nuevosErrores: ErroresForm = {}
    if (!clienteId) nuevosErrores.clienteId = 'Selecciona un cliente'
    if (!fechaEmision) nuevosErrores.fechaEmision = 'La fecha de emisión es obligatoria'
    if (lineas.length === 0) nuevosErrores.lineas = 'Añade al menos una línea'

    const detalleLineas: Record<string, { descripcion?: string; cantidad?: string; precio?: string }> = {}
    lineas.forEach((l) => {
      const err: { descripcion?: string; cantidad?: string; precio?: string } = {}
      if (!l.descripcion.trim()) err.descripcion = 'Obligatorio'
      if (l.cantidad <= 0) err.cantidad = 'Debe ser > 0'
      if (l.precioUnitario < 0) err.precio = 'No puede ser negativo'
      if (Object.keys(err).length > 0) detalleLineas[l._id] = err
    })
    if (Object.keys(detalleLineas).length > 0) nuevosErrores.lineasDetalle = detalleLineas

    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  const handleSubmit = useCallback((estado: 'borrador' | 'emitida') => {
    if (!validar()) return
    setErrorServidor(null)

    startTransition(async () => {
      const resultado = await crearFactura({
        cliente_id: clienteId,
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento || null,
        estado,
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

      if (resultado.ok && resultado.datos) {
        router.push(`/facturas/${resultado.datos.id}`)
      } else if (!resultado.ok) {
        setErrorServidor(resultado.error)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, fechaEmision, fechaVencimiento, ivaPorcentaje, irpfPorcentaje, notas, lineas, baseImponible, ivaImporte, irpfImporte, total])

  return (
    <div className="space-y-6">
      {errorServidor && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {errorServidor}
        </div>
      )}

      {/* Cabecera: cliente + fechas */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Datos principales</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Selector de cliente con búsqueda */}
          <div className="flex flex-col gap-1.5 md:col-span-1">
            <label className="text-sm font-medium text-gray-700">
              Cliente <span className="text-red-500">*</span>
            </label>
            <SelectorCliente
              clientes={clientes}
              value={clienteId}
              onChange={(id) => { setClienteId(id); setErrores((p) => ({ ...p, clienteId: undefined })) }}
              error={errores.clienteId}
            />
            {errores.clienteId && <p className="text-xs text-red-500">{errores.clienteId}</p>}
          </div>

          <DatePicker
            label="Fecha de emisión"
            value={fechaEmision}
            onChange={(v) => { setFechaEmision(v); setErrores((p) => ({ ...p, fechaEmision: undefined })) }}
            error={errores.fechaEmision}
            required
          />
          <DatePicker
            label="Fecha de vencimiento"
            value={fechaVencimiento}
            onChange={setFechaVencimiento}
            ayuda="Opcional"
            min={fechaEmision}
            placeholder="Sin vencimiento"
          />
        </div>
      </div>

      {/* Líneas de factura */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Líneas de factura</h2>

        {errores.lineas && (
          <p className="mb-3 text-xs text-red-500">{errores.lineas}</p>
        )}

        <div className="space-y-3">
          {/* Cabecera columnas — desktop */}
          <div className="hidden grid-cols-[1fr_80px_110px_90px_32px] gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid">
            <span>Descripción</span>
            <span>Cantidad</span>
            <span>Precio unit.</span>
            <span className="text-right">Subtotal</span>
            <span />
          </div>

          {lineas.map((linea, idx) => {
            const subtotal = subtotales[idx]
            const errLinea = errores.lineasDetalle?.[linea._id]
            return (
              <div key={linea._id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-gray-100 p-3 md:grid-cols-[1fr_80px_110px_90px_32px] md:items-start md:border-0 md:p-0">
                {/* Descripción */}
                <div>
                  <input
                    type="text"
                    placeholder="Descripción del servicio o producto"
                    value={linea.descripcion}
                    onChange={(e) => actualizarLinea(linea._id, 'descripcion', e.target.value)}
                    className={`h-10 w-full rounded-lg border px-3 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      errLinea?.descripcion ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {errLinea?.descripcion && <p className="mt-0.5 text-xs text-red-500">{errLinea.descripcion}</p>}
                </div>

                {/* Cantidad */}
                <div>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="1"
                    value={linea.cantidad || ''}
                    onChange={(e) => actualizarLinea(linea._id, 'cantidad', e.target.value)}
                    className={`h-10 w-full rounded-lg border px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      errLinea?.cantidad ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {errLinea?.cantidad && <p className="mt-0.5 text-xs text-red-500">{errLinea.cantidad}</p>}
                </div>

                {/* Precio unitario */}
                <div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={linea.precioUnitario || ''}
                      onChange={(e) => actualizarLinea(linea._id, 'precioUnitario', e.target.value)}
                      className={`h-10 w-full rounded-lg border py-2 pl-3 pr-7 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                        errLinea?.precio ? 'border-red-400' : 'border-gray-300'
                      }`}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">€</span>
                  </div>
                  {errLinea?.precio && <p className="mt-0.5 text-xs text-red-500">{errLinea.precio}</p>}
                </div>

                {/* Subtotal calculado */}
                <div className="flex h-10 items-center justify-end text-sm font-medium text-gray-900">
                  {formatCurrency(subtotal)}
                </div>

                {/* Eliminar línea */}
                <div className="flex items-start pt-1 md:pt-0 md:items-center">
                  {lineas.length > 1 && (
                    <button
                      type="button"
                      onClick={() => eliminarLinea(linea._id)}
                      title="Eliminar línea"
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
            )
          })}
        </div>

        <button
          type="button"
          onClick={agregarLinea}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Añadir línea
        </button>
      </div>

      {/* IVA + IRPF + Totales */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Selectores fiscales */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-900">Impuestos</h2>

            {/* IVA */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">IVA</label>
              <div className="flex gap-2">
                {IVA_OPCIONES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setIvaPorcentaje(p)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      ivaPorcentaje === p
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {p === 0 ? 'Exento' : `${p}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* IRPF */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">IRPF (retención)</label>
              <div className="flex gap-2">
                {IRPF_OPCIONES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setIrpfPorcentaje(p)}
                    className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      irpfPorcentaje === p
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-gray-300 text-gray-700 hover:border-blue-400'
                    }`}
                  >
                    {p === 0 ? 'Sin retención' : `${p}%`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Resumen de totales */}
          <div>
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Resumen</h2>
            <div className="space-y-2 rounded-lg bg-gray-50 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Base imponible</span>
                <span className="font-medium text-gray-900">{formatCurrency(baseImponible)}</span>
              </div>
              {ivaPorcentaje > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IVA ({ivaPorcentaje}%)</span>
                  <span className="font-medium text-gray-900">+ {formatCurrency(ivaImporte)}</span>
                </div>
              )}
              {irpfPorcentaje > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">IRPF ({irpfPorcentaje}%)</span>
                  <span className="font-medium text-red-600">− {formatCurrency(irpfImporte)}</span>
                </div>
              )}
              <div className="border-t border-gray-200 pt-2">
                <div className="flex justify-between">
                  <span className="text-base font-bold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-blue-600">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notas */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <Textarea
          label="Notas"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Condiciones de pago, datos bancarios, agradecimiento..."
          ayuda="Opcional. Aparecerá al pie de la factura."
        />
      </div>

      {/* Acciones */}
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <Button
          variante="secundario"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          variante="secundario"
          cargando={isPending}
          onClick={() => handleSubmit('borrador')}
        >
          Guardar borrador
        </Button>
        <Button
          cargando={isPending}
          onClick={() => handleSubmit('emitida')}
        >
          Emitir factura
        </Button>
      </div>
    </div>
  )
}
