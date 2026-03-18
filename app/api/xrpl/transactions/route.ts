import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getXrplClient } from '@/lib/xrpl'

function fromHex(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8')
}

function decodeMemos(memos: unknown[]): Record<string, string> {
  const result: Record<string, string> = {}
  for (const m of memos) {
    const memo = (m as { Memo?: { MemoType?: string; MemoData?: string } }).Memo
    if (!memo?.MemoType || !memo?.MemoData) continue
    try {
      result[fromHex(memo.MemoType)] = fromHex(memo.MemoData)
    } catch {
      // memo no decodificable — ignorar
    }
  }
  return result
}

export interface XrplTx {
  hash: string
  invoiceId: string | null
  invoiceNumero: string | null  // null si la factura fue eliminada
  invoiceHash: string | null    // SHA-256 del contenido — verifica integridad
  invoiceProofUrl: string | null // URL al JSON en Supabase Storage — permite recuperar contenido
  amountEur: string | null
  timestamp: string | null
  explorerUrl: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Solo el address público — el seed cifrado nunca se selecciona
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase as any)
    .from('profiles')
    .select('xrpl_address')
    .eq('id', user.id)
    .single() as { data: { xrpl_address: string | null } | null }

  if (!perfil?.xrpl_address) {
    return NextResponse.json({ transactions: [] })
  }

  const isTestnet = (process.env.XRPL_NETWORK ?? '').includes('altnet') ||
                    (process.env.XRPL_NETWORK ?? '').includes('testnet')
  const explorerBase = isTestnet
    ? 'https://testnet.xrpl.org/transactions'
    : 'https://livenet.xrpl.org/transactions'

  try {
    const client = await getXrplClient()

    const response = await client.request({
      command: 'account_tx',
      account: perfil.xrpl_address,
      limit: 50,
      forward: false,
    })

    const txList: XrplTx[] = []

    for (const entry of response.result.transactions) {
      // xrpl v4: hash y close_time_iso al nivel raíz, tx_json contiene el resto
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = entry as any
      const hash: string = e.hash ?? ''
      const txJson = e.tx_json ?? {}

      if (txJson.TransactionType !== 'Payment') continue
      if (!Array.isArray(txJson.Memos) || txJson.Memos.length === 0) continue

      const memos = decodeMemos(txJson.Memos)
      if (!memos['invoice_id']) continue

      let timestamp: string | null = null
      if (e.close_time_iso) {
        timestamp = new Date(e.close_time_iso).toISOString()
      } else if (typeof txJson.date === 'number') {
        timestamp = new Date((txJson.date + 946684800) * 1000).toISOString()
      }

      txList.push({
        hash,
        invoiceId: memos['invoice_id'] ?? null,
        invoiceNumero: null, // se rellena abajo
        invoiceHash: memos['invoice_hash'] ?? null,
        invoiceProofUrl: memos['invoice_proof_url'] ?? null,
        amountEur: memos['amount_eur'] ?? null,
        timestamp,
        explorerUrl: `${explorerBase}/${hash}`,
      })
    }

    if (txList.length === 0) {
      return NextResponse.json({ transactions: [] })
    }

    // Cruzar con BD para saber si la factura sigue existiendo y obtener su número
    const invoiceIds = txList.map(t => t.invoiceId).filter(Boolean) as string[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: facturas } = await (supabase as any)
      .from('facturas')
      .select('id, numero')
      .in('id', invoiceIds) as { data: { id: string; numero: string }[] | null }

    const facturaMap = new Map((facturas ?? []).map(f => [f.id, f.numero]))

    for (const tx of txList) {
      tx.invoiceNumero = tx.invoiceId ? (facturaMap.get(tx.invoiceId) ?? null) : null
    }

    return NextResponse.json({ transactions: txList })
  } catch (err) {
    console.error('[XRPL] Error obteniendo transacciones:', err)
    return NextResponse.json({ transactions: [] })
  }
}
