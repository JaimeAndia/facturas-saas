'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlanConfig } from '@/types'

interface Props {
  planActual: 'free' | 'basico' | 'pro'
  planStatus: 'active' | 'canceled' | 'past_due' | 'trialing' | null
  tieneStripeCustomer: boolean
  planes: Record<string, PlanConfig>
}

const DESCUENTO_ANUAL = 15

export function PlanesCliente({ planActual, planStatus, tieneStripeCustomer, planes }: Props) {
  const router = useRouter()
  const [cargando, setCargando] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [esAnual, setEsAnual] = useState(true)

  async function iniciarCheckout(priceId: string) {
    setCargando(priceId)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Error desconocido')
      window.location.href = json.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al conectar con Stripe')
      setCargando(null)
    }
  }

  async function abrirPortal() {
    setCargando('portal')
    setError(null)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Error desconocido')
      window.location.href = json.url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al abrir el portal')
      setCargando(null)
    }
  }

  const ordenPlanes: Array<'free' | 'basico' | 'pro'> = ['free', 'basico', 'pro']

  return (
    <div className="space-y-6">
      {/* Alertas */}
      {planStatus === 'past_due' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <strong>Pago fallido.</strong> Actualiza tu método de pago para mantener el acceso.
          <button onClick={abrirPortal} className="ml-2 underline hover:no-underline">Gestionar pago</button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Toggle mensual / anual */}
      <div className="flex items-center justify-center gap-3">
        <span className={`text-sm font-medium ${!esAnual ? 'text-gray-900' : 'text-gray-400'}`}>Mensual</span>
        <button
          type="button"
          onClick={() => setEsAnual(!esAnual)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            esAnual ? 'bg-blue-600' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={esAnual}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            esAnual ? 'translate-x-6' : 'translate-x-1'
          }`} />
        </button>
        <span className={`text-sm font-medium ${esAnual ? 'text-gray-900' : 'text-gray-400'}`}>
          Anual
        </span>
        {esAnual && (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
            Ahorra un {DESCUENTO_ANUAL}%
          </span>
        )}
      </div>

      {/* Tarjetas de planes */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {ordenPlanes.map((clave) => {
          const plan = planes[clave]
          const esActual = planActual === clave
          const esPro = clave === 'pro'
          const precioMostrado = esAnual ? plan.precioAnual : plan.precio
          const priceIdActivo = esAnual ? plan.priceIdAnual : plan.priceId
          const ahorroAnual = plan.precio > 0
            ? Math.round((plan.precio - plan.precioAnual) * 12)
            : 0

          return (
            <div
              key={clave}
              className={`relative flex flex-col rounded-xl border p-5 ${
                esPro ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'
              } ${esActual ? 'ring-2 ring-blue-600 ring-offset-2' : ''}`}
            >
              {esPro && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Recomendado
                </span>
              )}
              {esActual && (
                <span className="absolute right-4 top-4 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                  Plan actual
                </span>
              )}

              <div className="mb-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-gray-900">{plan.nombre}</h3>
                  {esAnual && plan.precio > 0 && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">
                      -{DESCUENTO_ANUAL}%
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  {esAnual && plan.precio > 0 && (
                    <span className="text-base text-gray-400 line-through">{plan.precio}€</span>
                  )}
                  <span className="text-3xl font-bold text-gray-900">
                    {precioMostrado === 0 ? 'Gratis' : `${precioMostrado}€`}
                  </span>
                  {precioMostrado > 0 && (
                    <span className="text-sm text-gray-500">/mes</span>
                  )}
                </div>
                {esAnual && plan.precio > 0 && (
                  <p className="mt-1 text-xs text-green-600 font-medium">
                    Ahorras {ahorroAnual}€ al año · {(precioMostrado * 12).toFixed(0)}€/año
                  </p>
                )}
              </div>

              <ul className="flex-1 space-y-2 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5">
                {esActual && planStatus === 'active' && tieneStripeCustomer ? (
                  <button
                    onClick={abrirPortal}
                    disabled={cargando === 'portal'}
                    className="w-full rounded-lg border border-gray-300 bg-white py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {cargando === 'portal' ? 'Abriendo…' : 'Gestionar suscripción'}
                  </button>
                ) : esActual && planStatus === 'active' && !tieneStripeCustomer ? (
                  <p className="py-2 text-center text-sm text-gray-400">Plan activo</p>
                ) : esActual && clave === 'free' ? (
                  <p className="py-2 text-center text-sm text-gray-400">Plan activo</p>
                ) : clave === 'free' ? (
                  <p className="py-2 text-center text-xs text-gray-400">Plan base incluido</p>
                ) : priceIdActivo ? (
                  <button
                    onClick={() => iniciarCheckout(priceIdActivo)}
                    disabled={!!cargando}
                    className={`w-full rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-60 ${
                      esPro
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-blue-600 text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    {cargando === priceIdActivo
                      ? 'Redirigiendo…'
                      : `Suscribirse — ${precioMostrado}€/mes`}
                  </button>
                ) : (
                  <p className="py-2 text-center text-xs text-gray-400">Próximamente</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {tieneStripeCustomer && planActual !== 'free' && (
        <p className="text-center text-xs text-gray-400">
          Para cancelar o cambiar tu forma de pago, usa{' '}
          <button onClick={abrirPortal} className="text-blue-600 underline hover:no-underline">
            el portal de cliente
          </button>.
        </p>
      )}
    </div>
  )
}
