import { createClient } from '@/lib/supabase/server'

/**
 * Lista de clientes del usuario para el formulario de nueva factura.
 */
export async function getClientesCached(userId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clientes')
    .select('id, nombre, nif')
    .eq('user_id', userId)
    .order('nombre', { ascending: true })
  return data ?? []
}
