import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams {
  params: Promise<{ id: string }>
}

// PATCH /api/invoices/[id]/mark-paid
// Marca una factura como cobrada manualmente
export async function PATCH(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Verificar que la factura pertenece al usuario y no está ya pagada
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase as any)
    .from('facturas')
    .select('id, estado, user_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: { id: string; estado: string; user_id: string } | null }

  if (!factura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  if (factura.estado === 'pagada') {
    return NextResponse.json({ error: 'La factura ya está marcada como cobrada' }, { status: 400 })
  }

  const ahora = new Date().toISOString()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('facturas')
    .update({ estado: 'pagada', paid_at: ahora })
    .eq('id', id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('payment_logs') as any).insert({
    invoice_id: id,
    event_type: 'manual_paid',
    provider: 'manual',
    status: 'succeeded',
    raw_payload: { marked_by: user.id, marked_at: ahora },
  })

  return NextResponse.json({ ok: true })
}
