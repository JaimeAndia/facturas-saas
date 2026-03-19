'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Refresca la página cada 3s mientras haya eventos pendientes,
// para que "Registrando..." desaparezca en cuanto el proceso XRPL termine.
export function PendingPoller({ hayPendientes }: { hayPendientes: boolean }) {
  const router = useRouter()

  useEffect(() => {
    if (!hayPendientes) return
    const interval = setInterval(() => router.refresh(), 3000)
    return () => clearInterval(interval)
  }, [hayPendientes, router])

  return null
}
