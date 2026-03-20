'use client'

import { useState, useEffect } from 'react'
import { Toast, type TipoToast } from '@/components/ui/Toast'

interface SeccionStripeConnectProps {
  stripeAccountStatus: 'not_connected' | 'pending' | 'active' | null
  toastParam?: string
}

export function SeccionStripeConnect({ stripeAccountStatus, toastParam }: SeccionStripeConnectProps) {
  const [cargando, setCargando] = useState(false)
  const [toast, setToast] = useState<{ mensaje: string; tipo: TipoToast } | null>(null)

  // Mostrar toast según el parámetro de vuelta del onboarding
  useEffect(() => {
    if (toastParam === 'connected') {
      setToast({ mensaje: 'Cuenta de Stripe conectada correctamente', tipo: 'exito' })
    } else if (toastParam === 'pending') {
      setToast({ mensaje: 'Stripe está verificando tu cuenta. Te avisarán por email.', tipo: 'info' })
    } else if (toastParam === 'error') {
      setToast({ mensaje: 'Ha ocurrido un error al conectar Stripe. Inténtalo de nuevo.', tipo: 'error' })
    }
  }, [toastParam])

  async function handleConectar() {
    setCargando(true)
    try {
      const res = await fetch('/api/stripe/connect/start', { method: 'POST' })
      const json = await res.json() as { url?: string; error?: string }
      if (!res.ok || !json.url) {
        setToast({ mensaje: json.error ?? 'Error al iniciar la conexión con Stripe', tipo: 'error' })
        return
      }
      window.location.href = json.url
    } catch {
      setToast({ mensaje: 'Error de conexión. Inténtalo de nuevo.', tipo: 'error' })
    } finally {
      setCargando(false)
    }
  }

  const estado = stripeAccountStatus ?? 'not_connected'

  return (
    <>
      <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Pagos online</h2>

        {estado === 'not_connected' && (
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-blue-900 dark:text-blue-200">Conecta tu cuenta de Stripe</p>
                <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                  Para poder cobrar tus facturas online, necesitas conectar tu cuenta de Stripe.
                  Es gratis y tarda menos de 5 minutos. El dinero irá directamente a tu cuenta bancaria.
                </p>
                <button
                  onClick={handleConectar}
                  disabled={cargando}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {cargando ? (
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  )}
                  {cargando ? 'Redirigiendo...' : 'Conectar con Stripe'}
                </button>
              </div>
            </div>
          </div>
        )}

        {estado === 'pending' && (
          <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
                <svg className="h-4 w-4 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-900 dark:text-yellow-400">Cuenta pendiente de verificación</p>
                <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-400">
                  Tu cuenta de Stripe está pendiente de verificación.
                  Stripe te enviará un email para completar el proceso.
                </p>
                <a
                  href="/api/stripe/connect/refresh"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-yellow-800 dark:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-gray-700"
                >
                  Continuar verificación
                </a>
              </div>
            </div>
          </div>
        )}

        {estado === 'active' && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Cuenta de Stripe conectada</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Tus clientes ya pueden pagarte online</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-green-100 dark:bg-green-900/30 px-2.5 py-0.5 text-xs font-medium text-green-700">
                Activa
              </span>
            </div>
          </div>
        )}
      </section>

      {toast && (
        <Toast mensaje={toast.mensaje} tipo={toast.tipo} onCerrar={() => setToast(null)} />
      )}
    </>
  )
}
