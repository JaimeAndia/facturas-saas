'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PLANES } from '@/types'

interface Props {
  abierto: boolean
  onCerrar: () => void
  planActual: 'free' | 'basico' | 'pro'
  // Motivo por el que se muestra el modal
  motivo?: 'limite_facturas' | 'factura_recurrente'
}

const MENSAJES = {
  limite_facturas: {
    free: {
      titulo: 'Has alcanzado el límite del plan gratuito',
      descripcion: 'Con el plan gratuito puedes crear hasta 3 facturas. Suscríbete para seguir facturando sin límites.',
    },
    basico: {
      titulo: 'Has alcanzado el límite mensual',
      descripcion: 'Has creado las 20 facturas incluidas en tu plan Básico este mes. Mejora al plan Pro para facturas ilimitadas.',
    },
    pro: {
      titulo: 'Límite alcanzado',
      descripcion: 'Has alcanzado un límite en tu plan actual.',
    },
  },
  factura_recurrente: {
    free: {
      titulo: 'Facturas recurrentes — Plan Pro',
      descripcion: 'Las facturas recurrentes son exclusivas del plan Pro. Automatiza tu facturación mensual.',
    },
    basico: {
      titulo: 'Facturas recurrentes — Plan Pro',
      descripcion: 'Las facturas recurrentes son exclusivas del plan Pro. Mejora ahora para activarlas.',
    },
    pro: {
      titulo: 'Facturas recurrentes',
      descripcion: 'Ya tienes acceso a facturas recurrentes.',
    },
  },
}

export function UpgradeModal({ abierto, onCerrar, planActual, motivo = 'limite_facturas' }: Props) {
  const router = useRouter()
  const [cargandoPlan, setCargandoPlan] = useState<string | null>(null)

  if (!abierto) return null

  const mensaje = MENSAJES[motivo][planActual]
  // Facturas recurrentes son exclusivas de Pro, independientemente del plan actual
  const planObjetivo = (motivo === 'factura_recurrente' || planActual === 'basico') ? 'pro' : 'basico'
  const configObjetivo = PLANES[planObjetivo]

  async function iniciarCheckout() {
    if (!configObjetivo.priceId) {
      router.push('/configuracion/planes')
      return
    }
    setCargandoPlan(planObjetivo)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId: configObjetivo.priceId }),
      })
      const json = await res.json() as { url?: string; error?: string }
      if (json.url) {
        window.location.href = json.url
      } else {
        // Si Stripe falla, redirigir a la página de planes como fallback
        router.push('/configuracion/planes')
      }
    } catch {
      router.push('/configuracion/planes')
    } finally {
      setCargandoPlan(null)
    }
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onCerrar}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
      >
        {/* Icono */}
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
          <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <h2 className="mt-4 text-center text-lg font-bold text-gray-900 dark:text-gray-100">{mensaje.titulo}</h2>
        <p className="mt-2 text-center text-sm text-gray-500 dark:text-gray-400">{mensaje.descripcion}</p>

        {/* Features del plan objetivo */}
        {planActual !== 'pro' && (
          <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-400">
              Plan {configObjetivo.nombre} — {configObjetivo.precio}€/mes
            </p>
            <ul className="space-y-1.5">
              {configObjetivo.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-blue-900 dark:text-blue-200">
                  <svg className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Acciones */}
        <div className="mt-5 flex flex-col gap-2">
          {planActual !== 'pro' && (
            <button
              type="button"
              onClick={iniciarCheckout}
              disabled={!!cargandoPlan}
              className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {cargandoPlan
                ? 'Redirigiendo a Stripe…'
                : `Suscribirse al plan ${configObjetivo.nombre}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push('/configuracion/planes')}
            className="w-full rounded-lg border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Ver todos los planes
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            Ahora no
          </button>
        </div>
      </div>
    </>
  )
}
