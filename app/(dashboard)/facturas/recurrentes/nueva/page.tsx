import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { FormFacturaRecurrente } from '@/components/facturas/FormFacturaRecurrente'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Nueva factura recurrente — FacturX',
}

export default async function NuevaRecurrentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase.from('profiles') as any)
    .select('plan, plan_status')
    .eq('id', user.id)
    .single()

  const esPro = (perfil?.plan === 'basico' || perfil?.plan === 'pro') && perfil?.plan_status === 'active'

  if (!esPro) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
          <svg className="h-6 w-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Plan Básico o superior requerido</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Las facturas recurrentes automatizan tu facturación mensual, trimestral o anual.
          Activa el Plan Básico para empezar.
        </p>
        <Link href="/configuracion/planes"
          className="mt-5 inline-block rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
          Ver planes
        </Link>
      </div>
    )
  }

  const { data: clientes } = await supabase
    .from('clientes')
    .select('id, nombre, nif')
    .eq('user_id', user.id)
    .neq('nombre', 'Cobro directo')   // excluir cliente virtual del TPV
    .order('nombre', { ascending: true })

  return (
    <div className="space-y-5">
      <div>
        <Link href="/facturas/recurrentes"
          className="mb-2 inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Facturas recurrentes
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Nueva factura recurrente</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Elige la frecuencia y define la factura. Se generará automáticamente en cada ciclo.
        </p>
      </div>

      <FormFacturaRecurrente clientes={clientes ?? []} />
    </div>
  )
}
