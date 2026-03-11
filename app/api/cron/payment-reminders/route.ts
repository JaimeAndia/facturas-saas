import { NextResponse } from 'next/server'

// Cron diario a las 9:00 — envía recordatorios de pago a facturas vencidas
// El cuerpo completo se implementará en v2
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  console.log('[cron/payment-reminders] Ejecutado:', new Date().toISOString())

  // TODO: implementar lógica de recordatorios en v2
  return NextResponse.json({ ok: true })
}
