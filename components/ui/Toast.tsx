'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

export type TipoToast = 'exito' | 'error' | 'info'

interface ToastProps {
  mensaje: string
  tipo: TipoToast
  onCerrar: () => void
  duracion?: number
}

const estilos: Record<TipoToast, { contenedor: string; icono: React.ReactNode }> = {
  exito: {
    contenedor: 'bg-green-600 text-white',
    icono: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
  },
  error: {
    contenedor: 'bg-red-600 text-white',
    icono: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
  },
  info: {
    contenedor: 'bg-blue-600 text-white',
    icono: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
}

export function Toast({ mensaje, tipo, onCerrar, duracion = 4000 }: ToastProps) {
  // Auto-cierre tras la duración configurada
  useEffect(() => {
    const timer = setTimeout(onCerrar, duracion)
    return () => clearTimeout(timer)
  }, [onCerrar, duracion])

  const { contenedor, icono } = estilos[tipo]

  return (
    <div
      role="alert"
      aria-live="polite"
      className={cn(
        'fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 shadow-lg',
        contenedor
      )}
    >
      {icono}
      <p className="text-sm font-medium">{mensaje}</p>
      <button
        onClick={onCerrar}
        aria-label="Cerrar notificación"
        className="ml-2 rounded p-0.5 opacity-70 hover:opacity-100"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
