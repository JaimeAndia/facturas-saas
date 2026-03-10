import { createClient } from '@/lib/supabase/server'
import { PLANES } from '@/types'
import type { Profile } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Configuración — FacturApp',
}

export default async function ConfiguracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const perfil = data as Profile | null

  if (error || !perfil) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
        Error al cargar el perfil.
      </div>
    )
  }

  const planActual = PLANES[perfil.plan]

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Configuración</h1>

      {/* Datos personales */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Datos del autónomo</h2>
        <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          {[
            { etiqueta: 'Nombre', valor: perfil.nombre },
            { etiqueta: 'Apellidos', valor: perfil.apellidos },
            { etiqueta: 'NIF', valor: perfil.nif },
            { etiqueta: 'Email', valor: perfil.email },
            { etiqueta: 'Teléfono', valor: perfil.telefono },
            { etiqueta: 'Dirección', valor: perfil.direccion },
            { etiqueta: 'Ciudad', valor: perfil.ciudad },
            { etiqueta: 'Código postal', valor: perfil.codigo_postal },
            { etiqueta: 'Provincia', valor: perfil.provincia },
          ].map(({ etiqueta, valor }) => (
            <div key={etiqueta} className="flex flex-col gap-0.5">
              <dt className="text-xs font-medium text-gray-400">{etiqueta}</dt>
              <dd className="text-gray-900">{valor ?? '—'}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4 border-t pt-4">
          <a
            href="/configuracion/editar"
            className="inline-flex h-8 items-center rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Editar datos
          </a>
        </div>
      </section>

      {/* Plan actual */}
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">Plan actual</h2>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">{planActual.nombre}</p>
            <p className="text-sm text-gray-500">
              {planActual.precio === 0 ? 'Gratis' : `${planActual.precio} €/mes`}
            </p>
            <ul className="mt-2 space-y-1">
              {planActual.features.map((feature: string) => (
                <li key={feature} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <svg className="h-3.5 w-3.5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
          {perfil.plan !== 'pro' && (
            <a
              href="/configuracion/planes"
              className="inline-flex h-9 items-center rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              Mejorar plan
            </a>
          )}
        </div>
      </section>
    </div>
  )
}
