import { createClient } from '@/lib/supabase/server'
import { PlanesCliente } from '@/components/configuracion/PlanesCliente'
import { PLANES } from '@/types'
import type { Profile } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Planes — FacturApp',
}

export default async function PlanesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('profiles') as any)
    .select('plan, plan_status, stripe_customer_id')
    .eq('id', user!.id)
    .single()

  const perfil = data as Pick<Profile, 'plan' | 'plan_status' | 'stripe_customer_id'> | null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Planes y suscripción</h1>
        <p className="mt-1 text-sm text-gray-500">
          Elige el plan que mejor se adapte a tu actividad.
        </p>
      </div>

      <PlanesCliente
        planActual={perfil?.plan ?? 'free'}
        planStatus={perfil?.plan_status ?? null}
        tieneStripeCustomer={!!perfil?.stripe_customer_id}
        planes={PLANES}
      />
    </div>
  )
}
