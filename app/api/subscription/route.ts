import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLANES } from '@/types'

export interface SubscriptionInfo {
  plan: 'free' | 'basico' | 'pro'
  planStatus: 'active' | 'canceled' | 'past_due' | 'trialing' | null
  // Para free: total de facturas creadas. Para básico: facturas este mes.
  facturasUsadas: number
  limiteFacturas: number | 'ilimitadas'
  puedeCrear: boolean
  facturasRecurrentes: boolean
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Cargar plan del perfil
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase.from('profiles') as any)
    .select('plan, plan_status')
    .eq('id', user.id)
    .single()

  const plan: 'free' | 'basico' | 'pro' = perfil?.plan ?? 'free'
  const planStatus = perfil?.plan_status ?? null
  const config = PLANES[plan]

  // Plan pro: sin límites
  if (plan === 'pro' && planStatus === 'active') {
    return NextResponse.json({
      plan,
      planStatus,
      facturasUsadas: 0,
      limiteFacturas: 'ilimitadas',
      puedeCrear: true,
      facturasRecurrentes: true,
    } satisfies SubscriptionInfo)
  }

  let facturasUsadas = 0

  if (plan === 'free' || !planStatus || planStatus === 'canceled') {
    // Free trial: contar total de facturas (no solo este mes)
    const { count } = await supabase
      .from('facturas')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    facturasUsadas = count ?? 0
  } else {
    // Plan de pago activo: contar facturas del mes en curso
    const inicioMes = new Date()
    inicioMes.setDate(1)
    inicioMes.setHours(0, 0, 0, 0)

    const { count } = await supabase
      .from('facturas')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', inicioMes.toISOString())
    facturasUsadas = count ?? 0
  }

  const limite = config.facturasMes
  const puedeCrear = limite === 'ilimitadas' || facturasUsadas < (limite as number)

  return NextResponse.json({
    plan,
    planStatus,
    facturasUsadas,
    limiteFacturas: limite,
    puedeCrear,
    facturasRecurrentes: false,
  } satisfies SubscriptionInfo)
}
