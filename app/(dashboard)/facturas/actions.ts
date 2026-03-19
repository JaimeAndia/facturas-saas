'use server'

import { createElement } from 'react'
import { revalidatePath } from 'next/cache'
import { renderToBuffer } from '@react-pdf/renderer'
import { render } from '@react-email/components'
import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { FacturaPDF } from '@/components/facturas/FacturaPDF'
import { FacturaEmail } from '@/emails/FacturaEmail'
import { formatCurrency, formatDate } from '@/lib/utils'
import { registrarEventoBlockchain, type BlockchainEventType } from '@/lib/blockchain-event'
import { recordXrplEvent } from '@/lib/xrpl-events'

export type ResultadoAccion<T = void> =
  | { ok: true; datos?: T }
  | { ok: false; error: string }

export interface LineaInput {
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  orden: number
}

export interface FacturaInput {
  cliente_id: string
  numero?: string
  fecha_emision: string
  fecha_vencimiento?: string | null
  estado: 'borrador' | 'emitida'
  base_imponible: number
  iva_porcentaje: number
  iva_importe: number
  irpf_porcentaje: number
  irpf_importe: number
  total: number
  notas?: string | null
  lineas: LineaInput[]
}

// Helper: obtiene usuario y cliente supabase
async function obtenerUsuario() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function crearFactura(
  datos: FacturaInput
): Promise<ResultadoAccion<{ id: string; numero: string }>> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

  // Usar número manual si se proporcionó, si no generar automáticamente
  let numero: string
  if (datos.numero) {
    numero = datos.numero
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: numeroGenerado, error: errorNumero } = await (supabase.rpc as any)(
      'fn_generar_numero_factura', { p_user_id: user.id }
    )
    if (errorNumero || !numeroGenerado) {
      return { ok: false, error: 'Error generando número de factura' }
    }
    numero = numeroGenerado as string
  }

  // Insertar factura
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura, error: errorFactura } = await (supabase.from('facturas') as any)
    .insert({
      user_id: user.id,
      cliente_id: datos.cliente_id,
      numero: numero as string,
      fecha_emision: datos.fecha_emision,
      fecha_vencimiento: datos.fecha_vencimiento ?? null,
      estado: datos.estado,
      base_imponible: datos.base_imponible,
      iva_porcentaje: datos.iva_porcentaje,
      iva_importe: datos.iva_importe,
      irpf_porcentaje: datos.irpf_porcentaje,
      irpf_importe: datos.irpf_importe,
      total: datos.total,
      notas: datos.notas ?? null,
    })
    .select('id, numero')
    .single()

  if (errorFactura) return { ok: false, error: errorFactura.message }

  // Insertar líneas
  const lineas = datos.lineas.map((l, i) => ({
    factura_id: factura.id,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    subtotal: l.subtotal,
    orden: l.orden ?? i,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errorLineas } = await (supabase.from('lineas_factura') as any).insert(lineas)

  if (errorLineas) {
    // Revertir: borrar la factura si las líneas fallaron
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any).delete().eq('id', factura.id)
    return { ok: false, error: errorLineas.message }
  }

  revalidatePath('/facturas')

  if (datos.estado === 'emitida') {
    registrarEventoBlockchain(factura.id, user.id, 'emision').catch(err => {
      console.error('[BlockchainEvent] Error en crearFactura (emision):', err)
    })
  }

  return { ok: true, datos: { id: factura.id, numero: factura.numero } }
}

export async function actualizarEstadoFactura(
  id: string,
  estado: 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'cancelada'
): Promise<ResultadoAccion> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas') as any)
    .update({ estado })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/facturas')
  revalidatePath(`/facturas/${id}`)

  // Registrar evento blockchain fire-and-forget según el nuevo estado
  const estadosBlockchain: Partial<Record<string, BlockchainEventType>> = {
    emitida: 'emision',
    cancelada: 'cancelacion',
    vencida: 'vencimiento',
  }
  const tipoEvento = estadosBlockchain[estado]
  if (tipoEvento) {
    registrarEventoBlockchain(id, user.id, tipoEvento).catch(err => {
      console.error('[BlockchainEvent] Error fire-and-forget en actualizarEstadoFactura:', err)
    })
  }

  return { ok: true }
}

