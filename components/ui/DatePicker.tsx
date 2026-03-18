'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

interface DatePickerProps {
  label?: string
  value: string             // YYYY-MM-DD o ''
  onChange: (value: string) => void
  error?: string
  ayuda?: string
  required?: boolean
  min?: string              // YYYY-MM-DD — días anteriores desactivados
  placeholder?: string
  className?: string
}

function parseISO(str: string): Date | null {
  if (!str) return null
  const [y, m, d] = str.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

function toISO(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatDisplay(iso: string): string {
  const d = parseISO(iso)
  if (!d) return ''
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function DatePicker({
  label, value, onChange, error, ayuda, required, min, placeholder, className,
}: DatePickerProps) {
  const fechaMin = parseISO(min ?? '')

  const [abierto, setAbierto] = useState(false)
  const [mesVista, setMesVista] = useState(() => {
    const base = parseISO(value) ?? new Date()
    return new Date(base.getFullYear(), base.getMonth(), 1)
  })

  const contenedorRef = useRef<HTMLDivElement>(null)

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Sincronizar mesVista cuando cambia value externamente
  useEffect(() => {
    const d = parseISO(value)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (d) setMesVista(new Date(d.getFullYear(), d.getMonth(), 1))
  }, [value])

  const año = mesVista.getFullYear()
  const mes = mesVista.getMonth()

  // Offset para el primer día de la semana (lunes = 0)
  const primerDiaSemana = new Date(año, mes, 1).getDay()
  const offset = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1
  const diasEnMes = new Date(año, mes + 1, 0).getDate()

  const hoy = toISO(new Date())

  function seleccionar(dia: number) {
    const fecha = new Date(año, mes, dia)
    if (fechaMin && fecha < fechaMin) return
    onChange(toISO(fecha))
    setAbierto(false)
  }

  function limpiar(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  return (
    <div ref={contenedorRef} className={cn('relative flex flex-col gap-1.5', className)}>
      {label && (
        <label className="text-sm font-medium text-gray-700">
          {label}
          {required && <span className="ml-1 text-red-500">*</span>}
        </label>
      )}

      {/* Trigger */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setAbierto((o) => !o)}
        onKeyDown={(e) => e.key === 'Enter' && setAbierto((o) => !o)}
        className={cn(
          'flex h-10 w-full cursor-pointer select-none items-center gap-2 rounded-lg border bg-white px-3 text-sm transition-colors',
          error
            ? 'border-red-400'
            : abierto
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-gray-300 hover:border-gray-400',
        )}
      >
        {/* Icono calendario */}
        <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>

        <span className={cn('flex-1 text-sm', value ? 'text-gray-900' : 'text-gray-400')}>
          {value ? formatDisplay(value) : (placeholder ?? 'Seleccionar fecha…')}
        </span>

        {value && (
          <button
            type="button"
            onClick={limpiar}
            title="Limpiar fecha"
            className="rounded p-0.5 text-gray-400 hover:text-gray-600"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Dropdown calendario */}
      {abierto && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-72 rounded-xl border border-gray-200 bg-white p-4 shadow-xl">

          {/* Navegación mes */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMesVista(new Date(año, mes - 1, 1))}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">
              {MESES[mes]} {año}
            </span>
            <button
              type="button"
              onClick={() => setMesVista(new Date(año, mes + 1, 1))}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Cabecera días de la semana */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DIAS_SEMANA.map((d) => (
              <span key={d} className="text-xs font-medium text-gray-400">{d}</span>
            ))}
          </div>

          {/* Grid de días */}
          <div className="grid grid-cols-7 gap-y-0.5 text-center">
            {/* Celdas vacías hasta el primer día */}
            {Array.from({ length: offset }).map((_, i) => (
              <span key={`v-${i}`} />
            ))}

            {Array.from({ length: diasEnMes }).map((_, i) => {
              const dia = i + 1
              const iso = toISO(new Date(año, mes, dia))
              const esSeleccionado = iso === value
              const esHoy = iso === hoy
              const desactivado = fechaMin ? new Date(año, mes, dia) < fechaMin : false

              return (
                <button
                  key={dia}
                  type="button"
                  disabled={desactivado}
                  onClick={() => seleccionar(dia)}
                  className={cn(
                    'mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors',
                    desactivado && 'cursor-not-allowed text-gray-300',
                    !desactivado && esSeleccionado && 'bg-blue-600 font-semibold text-white',
                    !desactivado && !esSeleccionado && esHoy &&
                      'border border-blue-300 font-medium text-blue-600 hover:bg-blue-50',
                    !desactivado && !esSeleccionado && !esHoy &&
                      'text-gray-700 hover:bg-gray-100',
                  )}
                >
                  {dia}
                </button>
              )
            })}
          </div>

          {/* Atajo "Hoy" */}
          {!fechaMin || new Date() >= fechaMin ? (
            <div className="mt-3 border-t border-gray-100 pt-3 text-center">
              <button
                type="button"
                onClick={() => { onChange(hoy); setAbierto(false) }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Hoy
              </button>
            </div>
          ) : null}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
      {ayuda && !error && <p className="text-xs text-gray-500">{ayuda}</p>}
    </div>
  )
}
