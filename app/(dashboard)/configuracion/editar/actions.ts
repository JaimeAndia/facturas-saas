'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ResultadoAccion = { ok: true } | { ok: false; error: string }

export interface DatosPerfil {
  nombre: string
  apellidos: string
  nif: string
  telefono?: string | null
  direccion?: string | null
  ciudad?: string | null
  codigo_postal?: string | null
  provincia?: string | null
  iban?: string | null
}

export async function actualizarPerfil(datos: DatosPerfil): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      nombre: datos.nombre,
      apellidos: datos.apellidos,
      nif: datos.nif,
      telefono: datos.telefono ?? null,
      direccion: datos.direccion ?? null,
      ciudad: datos.ciudad ?? null,
      codigo_postal: datos.codigo_postal ?? null,
      provincia: datos.provincia ?? null,
      iban: datos.iban ?? null,
    })
    .eq('id', user.id)

  if (error) return { ok: false, error: 'Error al guardar los datos' }

  revalidatePath('/configuracion')
  redirect('/configuracion')
}
