'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useSubscription } from '@/hooks/useSubscription'

export function BannerSuscripcion() {
  const { plan, planStatus, facturasUsadas, limiteFacturas, cargando } = useSubscription()
  const [cerrado, setCerrado] = useState(false)

  if (cargando || cerrado) return null

  // Mostrar banner solo si no hay plan de pago activo
  const sinPlanActivo = plan === 'free' || !planStatus || planStatus === 'canceled' || planStatus === 'past_due'
  if (!sinPlanActivo) return null

  const limite = typeof limiteFacturas === 'number' ? limiteFacturas : null
  const restantes = limite !== null ? Math.max(0, limite - facturasUsadas) : null

  if (planStatus === 'past_due') {
    return (
      <div className="flex items-center justify-between gap-4 bg-red-600 dark:bg-red-800 px-4 py-2.5 text-sm text-white">
        <p>
          <strong>Pago fallido.</strong> Actualiza tu método de pago para no perder el acceso.
        </p>
        <Link
          href="/configuracion/planes"
          className="shrink-0 rounded-md bg-white dark:bg-red-100 px-3 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-200"
        >
          Gestionar pago
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-4 bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-800 dark:to-violet-800 px-4 py-2.5 text-sm text-white">
      <p>
        {restantes !== null && restantes <= 1 ? (
          restantes === 0
            ? <><strong>Has agotado tu prueba gratuita.</strong> Suscríbete para seguir creando facturas.</>
            : <><strong>Solo te queda {restantes} factura</strong> en tu prueba gratuita.</>
        ) : (
          <><strong>Plan gratuito:</strong> {facturasUsadas} de {limiteFacturas} facturas usadas. Suscríbete para desbloquear más.</>
        )}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/configuracion/planes"
          className="rounded-md bg-white dark:bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-200"
        >
          Ver planes
        </Link>
        <button
          onClick={() => setCerrado(true)}
          className="rounded p-0.5 hover:bg-white/20"
          aria-label="Cerrar banner"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
