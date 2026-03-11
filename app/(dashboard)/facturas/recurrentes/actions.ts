'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { calcularProximaFecha } from '@/lib/utils'

export { calcularProximaFecha }

export type ResultadoAccion = { ok: true } | { ok: false; error: string }

export async function crearRecurrente(
  facturaBaseId: string,
  frecuencia: 'mensual' | 'trimestral' | 'anual'
): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // Verificar plan Pro
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase.from('profiles') as any)
    .select('plan, plan_status')
    .eq('id', user.id)
    .single()

  if (perfil?.plan !== 'pro' || perfil?.plan_status !== 'active') {
    return { ok: false, error: 'Las facturas recurrentes requieren el plan Pro' }
  }

  const proxima_fecha = calcularProximaFecha(new Date(), frecuencia)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas_recurrentes') as any).insert({
    user_id: user.id,
    factura_base_id: facturaBaseId,
    frecuencia,
    proxima_fecha,
    activo: true,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/facturas/recurrentes')
  return { ok: true }
}

export async function toggleRecurrente(
  id: string,
  activo: boolean
): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas_recurrentes') as any)
    .update({ activo })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/facturas/recurrentes')
  return { ok: true }
}

export async function eliminarRecurrente(id: string): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas_recurrentes') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/facturas/recurrentes')
  return { ok: true }
}
