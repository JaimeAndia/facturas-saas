import { createClient } from '@/lib/supabase/server'
import { PLANES } from '@/types'
import type { Profile } from '@/types'
import type { Metadata } from 'next'
import { SeccionStripeConnect } from '@/components/configuracion/SeccionStripeConnect'
import { SeccionSuscripcion } from '@/components/configuracion/SeccionSuscripcion'
import { SeccionIdentidadDigital } from '@/components/configuracion/SeccionIdentidadDigital'

export const metadata: Metadata = {
  title: 'Configuración — FacturX',
}

interface PageProps {
  searchParams: Promise<{ stripe?: string }>
}

export default async function ConfiguracionPage({ searchParams }: PageProps) {
  const { stripe: stripeParam } = await searchParams
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
            { etiqueta: 'IBAN', valor: (perfil as unknown as { iban: string | null }).iban },
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

      {/* Cobros online vía Stripe Connect */}
      <SeccionStripeConnect
        stripeAccountStatus={(perfil as unknown as { stripe_account_status: string | null }).stripe_account_status as 'not_connected' | 'pending' | 'active' | null}
        toastParam={stripeParam}
      />

      {/* Identidad digital XRPL */}
      <SeccionIdentidadDigital
        xrplAddress={perfil.xrpl_address}
        esPro={perfil.plan === 'pro' || !!(perfil.xrpl_addon)}
        isTestnet={(process.env.XRPL_NETWORK ?? '').includes('altnet')}
      />

      {/* Plan y suscripción */}
      <SeccionSuscripcion
        plan={perfil.plan}
        planStatus={perfil.plan_status ?? null}
        tieneStripeCustomer={!!perfil.stripe_customer_id}
      />
    </div>
  )
}
