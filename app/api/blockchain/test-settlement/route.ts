import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { settlePayment } from '@/lib/xrpl-settlement'

export const dynamic = 'force-dynamic'

/**
 * GET /api/blockchain/test-settlement
 *
 * Prueba la función settlePayment con datos ficticios.
 * Solo disponible en desarrollo (NODE_ENV !== 'production').
 * Requiere sesión de usuario autenticado.
 *
 * Ejemplo:
 *   fetch('/api/blockchain/test-settlement').then(r => r.json()).then(console.log)
 */
export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Solo disponible en desarrollo' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Inicia sesión primero' }, { status: 401 })
  }

  // Leer la wallet XRPL del usuario para usarla como destino del settlement
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase as any)
    .from('profiles')
    .select('xrpl_address')
    .eq('id', user.id)
    .single() as { data: { xrpl_address: string | null } | null }

  const start = Date.now()

  const txHash = await settlePayment({
    paymentLogId: 'test-log-id',
    invoiceId: `test-invoice-${Date.now()}`,
    amountEur: 1.00,
    userId: user.id,
    userXrplAddress: perfil?.xrpl_address ?? undefined,
  })

  const elapsed = Date.now() - start

  if (txHash) {
    return NextResponse.json({
      ok: true,
      txHash,
      elapsed_ms: elapsed,
      explorer: `https://testnet.xrpl.org/transactions/${txHash}`,
      mensaje: '✓ Transacción enviada a testnet. Haz clic en explorer para verla.',
    })
  }

  return NextResponse.json({
    ok: false,
    txHash: null,
    elapsed_ms: elapsed,
    error: 'settlePayment devolvió null — revisa los logs del servidor',
  })
}
