'use client'

import { useState } from 'react'
import { PLANES } from '@/types'
import type { Plan } from '@/types'

const BADGE_STATUS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  trialing: 'bg-blue-100 text-blue-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-500',
}

const LABEL_STATUS: Record<string, string> = {
  active: 'Activa',
  trialing: 'Periodo de prueba',
  past_due: 'Pago pendiente',
  canceled: 'Cancelada',
}

interface SeccionSuscripcionProps {
  plan: Plan
  planStatus: 'active' | 'canceled' | 'past_due' | 'trialing' | null
  tieneStripeCustomer: boolean
}

export function SeccionSuscripcion({ plan, planStatus, tieneStripeCustomer }: SeccionSuscripcionProps) {
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const planActual = PLANES[plan]
  const esPlanPago = plan !== 'free'

  async function handlePortal() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        setError(json.error ?? 'Error al abrir el portal de facturación')
        return
      }
      window.location.href = json.url
    } catch {
      setError('Error de conexión. Inténtalo de nuevo.')
    } finally {
      setCargando(false)
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-sm font-semibold text-gray-900">Plan y suscripción</h2>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          {/* Nombre del plan + estado */}
          <div className="flex items-center gap-2">
            <p className="text-base font-bold text-gray-900">{planActual.nombre}</p>
            {esPlanPago && planStatus && (
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_STATUS[planStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                {LABEL_STATUS[planStatus] ?? planStatus}
              </span>
            )}
          </div>

          <p className="mt-0.5 text-sm text-gray-500">
            {planActual.precio === 0 ? 'Gratis' : `${planActual.precio} €/mes`}
          </p>

          {/* Features */}
          <ul className="mt-3 space-y-1">
            {planActual.features.map((feature: string) => (
              <li key={feature} className="flex items-center gap-1.5 text-xs text-gray-600">
                <svg className="h-3.5 w-3.5 shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          {/* Aviso pago pendiente */}
          {planStatus === 'past_due' && (
            <p className="mt-3 text-xs text-red-600">
              Hay un problema con tu último pago. Actualiza tu método de pago para mantener el acceso.
            </p>
          )}

          {/* Aviso cancelada */}
          {planStatus === 'canceled' && (
            <p className="mt-3 text-xs text-gray-500">
              Tu suscripción está cancelada. Seguirás teniendo acceso hasta el final del periodo pagado.
            </p>
          )}
        </div>

        {/* Botones */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          {plan !== 'pro' && planStatus !== 'canceled' && (
            <a
              href="/configuracion/planes"
              className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              Mejorar plan
            </a>
          )}

          {esPlanPago && tieneStripeCustomer && (
            <button
              onClick={handlePortal}
              disabled={cargando}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {cargando ? (
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {cargando ? 'Abriendo...' : 'Gestionar suscripción'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
      )}

      {esPlanPago && tieneStripeCustomer && (
        <p className="mt-4 border-t pt-3 text-xs text-gray-400">
          Desde el portal de Stripe puedes cambiar tu método de pago, ver el historial de facturas y cancelar la suscripción.
        </p>
      )}
    </section>
  )
}
