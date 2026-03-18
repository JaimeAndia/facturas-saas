import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DetalleRecurrente } from './DetalleRecurrente'
import type { Metadata } from 'next'
import type { FacturaGenerada, RecurrenteConFactura } from '@/components/facturas/TablaRecurrentes'

export const metadata: Metadata = {
  title: 'Detalle de recurrente — FacturX',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function DetalleRecurrentePage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) notFound()

  // Carga en paralelo: recurrente + facturas generadas + perfil del autónomo
  const [recurrenteRes, generadasRes, perfilRes] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('facturas_recurrentes') as any)
      .select('*, cobro_automatico, cobro_status, stripe_customer_id, setup_url, facturas!factura_base_id(numero, total, cliente_id, clientes(nombre))')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('facturas') as any)
      .select('id, numero, estado, fecha_emision, total, payment_link_url, factura_recurrente_id')
      .eq('user_id', user.id)
      .eq('factura_recurrente_id', id)
      .order('fecha_emision', { ascending: false }),

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('profiles') as any)
      .select('plan, plan_status, stripe_account_status')
      .eq('id', user.id)
      .single(),
  ])

  if (recurrenteRes.error || !recurrenteRes.data) notFound()

  const recurrente = recurrenteRes.data as RecurrenteConFactura
  const generadas = (generadasRes.data ?? []) as FacturaGenerada[]
  const perfil = perfilRes.data as { plan: string; plan_status: string; stripe_account_status: string } | null

  const cobrosActivos = perfil?.stripe_account_status === 'active'

  // Combinar la recurrente con sus facturas generadas
  const recurrenteCompleta: RecurrenteConFactura = {
    ...recurrente,
    facturas_generadas: generadas,
  }

  return (
    <DetalleRecurrente recurrente={recurrenteCompleta} cobrosActivos={cobrosActivos} />
  )
}
