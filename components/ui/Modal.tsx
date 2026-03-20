'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ModalProps {
  abierto: boolean
  onCerrar: () => void
  titulo?: string
  children: React.ReactNode
  className?: string
}

export function Modal({ abierto, onCerrar, titulo, children, className }: ModalProps) {
  // Bloquear scroll del body mientras el modal está abierto
  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [abierto])

  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCerrar()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [abierto, onCerrar])

  if (!abierto) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onCerrar}
        aria-hidden="true"
      />

      {/* Panel centrado */}
      <div
        className={cn(
          'relative z-10 w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-gray-800',
          className
        )}
      >
        {titulo && (
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{titulo}</h2>
            <button
              onClick={onCerrar}
              aria-label="Cerrar"
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(100dvh - 8rem)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
