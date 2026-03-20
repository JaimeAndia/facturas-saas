// Página pública — accedida por el cliente final tras cancelar desde el portal de Stripe.
// No requiere autenticación. Sin parámetros de URL. Confirmación estática.

export default function SuscripcionCancelada() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Icono */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <svg className="h-10 w-10 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
        </div>

        {/* Mensaje principal */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Suscripción cancelada
          </h1>
          <p className="mt-3 text-gray-500 dark:text-gray-400">
            Tu suscripción ha sido cancelada correctamente. No se realizarán más cobros automáticos.
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            Si tienes facturas pendientes de ese período, las recibirás por email como de costumbre.
          </p>
        </div>

        {/* Tarjeta informativa */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">¿Quieres reactivarla?</p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Contacta con el proveedor que te envía las facturas. Puede volver a configurar el cobro automático en cualquier momento.
              </p>
            </div>
          </div>
        </div>

        {/* Pie */}
        <p className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500">
          Gestionado con{' '}
          <span className="font-semibold text-violet-500">FacturX</span>
        </p>

      </div>
    </div>
  )
}
