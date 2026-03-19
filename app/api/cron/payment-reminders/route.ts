import { NextResponse } from 'next/server'
import { render } from '@react-email/components'
import { createAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { PaymentReminderEmail } from '@/emails/payment-reminder'
import { InvoiceUncollectibleEmail } from '@/emails/invoice-uncollectible'
import { formatCurrency, formatDate } from '@/lib/utils'
import { recordXrplEvent } from '@/lib/xrpl-events'

// Días de cadencia entre recordatorios
const DIAS_ENTRE_RECORDATORIOS: Record<number, number> = {
  1: 0,  // 1º: al vencer (last_reminder_at IS NULL)
  2: 7,  // 2º: 7 días después del 1º
  3: 15, // 3º: 15 días después del 2º
}

// Días máximos antes de marcar como incobrable
const DIAS_LIMITE_INCOBRABLE = 30

type FacturaPendiente = {
  id: string
  numero: string
  total: number
  fecha_vencimiento: string
  reminders_sent: number
  last_reminder_at: string | null
  payment_token: string | null
  payment_link_url: string | null
  user_id: string
  clientes: { nombre: string; email: string | null } | null
  profiles: { email: string; nombre: string | null } | null
}

function diasDesde(fecha: string): number {
  return Math.floor((Date.now() - new Date(fecha).getTime()) / (1000 * 60 * 60 * 24))
}

function debeEnviarRecordatorio(factura: FacturaPendiente): boolean {
  const { reminders_sent, last_reminder_at, fecha_vencimiento } = factura
  const diasVencida = diasDesde(fecha_vencimiento)

  // No procesar si ya se superó el límite de incobrable (se trata por separado)
  if (diasVencida > DIAS_LIMITE_INCOBRABLE) return false
  // Límite de 3 recordatorios
  if (reminders_sent >= 3) return false

  if (reminders_sent === 0) {
    // 1º recordatorio: al vencer (>= 0 días)
    return diasVencida >= 0
  }

  if (!last_reminder_at) return false

  const diasDesdeUltimo = diasDesde(last_reminder_at)
  const espera = DIAS_ENTRE_RECORDATORIOS[reminders_sent + 1]
  return diasDesdeUltimo >= espera
}

function esIncobrable(factura: FacturaPendiente): boolean {
  return (
    factura.reminders_sent >= 3 &&
    diasDesde(factura.fecha_vencimiento) > DIAS_LIMITE_INCOBRABLE
  )
}

// Cron diario a las 9:00 — recordatorios de pago + marcado de incobrables
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const ahora = new Date().toISOString()

  // Marcar como 'vencida' las facturas emitidas cuya fecha_vencimiento ya pasó
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('facturas')
    .update({ estado: 'vencida' })
    .eq('estado', 'emitida')
    .lt('fecha_vencimiento', ahora)
    .not('fecha_vencimiento', 'is', null)

  // Facturas vencidas con < 3 recordatorios
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: facturasPendientes, error } = await (supabase as any)
    .from('facturas')
    .select(`
      id, numero, total, fecha_vencimiento, reminders_sent, last_reminder_at,
      payment_token, payment_link_url, user_id,
      clientes(nombre, email),
      profiles(email, nombre)
    `)
    .eq('estado', 'vencida')
    .lt('reminders_sent', 3)
    .not('fecha_vencimiento', 'is', null)
    .not('clientes', 'is', null) as { data: FacturaPendiente[] | null; error: unknown }

  if (error) {
    console.error('[cron/payment-reminders] Error consultando facturas:', error)
    return NextResponse.json({ error: 'Error consultando facturas' }, { status: 500 })
  }

  // Facturas vencidas con 3 recordatorios agotados (candidatas a incobrable)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: candidatasIncobrable } = await (supabase as any)
    .from('facturas')
    .select(`
      id, numero, total, fecha_vencimiento, reminders_sent, last_reminder_at,
      payment_token, payment_link_url, user_id,
      clientes(nombre, email),
      profiles(email, nombre)
    `)
    .eq('estado', 'vencida')
    .eq('reminders_sent', 3)
    .not('fecha_vencimiento', 'is', null) as { data: FacturaPendiente[] | null }

  const todasLasFacturas = [...(facturasPendientes ?? []), ...(candidatasIncobrable ?? [])]

  let recordatoriosEnviados = 0
  let incobrablesMarcados = 0
  const errores: string[] = []
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? 'https://facturx.es'

  for (const factura of todasLasFacturas) {
    try {
      // ── Caso 1: marcar como incobrable ──────────────────────────────────
      if (esIncobrable(factura)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('facturas')
          .update({ estado: 'cancelada' })
          .eq('id', factura.id)

        const emisorEmail = factura.profiles?.email
        if (emisorEmail) {
          const html = await render(
            InvoiceUncollectibleEmail({
              invoiceNumber: factura.numero,
              clientName: factura.clientes?.nombre ?? 'Cliente',
              amount: formatCurrency(factura.total),
              dueDate: formatDate(factura.fecha_vencimiento),
              emisorEmail,
            })
          )
          await getResend().emails.send({
            from: 'FacturX <no-reply@facturx.es>',
            to: emisorEmail,
            subject: `Factura ${factura.numero} marcada como incobrable`,
            html,
          })
        }

        // XRPL: invoice_overdue (fire-and-forget)
        recordXrplEvent({
          userId:    factura.user_id,
          eventType: 'invoice_overdue',
          invoiceId: factura.id,
          payload: {
            invoiceNumber: factura.numero,
            amount:        factura.total,
            daysPastDue:   diasDesde(factura.fecha_vencimiento),
            clientName:    factura.clientes?.nombre ?? 'Desconocido',
          },
        }).catch(() => {})

        incobrablesMarcados++
        console.log(`[cron/reminders] Incobrable: ${factura.numero}`)
        continue
      }

      // ── Caso 2: enviar recordatorio ──────────────────────────────────────
      if (!debeEnviarRecordatorio(factura)) continue

      const clienteEmail = factura.clientes?.email
      if (!clienteEmail) continue

      const numeroRecordatorio = (factura.reminders_sent + 1) as 1 | 2 | 3
      const paymentUrl = factura.payment_link_url
        ?? (factura.payment_token ? `${origin}/pay/${factura.payment_token}` : null)

      if (!paymentUrl) {
        console.warn(`[cron/reminders] Factura ${factura.numero} sin URL de pago — omitida`)
        continue
      }

      const html = await render(
        PaymentReminderEmail({
          invoiceNumber: factura.numero,
          clientName: factura.clientes?.nombre ?? 'Cliente',
          amount: formatCurrency(factura.total),
          dueDate: formatDate(factura.fecha_vencimiento),
          paymentUrl,
          reminderNumber: numeroRecordatorio,
        })
      )

      const subjects: Record<number, string> = {
        1: `Recordatorio de pago — Factura ${factura.numero}`,
        2: `2º recordatorio — Factura ${factura.numero} pendiente de pago`,
        3: `Aviso final — Factura ${factura.numero} impagada`,
      }

      await getResend().emails.send({
        from: 'FacturX <no-reply@facturx.es>',
        to: clienteEmail,
        subject: subjects[numeroRecordatorio],
        html,
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('facturas')
        .update({
          reminders_sent: numeroRecordatorio,
          last_reminder_at: ahora,
        })
        .eq('id', factura.id)

      recordatoriosEnviados++
      console.log(`[cron/reminders] Recordatorio ${numeroRecordatorio} → ${factura.numero} (${clienteEmail})`)

    } catch (err) {
      const msg = `Error procesando factura ${factura.numero}: ${String(err)}`
      console.error(`[cron/reminders] ${msg}`)
      errores.push(msg)
    }
  }

  console.log(`[cron/payment-reminders] Completado: ${recordatoriosEnviados} recordatorios, ${incobrablesMarcados} incobrables`)

  return NextResponse.json({
    ok: true,
    recordatoriosEnviados,
    incobrablesMarcados,
    errores: errores.length > 0 ? errores : undefined,
  })
}
