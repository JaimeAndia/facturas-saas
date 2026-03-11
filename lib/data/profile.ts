import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * React cache() deduplica llamadas dentro del mismo ciclo de render.
 * Si layout.tsx y dashboard/page.tsx piden el perfil en el mismo request,
 * solo se hace UNA query a Supabase.
 */
export const getPerfil = cache(async (userId: string) => {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('nombre, apellidos, email, nif, telefono, direccion, ciudad, codigo_postal, provincia, plan, plan_status')
    .eq('id', userId)
    .single()
  return data
})
