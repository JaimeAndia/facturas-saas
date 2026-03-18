import { createClient } from '@/lib/supabase/server'
import { TablaRecurrentes } from '@/components/facturas/TablaRecurrentes'
import type { FacturaGenerada, RecurrenteConFactura } from '@/components/facturas/TablaRecurrentes'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Facturas recurrentes — FacturX',
}

export default async function RecurrentesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [perfilRes, recurrentesRes, generadasRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('profiles') as any)
      .select('plan, plan_status, stripe_account_status')
      .eq('id', user!.id)
      .single(),

    // Plantillas recurrentes con su factura base + campos de cobro automático
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('facturas_recurrentes') as any)
      .select('*, cobro_automatico, cobro_status, stripe_customer_id, setup_url, facturas!factura_base_id(numero, total, clientes(nombre))')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false }),

    // Facturas generadas por el cron (tienen factura_recurrente_id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('facturas') as any)
      .select('id, numero, estado, fecha_emision, total, blockchain_tx, payment_link_url, factura_recurrente_id')
      .eq('user_id', user!.id)
      .not('factura_recurrente_id', 'is', null)
      .order('fecha_emision', { ascending: false }),
  ])

  const perfil = perfilRes.data as { plan: string; plan_status: string; stripe_account_status: string } | null
  const esPro = (perfil?.plan === 'basico' || perfil?.plan === 'pro') && perfil?.plan_status === 'active'
  const cobrosActivos = perfil?.stripe_account_status === 'active'
  const recurrentes = (recurrentesRes.data ?? []) as RecurrenteConFactura[]
  const generadas = (generadasRes.data ?? []) as FacturaGenerada[]

  // Agrupar facturas generadas por recurrente
  const generadasMap: Record<string, FacturaGenerada[]> = {}
  for (const f of generadas) {
    if (!generadasMap[f.factura_recurrente_id]) generadasMap[f.factura_recurrente_id] = []
    generadasMap[f.factura_recurrente_id].push(f)
  }

  const recurrentesConGeneradas: RecurrenteConFactura[] = recurrentes.map(r => ({
    ...r,
    facturas_generadas: generadasMap[r.id] ?? [],
  }))

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Facturas recurrentes</h1>
        <p className="mt-1 text-sm text-gray-500">
          Modo manual: la factura se genera en cada ciclo y el cliente paga con enlace.
          Modo automático: Stripe cobra con la tarjeta guardada del cliente.
        </p>
      </div>
      <TablaRecurrentes recurrentes={recurrentesConGeneradas} esPro={esPro} cobrosActivos={cobrosActivos} />
    </div>
  )
}
