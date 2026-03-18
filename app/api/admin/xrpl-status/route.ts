import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/server'
import { getXrplClient, getAppWallet } from '@/lib/xrpl'

const DROPS_PER_XRP = 1_000_000
// Coste por activación: 12 XRP testnet / 3 XRP mainnet
const ACTIVATION_XRP_TESTNET = 12
const ACTIVATION_XRP_MAINNET = 3
// Umbral de alerta: menos de N activaciones restantes
const ALERT_THRESHOLD = 10

export async function GET() {
  const headersList = await headers()
  if (headersList.get('x-admin-key') !== process.env.ADMIN_SECRET_KEY) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const isTestnet = (process.env.XRPL_NETWORK ?? '').includes('altnet') ||
                    (process.env.XRPL_NETWORK ?? '').includes('testnet')
  const activationXrp = isTestnet ? ACTIVATION_XRP_TESTNET : ACTIVATION_XRP_MAINNET

  try {
    const [client, supabase] = await Promise.all([
      getXrplClient(),
      createAdminClient(),
    ])

    const appWallet = getAppWallet()

    // Saldo de la app wallet en XRPL
    const accountInfo = await client.request({
      command: 'account_info',
      account: appWallet.address,
      ledger_index: 'validated',
    })
    const balanceDrops = Number(accountInfo.result.account_data.Balance)
    // XRPL reserva 10 XRP (testnet) / 2 XRP (mainnet) como base reserve — no disponibles
    const baseReserveXrp = isTestnet ? 10 : 2
    const balanceXrp = balanceDrops / DROPS_PER_XRP
    const disponibleXrp = Math.max(0, balanceXrp - baseReserveXrp)
    const activacionesRestantes = Math.floor(disponibleXrp / activationXrp)

    // Usuarios con wallet activa vs pendientes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: totalPro } = await (supabase as any)
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or('plan.eq.pro,xrpl_addon.eq.true') as { count: number | null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: conWallet } = await (supabase as any)
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or('plan.eq.pro,xrpl_addon.eq.true')
      .not('xrpl_address', 'is', null) as { count: number | null }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: sinWallet } = await (supabase as any)
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .or('plan.eq.pro,xrpl_addon.eq.true')
      .is('xrpl_address', null) as { count: number | null }

    // Últimas 5 activaciones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: ultimas } = await (supabase as any)
      .from('profiles')
      .select('id, email, xrpl_address, plan, updated_at')
      .or('plan.eq.pro,xrpl_addon.eq.true')
      .not('xrpl_address', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5) as { data: { id: string; email: string; xrpl_address: string; plan: string; updated_at: string }[] | null }

    const alerta = activacionesRestantes <= ALERT_THRESHOLD

    return NextResponse.json({
      red: isTestnet ? 'testnet' : 'mainnet',
      app_wallet: {
        address: appWallet.address,
        balance_xrp: balanceXrp,
        disponible_xrp: disponibleXrp,
        base_reserve_xrp: baseReserveXrp,
      },
      activaciones: {
        coste_xrp_por_usuario: activationXrp,
        restantes: activacionesRestantes,
        alerta,
        mensaje_alerta: alerta
          ? `⚠️ Saldo bajo: solo quedan ${activacionesRestantes} activaciones. Recarga la app wallet.`
          : null,
      },
      usuarios: {
        total_pro_o_addon: totalPro ?? 0,
        con_wallet: conWallet ?? 0,
        sin_wallet: sinWallet ?? 0,
      },
      ultimas_activaciones: (ultimas ?? []).map(u => ({
        email: u.email,
        xrpl_address: u.xrpl_address,
        plan: u.plan,
        fecha: u.updated_at,
      })),
    })
  } catch (err) {
    console.error('[XRPL Status] Error:', err)
    return NextResponse.json({ error: 'Error consultando estado XRPL' }, { status: 500 })
  }
}
