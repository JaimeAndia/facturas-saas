'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

// Resultado uniforme para todas las acciones
export type ResultadoAccion = { ok: true } | { ok: false; error: string }

export interface DatosCliente {
  nombre: string
  nif?: string | null
  email?: string | null
  telefono?: string | null
  direccion?: string | null
  ciudad?: string | null
  codigo_postal?: string | null
  provincia?: string | null
  pais?: string
  notas?: string | null
}

// Obtiene el usuario autenticado o devuelve error
async function obtenerUsuario() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function crearCliente(datos: DatosCliente): Promise<ResultadoAccion> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('clientes') as any).insert({
    user_id: user.id,
    nombre: datos.nombre,
    nif: datos.nif ?? null,
    email: datos.email ?? null,
    telefono: datos.telefono ?? null,
    direccion: datos.direccion ?? null,
    ciudad: datos.ciudad ?? null,
    codigo_postal: datos.codigo_postal ?? null,
    provincia: datos.provincia ?? null,
    pais: datos.pais ?? 'España',
    notas: datos.notas ?? null,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/clientes')
  return { ok: true }
}

export async function actualizarCliente(
  id: string,
  datos: DatosCliente
): Promise<ResultadoAccion> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('clientes') as any)
    .update({
      nombre: datos.nombre,
      nif: datos.nif ?? null,
      email: datos.email ?? null,
      telefono: datos.telefono ?? null,
      direccion: datos.direccion ?? null,
      ciudad: datos.ciudad ?? null,
      codigo_postal: datos.codigo_postal ?? null,
      provincia: datos.provincia ?? null,
      pais: datos.pais ?? 'España',
      notas: datos.notas ?? null,
    })
    .eq('id', id)
    .eq('user_id', user.id) // seguridad extra: solo puede editar sus propios clientes

  if (error) return { ok: false, error: error.message }

  revalidatePath('/clientes')
  return { ok: true }
}

export async function eliminarCliente(id: string): Promise<ResultadoAccion> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('clientes') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    // Detectar si tiene facturas asociadas (foreign key violation)
    if (error.code === '23503') {
      return { ok: false, error: 'No se puede eliminar: el cliente tiene facturas asociadas' }
    }
    return { ok: false, error: error.message }
  }

  revalidatePath('/clientes')
  return { ok: true }
}