export async function duplicarFactura(
  id: string
): Promise<ResultadoAccion<{ id: string }>> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

  // Cargar factura original con sus líneas
  const { data: rawOriginal } = await supabase
    .from('facturas')
    .select('*, lineas_factura(*)')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const original = rawOriginal as any
  if (!original) return { ok: false, error: 'Factura no encontrada' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: numero } = await (supabase.rpc as any)(
    'fn_generar_numero_factura', { p_user_id: user.id }
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: nueva, error: errorFactura } = await (supabase.from('facturas') as any)
    .insert({
      user_id: user.id,
      cliente_id: original.cliente_id,
      numero: (numero ?? '') as string,
      fecha_emision: new Date().toISOString().split('T')[0],
      fecha_vencimiento: null,
      estado: 'borrador',
      base_imponible: original.base_imponible,
      iva_porcentaje: original.iva_porcentaje,
      iva_importe: original.iva_importe,
      irpf_porcentaje: original.irpf_porcentaje,
      irpf_importe: original.irpf_importe,
      total: original.total,
      notas: original.notas,
    })
    .select('id')
    .single()

  if (errorFactura) return { ok: false, error: errorFactura.message }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineas = (original.lineas_factura as any[]).map((l: any) => ({
    factura_id: nueva.id,
    descripcion: l.descripcion,
    cantidad: l.cantidad,
    precio_unitario: l.precio_unitario,
    subtotal: l.subtotal,
    orden: l.orden,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errorLineas } = await (supabase.from('lineas_factura') as any).insert(lineas)

  if (errorLineas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any).delete().eq('id', nueva.id)
    return { ok: false, error: 'Error copiando las líneas de la factura' }
  }

  revalidatePath('/facturas')
  return { ok: true, datos: { id: nueva.id } }
}

export async function eliminarFactura(id: string): Promise<ResultadoAccion> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

  // Impedir eliminar si es la factura base de una recurrente activa
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recurrenteActiva } = await (supabase.from('facturas_recurrentes') as any)
    .select('id')
    .eq('factura_base_id', id)
    .eq('activo', true)
    .maybeSingle() as { data: { id: string } | null }

  if (recurrenteActiva) {
    return { ok: false, error: 'No puedes eliminar una factura con una suscripción recurrente activa. Desactiva primero la recurrente.' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/facturas')
  return { ok: true }
}

export async function enviarFacturaPorEmail(id: string): Promise<ResultadoAccion> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

  const [{ data: rawFactura }, { data: rawPerfil }] = await Promise.all([
    supabase
      .from('facturas')
      .select('*, clientes(*), lineas_factura(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('nombre, apellidos, email, nif, telefono, direccion, ciudad, codigo_postal, provincia, logo_url, iban')
      .eq('id', user.id)
      .single(),
  ])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factura = rawFactura as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perfil = rawPerfil as any

  if (!factura) return { ok: false, error: 'Factura no encontrada' }
  if (!factura.clientes?.email) {
    return { ok: false, error: 'El cliente no tiene email configurado' }
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    const emisor = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(' ') || 'Tu proveedor'
    const urlDescarga = factura.payment_token
      ? `${appUrl}/api/pay/${factura.payment_token}/pdf`
      : `${appUrl}/api/facturas/${id}/pdf`
    const urlPago = factura.payment_token ? (factura.payment_link_url ?? null) : null

    // ── Generar PDF ──────────────────────────────────────────────────────────
    const pdfBuffer = await renderToBuffer(
      createElement(FacturaPDF, { factura, perfil })
    )

    // ── Generar HTML del email ───────────────────────────────────────────────
    const lineas = (factura.lineas_factura ?? []).sort(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0)
    )

    const html = await render(
      createElement(FacturaEmail, {
        numeroFactura:    factura.numero,
        nombreEmisor:     emisor,
        nombreCliente:    factura.clientes.nombre,
        fechaEmision:     formatDate(factura.fecha_emision),
        fechaVencimiento: factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : null,
        lineas,
        baseImponible:    factura.base_imponible,
        ivaPorcentaje:    factura.iva_porcentaje,
        ivaImporte:       factura.iva_importe,
        irpfPorcentaje:   factura.irpf_porcentaje ?? 0,
        irpfImporte:      factura.irpf_importe ?? 0,
        total:            factura.total,
        notas:            factura.notas ?? null,
        urlDescarga,
        urlPago,
      })
    )

    // ── Enviar email con PDF adjunto ─────────────────────────────────────────
    await getResend().emails.send({
      from:    process.env.RESEND_FROM ?? `${emisor} <onboarding@resend.dev>`,
      to:      factura.clientes.email,
      subject: `Factura ${factura.numero} — ${formatCurrency(factura.total)}`,
      html,
      attachments: [
        {
          filename: `Factura-${factura.numero}.pdf`,
          content:  pdfBuffer,
        },
      ],
    })

    // ── Actualizar estado y fecha de envío ───────────────────────────────────
    const updates: Record<string, unknown> = { fecha_envio: new Date().toISOString() }
    if (factura.estado === 'borrador') updates.estado = 'emitida'
    await supabase.from('facturas').update(updates).eq('id', id).eq('user_id', user.id)

    revalidatePath(`/facturas/${id}`)

    // XRPL: invoice_sent (fire-and-forget)
    recordXrplEvent({
      userId: user.id, eventType: 'invoice_sent', invoiceId: id,
      payload: {
        invoiceNumber: factura.numero,
        clientEmail:   factura.clientes?.email ?? null,
        amount:        factura.total,
      },
    }).catch(() => {})

    return { ok: true }
  } catch {
    return { ok: false, error: 'Error enviando el email. Verifica la configuración de Resend.' }
  }
}
