'use client'

import { useState, useMemo } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Factura, Cliente } from '@/types'

interface FacturaConCliente extends Factura {
  clientes: Pick<Cliente, 'nombre' | 'nif'> | null
}

interface Props {
  facturas: FacturaConCliente[]
}

// Rangos de fechas por trimestre
const TRIMESTRES = [
  { label: 'T1 (Ene–Mar)', inicio: '01-01', fin: '03-31' },
  { label: 'T2 (Abr–Jun)', inicio: '04-01', fin: '06-30' },
  { label: 'T3 (Jul–Sep)', inicio: '07-01', fin: '09-30' },
  { label: 'T4 (Oct–Dic)', inicio: '10-01', fin: '12-31' },
]

function trimestreActual(): number {
  const mes = new Date().getMonth() + 1
  return Math.ceil(mes / 3) - 1 // índice 0-based
}

export function InformeTrimestral({ facturas }: Props) {
  const añoActual = new Date().getFullYear()
  const [trimestre, setTrimestre] = useState(trimestreActual())
  const [año, setAño] = useState(añoActual)

  const facturasFiltradas = useMemo(() => {
    const { inicio, fin } = TRIMESTRES[trimestre]
    const desde = `${año}-${inicio}`
    const hasta = `${año}-${fin}`
    return facturas.filter(
      (f) => f.fecha_emision >= desde && f.fecha_emision <= hasta
    )
  }, [facturas, trimestre, año])

  const totales = useMemo(() => ({
    base: facturasFiltradas.reduce((s, f) => s + f.base_imponible, 0),
    iva: facturasFiltradas.reduce((s, f) => s + f.iva_importe, 0),
    irpf: facturasFiltradas.reduce((s, f) => s + f.irpf_importe, 0),
    total: facturasFiltradas.reduce((s, f) => s + f.total, 0),
  }), [facturasFiltradas])

  // Años disponibles: desde el año de la factura más antigua hasta el actual
  const añosDisponibles = useMemo(() => {
    const añoMin = facturas.length
      ? Math.min(...facturas.map((f) => new Date(f.fecha_emision).getFullYear()))
      : añoActual
    const años = []
    for (let a = añoActual; a >= añoMin; a--) años.push(a)
    return años
  }, [facturas, añoActual])

  function exportarCSV() {
    const cabecera = ['Nº Factura', 'Fecha', 'Cliente', 'NIF Cliente', 'Base imponible', 'IVA', 'IRPF', 'Total', 'Estado']
    const filas = facturasFiltradas.map((f) => [
      f.numero,
      f.fecha_emision,
      f.clientes?.nombre ?? '',
      f.clientes?.nif ?? '',
      f.base_imponible.toFixed(2),
      f.iva_importe.toFixed(2),
      f.irpf_importe.toFixed(2),
      f.total.toFixed(2),
      f.estado,
    ])
    const totalFila = ['TOTAL', '', '', '', totales.base.toFixed(2), totales.iva.toFixed(2), totales.irpf.toFixed(2), totales.total.toFixed(2), '']

    const contenido = [cabecera, ...filas, [], totalFila]
      .map((row) => row.map((c) => `"${c}"`).join(';'))
      .join('\n')

    const blob = new Blob(['\uFEFF' + contenido], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `informe-${TRIMESTRES[trimestre].label.replace(/[^a-zA-Z0-9]/g, '-')}-${año}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const estadoBadge: Record<string, string> = {
    emitida: 'bg-blue-100 text-blue-700',
    pagada: 'bg-green-100 text-green-700',
    vencida: 'bg-red-100 text-red-700',
  }

  return (
    <div className="space-y-6">
      {/* Nota informativa */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 dark:border-yellow-800 bg-amber-50 dark:bg-yellow-900/20 px-4 py-3">
        <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-amber-800 dark:text-yellow-400">
          Este resumen es orientativo. Consulta con tu gestor antes de presentar cualquier declaración fiscal.
        </p>
      </div>

      {/* Selectores */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-1">
          {TRIMESTRES.map((t, i) => (
            <button
              key={i}
              onClick={() => setTrimestre(i)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                trimestre === i
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {t.label.split(' ')[0]}
            </button>
          ))}
        </div>

        <select
          value={año}
          onChange={(e) => setAño(Number(e.target.value))}
          className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 dark:text-gray-200 px-3 py-2 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {añosDisponibles.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <span className="text-sm text-gray-500 dark:text-gray-400">
          {TRIMESTRES[trimestre].label}
        </span>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaResumen
          titulo="Ingresos (base imponible)"
          valor={formatCurrency(totales.base)}
          subtitulo="Suma de bases de todas las facturas"
          color="blue"
        />
        <TarjetaResumen
          titulo="IVA repercutido (mod. 303)"
          valor={formatCurrency(totales.iva)}
          subtitulo="IVA a ingresar en Hacienda"
          color="violet"
        />
        <TarjetaResumen
          titulo="IRPF retenido"
          valor={formatCurrency(totales.irpf)}
          subtitulo="Retenciones practicadas"
          color="orange"
        />
        <TarjetaResumen
          titulo="Total facturado"
          valor={formatCurrency(totales.total)}
          subtitulo={`${facturasFiltradas.length} factura${facturasFiltradas.length !== 1 ? 's' : ''} en el periodo`}
          color="green"
        />
      </div>

      {/* Tabla de facturas */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Facturas del periodo
          </h2>
          <button
            onClick={exportarCSV}
            disabled={facturasFiltradas.length === 0}
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Exportar CSV
          </button>
        </div>

        {facturasFiltradas.length === 0 ? (
          <div className="py-12 text-center">
            <svg className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              No hay facturas en {TRIMESTRES[trimestre].label} de {año}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-left text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  <th className="px-5 py-3">Nº Factura</th>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Cliente</th>
                  <th className="px-5 py-3 text-right">Base</th>
                  <th className="px-5 py-3 text-right">IVA</th>
                  <th className="px-5 py-3 text-right">IRPF</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {facturasFiltradas.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-5 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">{f.numero}</td>
                    <td className="px-5 py-3 text-gray-600 dark:text-gray-400">{formatDate(f.fecha_emision)}</td>
                    <td className="px-5 py-3 font-medium text-gray-900 dark:text-gray-100">{f.clientes?.nombre ?? '—'}</td>
                    <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(f.base_imponible)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(f.iva_importe)}</td>
                    <td className="px-5 py-3 text-right text-gray-700 dark:text-gray-300">{formatCurrency(f.irpf_importe)}</td>
                    <td className="px-5 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(f.total)}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${estadoBadge[f.estado] ?? 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'}`}>
                        {f.estado.charAt(0).toUpperCase() + f.estado.slice(1)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {/* Fila de totales */}
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 font-semibold text-gray-900 dark:text-gray-100">
                  <td colSpan={3} className="px-5 py-3 text-xs uppercase tracking-wide">Total periodo</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(totales.base)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(totales.iva)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(totales.irpf)}</td>
                  <td className="px-5 py-3 text-right">{formatCurrency(totales.total)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function TarjetaResumen({
  titulo,
  valor,
  subtitulo,
  color,
}: {
  titulo: string
  valor: string
  subtitulo: string
  color: 'blue' | 'violet' | 'orange' | 'green'
}) {
  const colores = {
    blue: 'border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700',
    violet: 'border-violet-100 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 text-violet-700',
    orange: 'border-orange-100 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 text-orange-700',
    green: 'border-green-100 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${colores[color]}`}>
      <p className="text-xs font-medium opacity-80">{titulo}</p>
      <p className="mt-1 text-2xl font-bold">{valor}</p>
      <p className="mt-1 text-xs opacity-60">{subtitulo}</p>
    </div>
  )
}
