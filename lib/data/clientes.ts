import { unstable_cache } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

/**
 * Lista de clientes cacheada por usuario (30 s).
 * Se invalida con revalidateTag(`clientes-${userId}`) en las Server Actions.
 */
export function getClientesCached(userId: string) {
  return unstable_cache(
    async () => {
      const supabase = await createClient()
      const { data } = await supabase
        .from('clientes')
        .select('id, nombre, nif')
        .eq('user_id', userId)
        .order('nombre', { ascending: true })
      return data ?? []
    },
    [`clientes-${userId}`],
    { revalidate: 30, tags: [`clientes-${userId}`] }
  )()
}
