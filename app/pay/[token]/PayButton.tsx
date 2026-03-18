'use client'

import { useState } from 'react'

interface PayButtonProps {
  token: string
  total: number
}

export function PayButton({ token, total }: PayButtonProps) {
  const [estado, setEstado] = useState<'idle' | 'procesando' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

  async function handlePagar() {
    setEstado('procesando')
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        setError(json.error ?? 'No se pudo procesar el pago. Inténtalo de nuevo.')
        setEstado('error')
        return
      }
      // Redirigir a la página de éxito
      window.location.href = json.url
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
      setEstado('error')
    }
  }

  return (
    <div className="space-y-4">
      {/* Selector de método (UI decorativa para la demo) */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-600">
          Método de pago
        </p>
        <div className="flex items-center gap-3 rounded-lg border border-blue-300 bg-white px-3 py-2.5">
          {/* Icono banco */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600">
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Pago seguro</p>
            <p className="text-xs text-gray-400">Tarjeta · Transferencia</p>
          </div>
          <svg className="h-4 w-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd" />
          </svg>
        </div>
      </div>

      {/* Botón principal */}
      <button
        onClick={handlePagar}
        disabled={estado === 'procesando'}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-4 text-base font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800 disabled:opacity-70"
      >
        {estado === 'procesando' ? (
          <>
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Procesando pago…
          </>
        ) : (
          <>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Confirmar pago — {fmt(total)}
          </>
        )}
      </button>

      {error && (
        <p className="text-center text-sm text-red-600">{error}</p>
      )}

      {/* Pie de seguridad */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Pago seguro procesado por Stripe
        </div>
        <p className="text-xs text-gray-300">Plataforma de pagos regulada globalmente</p>
      </div>
    </div>
  )
}
