import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { registrarEventoBlockchain } from '@/lib/blockchain-event'
import { recordXrplEvent } from '@/lib/xrpl-events'

/**
 * POST /api/blockchain/register-invoice
 * Body: { invoiceId: string }
 *
 * Registra una factura en XRPL como prueba de existencia e integridad.
 * Requiere sesión autenticada. El usuario debe ser propietario de la factura
 * y tener acceso XRPL (plan pro o addon) con wallet generada.
 */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  let body: { invoiceId?: string }
  try {
    body = await request.json() as { invoiceId?: string }
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const { invoiceId } = body
  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId requerido' }, { status: 400 })
  }

  // Verificar acceso XRPL y que tiene wallet generada
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase as any)
    .from('profiles')
    .select('plan, xrpl_addon, xrpl_address')
    .eq('id', user.id)
    .single() as { data: { plan: string; xrpl_addon: boolean | null; xrpl_address: string | null } | null }

  const tieneXrpl = perfil?.plan === 'pro' || !!perfil?.xrpl_addon
  if (!tieneXrpl) {
    return NextResponse.json(
      { error: 'Necesitas el plan Pro o el addon XRPL para registrar facturas en blockchain' },
      { status: 403 }
    )
  }

  if (!perfil?.xrpl_address) {
    return NextResponse.json(
      { error: 'Tu wallet XRPL aún no ha sido generada. Espera unos minutos o contacta con soporte.' },
      { status: 403 }
    )
  }

  // Verificar que la factura pertenece al usuario y está pagada
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase as any)
    .from('facturas')
    .select('estado')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single() as { data: { estado: string } | null }

  if (!factura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  if (factura.estado !== 'pagada') {
    return NextResponse.json(
      { error: 'Solo se pueden registrar en blockchain las facturas cobradas' },
      { status: 400 }
    )
  }

  // Las facturas registradas manualmente desde este endpoint siempre son pagadas (verificado arriba)
  const resultado = await registrarEventoBlockchain(invoiceId, user.id, 'pago')

  // Registrar también en xrpl_events como invoice_seal (fire-and-forget)
  if (resultado) {
    recordXrplEvent({
      userId:    user.id,
      eventType: 'invoice_seal',
      invoiceId,
      payload:   { txHash: resultado.txHash, ledger: resultado.ledger, sealedAt: new Date().toISOString() },
    }).catch(() => {})
  }

  if (!resultado) {
    return NextResponse.json(
      { error: 'No se pudo registrar en XRP Ledger. Comprueba que la red XRPL está disponible.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    txHash: resultado.txHash,
    ledger: resultado.ledger,
    verifyUrl: `/verify/${invoiceId}`,
  })
}
