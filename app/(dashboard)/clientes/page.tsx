import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import type { Database } from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Clientes — FacturApp',
}

type ClienteFila = Pick<
  Database['public']['Tables']['clientes']['Row'],
  'id' | 'nombre' | 'email' | 'nif' | 'ciudad' | 'created_at'
>

export default async function ClientesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('clientes')
    .select('id, nombre, email, nif, ciudad, created_at')
    .eq('user_id', user!.id)
    .order('nombre', { ascending: true })

  const clientes = data as ClienteFila[] | null

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Error al cargar clientes: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cabecera */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Clientes</h1>
        <a
          href="/clientes/nuevo"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo cliente
        </a>
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-gray-200 bg-white">
        {!clientes || clientes.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500">No tienes clientes todavía</p>
            <a
              href="/clientes/nuevo"
              className="mt-4 inline-flex items-center text-sm font-medium text-blue-600 hover:underline"
            >
              Añade tu primer cliente →
            </a>
          </div>
        ) : (
          <>
            {/* Cabecera tabla — solo desktop */}
            <div className="hidden grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 border-b border-gray-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-gray-400 md:grid">
              <span>Nombre</span>
              <span>NIF</span>
              <span>Email</span>
              <span>Alta</span>
            </div>

            <ul className="divide-y divide-gray-100">
              {clientes.map((cliente) => (
                <li key={cliente.id}>
                  <a
                    href={`/clientes/${cliente.id}`}
                    className="grid grid-cols-2 gap-2 px-5 py-3.5 hover:bg-gray-50 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:items-center md:gap-4"
                  >
                    <span className="col-span-2 text-sm font-medium text-gray-900 md:col-span-1">
                      {cliente.nombre}
                    </span>
                    <span className="text-xs text-gray-500">{cliente.nif ?? '—'}</span>
                    <span className="text-xs text-gray-500">{cliente.email ?? '—'}</span>
                    <span className="text-xs text-gray-400">
                      {formatDate(cliente.created_at)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
