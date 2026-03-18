import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { render } from '@react-email/components'
import { createAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { FacturaPDF } from '@/components/facturas/FacturaPDF'
import { FacturaEmail } from '@/emails/FacturaEmail'
import { formatDate } from '@/lib/utils'
import { calcularProximaFecha } from '@/lib/utils'
import { registrarEventoBlockchain } from '@/lib/blockchain-event'
import { recordXrplEvent } from '@/lib/xrpl-events'
import type { Factura, LineaFactura, Cliente } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  // Verificar que la llamada viene de Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = await createAdminClient()
  const hoy = new Date().toISOString().split('T')[0]

  // Obtener recurrentes activas cuya próxima fecha ya ha llegado
  // Solo las de modo manual (cobro_automatico = false) — las automáticas las gestiona Stripe
  // Para usuarios con plan Básico o Pro activo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recurrentes, error } = await (supabase.from('facturas_recurrentes') as any)
    .select(`
      *,
      profiles!inner(plan, plan_status, nombre, apellidos, email, nif, telefono, direccion, ciudad, codigo_postal, provincia, logo_url, iban, stripe_account_id, stripe_account_status, xrpl_addon, xrpl_address),
      facturas!factura_base_id!inner(*, clientes(*), lineas_factura(*))
    `)
    .eq('activo', true)
    .eq('cobro_automatico', false)   // Stripe gestiona las automáticas — el cron no las toca
    .lte('proxima_fecha', hoy)
    .in('profiles.plan', ['basico', 'pro'])
    .eq('profiles.plan_status', 'active')

  if (error) {
    console.error('Error cargando recurrentes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const generadas: string[] = []
  const fallidas: string[] = []

  // ── Auto-cancelación: facturas recurrentes no pagadas pasada su fecha límite ──
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: facturasVencidas } = await (supabase.from('facturas') as any)
    .select('id, factura_recurrente_id, profiles!facturas_user_id_fkey(id)')
    .eq('estado', 'emitida')
    .not('cancel_deadline', 'is', null)
    .not('factura_recurrente_id', 'is', null)
    .lt('cancel_deadline', new Date().toISOString()) as { data: { id: string; factura_recurrente_id: string; profiles: { id: string } }[] | null }

  for (const fv of (facturasVencidas ?? [])) {
    try {
      // Verificar que la recurrente aún está activa
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rec } = await (supabase.from('facturas_recurrentes') as any)
        .select('id, activo, user_id')
        .eq('id', fv.factura_recurrente_id)
        .single() as { data: { id: string; activo: boolean; user_id: string } | null }

      if (!rec || !rec.activo) continue

      // Cancelar la recurrencia
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('facturas_recurrentes') as any)
        .update({ activo: false })
        .eq('id', rec.id)

      // Notificar al autónomo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('notificaciones') as any).insert({
        user_id: rec.user_id,
        tipo: 'recurrente_autocancelada',
        mensaje: 'Una factura recurrente se ha cancelado automáticamente por falta de pago pasado el plazo de 3 días.',
        metadata: { recurrente_id: rec.id, factura_id: fv.id },
      })

      console.log(`[Cron] Recurrente ${rec.id} auto-cancelada por impago`)
    } catch (err) {
      console.error(`[Cron] Error auto-cancelando recurrente ${fv.factura_recurrente_id}:`, err)
    }
  }

  for (const recurrente of (recurrentes ?? [])) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const original = recurrente.facturas as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const perfil = recurrente.profiles as any

      // 1. Generar nuevo número correlativo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: nuevoNumero } = await (supabase.rpc as any)(
        'fn_generar_numero_factura',
        { p_user_id: recurrente.user_id }
      )

      // 2. Crear nueva factura basada en la original, enlazada a su recurrente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: nuevaFactura, error: errFactura } = await (supabase.from('facturas') as any)
        .insert({
          user_id: recurrente.user_id,
          cliente_id: original.cliente_id,
          numero: nuevoNumero as string,
          fecha_emision: hoy,
          fecha_vencimiento: null,
          estado: 'emitida',
          base_imponible: original.base_imponible,
          iva_porcentaje: original.iva_porcentaje,
          iva_importe: original.iva_importe,
          irpf_porcentaje: original.irpf_porcentaje,
          irpf_importe: original.irpf_importe,
          total: original.total,
          notas: original.notas,
          fecha_envio: new Date().toISOString(),
          factura_recurrente_id: recurrente.id,
        })
        .select('id, numero, payment_token')
        .single()

      if (errFactura) throw new Error(errFactura.message)

      // Calcular cancel_deadline (3 días) y URL de cancelación para el email
      const cancelDeadline = new Date()
      cancelDeadline.setDate(cancelDeadline.getDate() + 3)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('facturas') as any)
        .update({ cancel_deadline: cancelDeadline.toISOString() })
        .eq('id', nuevaFactura.id)

      const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/cancelar-recurrencia?id=${recurrente.id}&token=${recurrente.cancel_token}`
      const fechaLimiteCancelacion = cancelDeadline.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })

      // 3a. Si el autónomo tiene Stripe Connect activo, generar y guardar link de pago
      const stripeActivo = perfil.stripe_account_status === 'active' && perfil.stripe_account_id
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
      let paymentLinkUrl: string | null = null

      if (stripeActivo && nuevaFactura.payment_token) {
        paymentLinkUrl = `${appUrl}/pay/${nuevaFactura.payment_token}`
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('facturas') as any)
          .update({ payment_link_url: paymentLinkUrl })
          .eq('id', nuevaFactura.id)
      }

      // 3b. Copiar líneas de la factura base
      const lineas = (original.lineas_factura ?? []).map((l: LineaFactura) => ({
        factura_id: nuevaFactura.id,
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: l.precio_unitario,
        subtotal: l.subtotal,
        orden: l.orden,
      }))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('lineas_factura') as any).insert(lineas)

      // 4. Enviar email con PDF (y link de pago si está disponible) si el cliente tiene email
      const cliente = original.clientes as Cliente
      if (cliente.email) {
        const facturaCompleta: Factura & { lineas: LineaFactura[]; cliente: Cliente } = {
          ...(original as Factura),
          id: nuevaFactura.id,
          numero: nuevaFactura.numero,
          fecha_emision: hoy,
          estado: 'emitida',
          lineas: lineas.map((l: LineaFactura, i: number) => ({ ...original.lineas_factura[i], ...l })),
          cliente,
        }

        const nombreEmisor = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') || 'Tu proveedor'
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfBuffer = await (renderToBuffer as any)(
          createElement(FacturaPDF, { factura: facturaCompleta, perfil })
        ) as Buffer

        const html = await render(
          createElement(FacturaEmail, {
            numeroFactura: nuevaFactura.numero,
            nombreEmisor,
            nombreCliente: cliente.nombre,
            fechaEmision: formatDate(hoy),
            fechaVencimiento: null,
            lineas: facturaCompleta.lineas.map((l) => ({
              descripcion: l.descripcion,
              cantidad: l.cantidad,
              precio_unitario: l.precio_unitario,
              subtotal: l.subtotal,
            })),
            baseImponible: original.base_imponible,
            ivaPorcentaje: original.iva_porcentaje,
            ivaImporte: original.iva_importe,
            irpfPorcentaje: original.irpf_porcentaje,
            irpfImporte: original.irpf_importe,
            total: original.total,
            notas: original.notas,
            urlDescarga: `${appUrl}/api/pay/${nuevaFactura.payment_token}/pdf`,
            urlPago: paymentLinkUrl,
            urlCancelacion: cancelUrl,
            fechaLimiteCancelacion,
          })
        )

        await getResend().emails.send({
          from: process.env.RESEND_FROM ?? `${nombreEmisor} <onboarding@resend.dev>`,
          to: cliente.email,
          subject: `Factura ${nuevaFactura.numero} de ${nombreEmisor}`,
          html,
          attachments: [{ filename: `${nuevaFactura.numero}.pdf`, content: pdfBuffer }],
        })
      }

      // 4b. Registrar en blockchain si el usuario tiene acceso XRPL (proof of issuance)
      const tieneXrpl = perfil.plan === 'pro' || !!perfil.xrpl_addon
      if (tieneXrpl && perfil.xrpl_address) {
        registrarEventoBlockchain(nuevaFactura.id, recurrente.user_id, 'generacion_recurrente').then(res => {
          if (res) console.log(`[Blockchain] Factura recurrente ${nuevaFactura.id} registrada: ${res.txHash}`)
        })
      }

      // xrpl_events: invoice_created para todas las facturas generadas por el cron
      recordXrplEvent({
        userId:    recurrente.user_id,
        eventType: 'invoice_created',
        invoiceId: nuevaFactura.id,
        payload: {
          invoiceNumber: nuevaFactura.numero,
          amount:        original.total,
          currency:      'EUR',
          isRecurring:   true,
          recurrenteId:  recurrente.id,
        },
      }).catch(() => {})

      // 5. Actualizar proxima_fecha y ultima_generacion
      const nuevaProximaFecha = calcularProximaFecha(
        new Date(recurrente.proxima_fecha),
        recurrente.frecuencia
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('facturas_recurrentes') as any)
        .update({
          proxima_fecha: nuevaProximaFecha,
          ultima_generacion: new Date().toISOString(),
        })
        .eq('id', recurrente.id)

      generadas.push(nuevaFactura.numero)
    } catch (err) {
      console.error(`Error procesando recurrente ${recurrente.id}:`, err)
      fallidas.push(recurrente.id)
    }
  }

  console.log(`Cron facturas recurrentes: ${generadas.length} generadas, ${fallidas.length} fallidas`)
  return NextResponse.json({ generadas, fallidas })
}
