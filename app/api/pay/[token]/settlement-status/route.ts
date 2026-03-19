import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ token: string }>
}

// Devuelve el estado del settlement XRPL para una factura dada su payment_token.
// blockchain_events.tx_status='confirmed' tiene prioridad (prueba más fuerte, no hay conflicto).
// payment_logs.xrpl_settlement_status se usa para 'not_applicable' y como segunda fuente.
// 'failed' solo se devuelve si ambas fuentes lo confirman para evitar falsos negativos.
export async function GET(_req: Request, { params }: RouteParams) {
  const { token } = await params
  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase as any)
    .from('facturas')
    .select('id')
    .eq('payment_token', token)
    .single() as { data: { id: string } | null }

  if (!factura) return NextResponse.json({ status: 'not_found' })

  const isTestnet = (process.env.XRPL_NETWORK ?? '').includes('altnet')
  const explorerBase = isTestnet
    ? 'https://testnet.xrpl.org/transactions'
    : 'https://xrpl.org/transactions'

  // Consultar ambas fuentes en paralelo
  const [{ data: log }, { data: evento }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.from('payment_logs') as any)
      .select('xrpl_settlement_tx, xrpl_settlement_status, xrpl_settled_at')
      .eq('invoice_id', factura.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as Promise<{
        data: {
          xrpl_settlement_tx: string | null
          xrpl_settlement_status: string | null
          xrpl_settled_at: string | null
        } | null
      }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('blockchain_events')
      .select('tx_hash, tx_status, created_at')
      .eq('factura_id', factura.id)
      .eq('event_type', 'pago')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle() as Promise<{
        data: { tx_hash: string | null; tx_status: string | null; created_at: string } | null
      }>,
  ])

  // ── 1. blockchain_events confirmado → settled (prueba más fuerte)
  if (evento?.tx_status === 'confirmed' && evento.tx_hash) {
    return NextResponse.json({
      status:      'settled',
      txHash:      evento.tx_hash,
      settledAt:   evento.created_at,
      explorerUrl: `${explorerBase}/${evento.tx_hash}`,
    })
  }

  // ── 2. payment_logs con estado definitivo distinto de 'failed'
  // Si blockchain_events no confirmó, pero el log dice 'settled' o 'not_applicable', respetarlo
  const logStatus = log?.xrpl_settlement_status
  if (logStatus && logStatus !== 'pending' && logStatus !== 'failed') {
    return NextResponse.json({
      status:      logStatus,
      txHash:      log?.xrpl_settlement_tx ?? null,
      settledAt:   log?.xrpl_settled_at ?? null,
      explorerUrl: log?.xrpl_settlement_tx ? `${explorerBase}/${log.xrpl_settlement_tx}` : null,
    })
  }

  // ── 3. Solo devolver 'failed' si AMBAS fuentes lo confirman o solo hay una y falla
  // Esto evita mostrar error al cliente cuando blockchain_events aún está en tránsito
  if (
    evento?.tx_status === 'failed' &&
    (logStatus === 'failed' || !logStatus || logStatus === 'pending')
  ) {
    return NextResponse.json({ status: 'failed', txHash: null, settledAt: null, explorerUrl: null })
  }

  // Sin datos definitivos aún — seguir esperando
  return NextResponse.json({
    status:      log ? 'pending' : 'unknown',
    txHash:      null,
    settledAt:   null,
    explorerUrl: null,
  })
}
