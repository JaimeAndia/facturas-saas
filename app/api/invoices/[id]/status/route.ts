import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Polling endpoint para saber si una factura ha sido cobrada.
// Solo devuelve estado y paid_at — no expone datos sensibles.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('facturas')
    .select('estado, paid_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as { data: { estado: string; paid_at: string | null } | null }

  if (!data) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  return NextResponse.json({ estado: data.estado, paid_at: data.paid_at })
}
