import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { XrplEventType } from '@/lib/xrpl-events'

/**
 * GET /api/xrpl/events
 *
 * Devuelve los eventos XRPL del usuario autenticado.
 * Query params opcionales:
 *   type        – filtra por event_type (ej. invoice_paid)
 *   status      – filtra por xrpl_status (pending|confirmed|failed)
 *   invoiceId   – filtra por factura concreta
 *   limit       – máx. resultados (default 50, máx. 200)
 *   offset      – paginación
 *
 * Nunca devuelve xrpl_seed_encrypted ni datos sensibles del perfil.
 */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const type       = searchParams.get('type') as XrplEventType | null
  const status     = searchParams.get('status')
  const invoiceId  = searchParams.get('invoiceId')
  const limit      = Math.min(parseInt(searchParams.get('limit')  ?? '50', 10), 200)
  const offset     = Math.max(parseInt(searchParams.get('offset') ?? '0',  10), 0)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from('xrpl_events')
    .select(
      'id, created_at, event_type, xrpl_tx, xrpl_ledger, xrpl_status, payload, error_message, confirmed_at, invoice_id, subscription_id',
      { count: 'exact' }
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (type)      query = query.eq('event_type', type)
  if (status)    query = query.eq('xrpl_status', status)
  if (invoiceId) query = query.eq('invoice_id', invoiceId)

  const { data: events, count, error } = await query

  if (error) {
    console.error('[XrplEvents API] Error consultando eventos:', error)
    return NextResponse.json({ error: 'Error consultando eventos' }, { status: 500 })
  }

  return NextResponse.json({
    events: events ?? [],
    total:  count  ?? 0,
  })
}
