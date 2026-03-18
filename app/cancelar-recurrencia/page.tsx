import { createAdminClient } from '@/lib/supabase/server'

interface PageProps {
  searchParams: Promise<{ id?: string; token?: string; confirmado?: string }>
}

export default async function CancelarRecurrenciaPage({ searchParams }: PageProps) {
  const { id, token, confirmado } = await searchParams
  const supabase = await createAdminClient()

  // Si viene confirmado=1 → ejecutar cancelación
  if (confirmado === '1' && id && token) {
    // Verificar token y cancelar
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rec } = await (supabase.from('facturas_recurrentes') as any)
      .select('id, activo, cancel_token, user_id')
      .eq('id', id)
      .eq('cancel_token', token)
      .single() as { data: { id: string; activo: boolean; cancel_token: string; user_id: string } | null }

    if (rec && rec.activo) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('facturas_recurrentes') as any)
        .update({ activo: false })
        .eq('id', id)

      // Notificar al autónomo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('notificaciones') as any).insert({
        user_id: rec.user_id,
        tipo: 'recurrente_cancelada_cliente',
        mensaje: 'Un cliente ha cancelado una suscripción recurrente desde el enlace del email.',
        metadata: { recurrente_id: id },
      })
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
            <svg className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Suscripción cancelada</h1>
          <p className="mt-2 text-sm text-gray-500">
            Su suscripción ha sido cancelada correctamente. No recibirá más facturas de este servicio.
          </p>
        </div>
      </div>
    )
  }

  // Pantalla de error — enlace inválido (sin id o token)
  if (!id || !token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-gray-900">Enlace inválido</h1>
          <p className="mt-2 text-sm text-gray-500">Este enlace de cancelación no es válido o ha expirado.</p>
        </div>
      </div>
    )
  }

  // Verificar que la recurrencia existe, está activa y el token coincide
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rec } = await (supabase.from('facturas_recurrentes') as any)
    .select('id, activo, cancel_token')
    .eq('id', id)
    .eq('cancel_token', token)
    .single() as { data: { id: string; activo: boolean; cancel_token: string } | null }

  if (!rec) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-bold text-gray-900">Enlace inválido</h1>
          <p className="mt-2 text-sm text-gray-500">Este enlace de cancelación no es válido o ha expirado.</p>
        </div>
      </div>
    )
  }

  if (!rec.activo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
            <svg className="h-7 w-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-gray-900">Ya cancelada</h1>
          <p className="mt-2 text-sm text-gray-500">Esta suscripción ya fue cancelada anteriormente.</p>
        </div>
      </div>
    )
  }

  // Pantalla de confirmación
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <svg className="h-7 w-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-center text-lg font-bold text-gray-900">¿Cancelar suscripción?</h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          Esta acción cancelará su suscripción recurrente. No podrá deshacerse.
        </p>
        <div className="mt-6">
          <a
            href={`/cancelar-recurrencia?id=${id}&token=${token}&confirmado=1`}
            className="flex w-full items-center justify-center rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
          >
            Sí, cancelar suscripción
          </a>
        </div>
      </div>
    </div>
  )
}
