import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getXrplClient } from '@/lib/xrpl'

export const dynamic = 'force-dynamic'

export async function GET() {
  // Solo accesible para usuarios autenticados
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Leer config de app_config con admin client (RLS no permite acceso público)
  const adminClient = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: configRows } = await (adminClient.from('app_config') as any)
    .select('key, value')
    .in('key', ['xrp_price_eur', 'xrpl_activations_paused']) as {
      data: { key: string; value: string }[] | null
    }

  const config = Object.fromEntries((configRows ?? []).map((r) => [r.key, r.value]))
  const xrpPriceEur = parseFloat(config['xrp_price_eur'] ?? '0')
  const activationsPaused = config['xrpl_activations_paused'] === 'true'

  // Estado de la red XRPL
  const network = process.env.XRPL_NETWORK ?? ''
  const isTestnet = network.includes('altnet') || network.includes('testnet')

  let connected = false
  let balanceXrp = 0

  try {
    const client = await getXrplClient()
    connected = client.isConnected()

    const address = process.env.XRPL_WALLET_ADDRESS
    if (address && connected) {
      const accountInfo = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'current',
      })
      // Balance en drops → XRP (1 XRP = 1 000 000 drops)
      balanceXrp = parseInt(accountInfo.result.account_data.Balance, 10) / 1_000_000
    }
  } catch {
    // La conexión XRPL falla silenciosamente — no es crítico
    connected = false
  }

  return NextResponse.json({
    connected,
    network: isTestnet ? 'testnet' : 'mainnet',
    address: process.env.XRPL_WALLET_ADDRESS ?? '',
    balance_xrp: balanceXrp,
    xrp_price_eur: xrpPriceEur,
    activations_paused: activationsPaused,
  })
}
