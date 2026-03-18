import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ token: string }>
}

// Devuelve el estado del settlement XRPL para una factura dada su payment_token
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: log } = await (supabase.from('payment_logs') as any)
    .select('xrpl_settlement_tx, xrpl_settlement_status, xrpl_settled_at')
    .eq('invoice_id', factura.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as {
      data: {
        xrpl_settlement_tx: string | null
        xrpl_settlement_status: string | null
        xrpl_settled_at: string | null
      } | null
    }

  const isTestnet = (process.env.XRPL_NETWORK ?? '').includes('altnet')
  const explorerBase = isTestnet
    ? 'https://testnet.xrpl.org/transactions'
    : 'https://xrpl.org/transactions'

  return NextResponse.json({
    status: log?.xrpl_settlement_status ?? 'unknown',
    txHash: log?.xrpl_settlement_tx ?? null,
    settledAt: log?.xrpl_settled_at ?? null,
    explorerUrl: log?.xrpl_settlement_tx
      ? `${explorerBase}/${log.xrpl_settlement_tx}`
      : null,
  })
}
