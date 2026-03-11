'use client'

import { useState, useEffect, useCallback } from 'react'
import type { SubscriptionInfo } from '@/app/api/subscription/route'

export interface UseSubscriptionReturn extends SubscriptionInfo {
  cargando: boolean
  error: string | null
  refrescar: () => void
}

export function useSubscription(): UseSubscriptionReturn {
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<SubscriptionInfo>({
    plan: 'free',
    planStatus: null,
    facturasUsadas: 0,
    limiteFacturas: 3,
    puedeCrear: true,
    facturasRecurrentes: false,
  })

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch('/api/subscription')
      if (!res.ok) throw new Error('Error cargando suscripción')
      const json = await res.json() as SubscriptionInfo
      setDatos(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { ...datos, cargando, error, refrescar: cargar }
}
