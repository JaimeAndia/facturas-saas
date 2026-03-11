import { createClient } from '@/lib/supabase/server'
import { TablaRecurrentes } from '@/components/facturas/TablaRecurrentes'
import type { FacturaRecurrente, Factura } from '@/types'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Facturas recurrentes — FacturApp',
}

interface RecurrenteConFactura extends FacturaRecurrente {
  facturas: Pick<Factura, 'numero' | 'total' | 'cliente_id'> & {
    clientes: { nombre: string } | null
  }
}

export default async function RecurrentesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Verificar plan Pro
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase.from('profiles') as any)
    .select('plan, plan_status')
    .eq('id', user!.id)
    .single()

  const esPro = perfil?.plan === 'pro' && perfil?.plan_status === 'active'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase.from('facturas_recurrentes') as any)
    .select('*, facturas(numero, total, clientes(nombre))')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })

  const recurrentes = (data as RecurrenteConFactura[] | null) ?? []

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Facturas recurrentes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Facturas que se generan automáticamente cada día a las 8:00.
        </p>
      </div>
      <TablaRecurrentes recurrentes={recurrentes} esPro={esPro} />
    </div>
  )
}
