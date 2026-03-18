import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { PaymentReminderEmail } from '@/emails/payment-reminder'
import { formatCurrency, formatDate } from '@/lib/utils'
import { createElement } from 'react'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST /api/invoices/[id]/reminder
// Envía un recordatorio de pago al cliente de la factura
export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Obtener la factura con datos del cliente y del emisor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase as any)
    .from('facturas')
    .select(`
      id, numero, total, fecha_vencimiento, estado, payment_link_url, reminders_sent,
      clientes(nombre, email)
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single() as {
      data: {
        id: string
        numero: string
        total: number
        fecha_vencimiento: string | null
        estado: string
        payment_link_url: string | null
        reminders_sent: number
        clientes: { nombre: string; email: string | null } | null
      } | null
    }

  if (!factura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  // Solo tiene sentido recordar facturas emitidas o vencidas
  if (factura.estado !== 'emitida' && factura.estado !== 'vencida') {
    return NextResponse.json({ error: 'Solo se pueden recordar facturas pendientes o vencidas' }, { status: 400 })
  }

  const nuevoNumeroRecordatorio = (factura.reminders_sent ?? 0) + 1
  const ahora = new Date().toISOString()

  // Actualizar contadores en la factura
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from('facturas')
    .update({
      reminders_sent: nuevoNumeroRecordatorio,
      last_reminder_at: ahora,
    })
    .eq('id', id)

  // Registrar en payment_logs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('payment_logs') as any).insert({
    invoice_id: id,
    event_type: 'reminder_sent',
    provider: 'resend',
    status: 'sent',
    amount: factura.total,
    raw_payload: { reminder_number: nuevoNumeroRecordatorio, sent_at: ahora },
  })

  // Enviar email solo si el cliente tiene dirección de email
  const clienteEmail = factura.clientes?.email
  if (clienteEmail) {
    try {
      const resend = getResend()
      const paymentUrl = factura.payment_link_url ?? `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://facturx.es'}/facturas/${id}`
      const vencimiento = factura.fecha_vencimiento
        ? formatDate(factura.fecha_vencimiento)
        : 'Sin fecha de vencimiento'

      await resend.emails.send({
        from: process.env.RESEND_FROM ?? 'FacturX <noreply@facturx.es>',
        to: clienteEmail,
        subject: nuevoNumeroRecordatorio > 1
          ? `URGENTE — Factura ${factura.numero} pendiente de pago`
          : `Recordatorio — Factura ${factura.numero} pendiente de pago`,
        react: createElement(PaymentReminderEmail, {
          invoiceNumber: factura.numero,
          clientName: factura.clientes?.nombre ?? 'Cliente',
          amount: formatCurrency(factura.total),
          dueDate: vencimiento,
          paymentUrl,
          reminderNumber: nuevoNumeroRecordatorio as 1 | 2 | 3,
        }),
      })
    } catch (emailErr) {
      // El email falla silenciosamente — el contador ya está actualizado
      console.error('[Reminder] Error enviando email:', emailErr)
    }
  }

  return NextResponse.json({
    ok: true,
    reminderNumber: nuevoNumeroRecordatorio,
    emailSent: !!clienteEmail,
  })
}
