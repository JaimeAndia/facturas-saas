'use server'

import { createElement } from 'react'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { renderToBuffer } from '@react-pdf/renderer'
import { render } from '@react-email/components'
import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { calcularProximaFecha, formatDate } from '@/lib/utils'
import { registrarEventoBlockchain } from '@/lib/blockchain-event'
import { recordXrplEvent } from '@/lib/xrpl-events'
import { FacturaPDF } from '@/components/facturas/FacturaPDF'
import { FacturaEmail } from '@/emails/FacturaEmail'
import type { LineaInput } from '@/app/(dashboard)/facturas/actions'
import type { LineaFactura, Cliente } from '@/types'

export { calcularProximaFecha }

export type ResultadoAccion = { ok: true } | { ok: false; error: string }

export interface FacturaRecurrenteInput {
  cliente_id: string
  frecuencia: string
  fecha_emision: string
  base_imponible: number
  iva_porcentaje: number
  iva_importe: number
  irpf_porcentaje: number
  irpf_importe: number
  total: number
  notas?: string | null
  lineas: LineaInput[]
}

// Crea la factura base, la programación recurrente y envía la primera factura al cliente.
// Requiere que el cliente tenga email. Si el envío falla, se hace rollback de todo.
export async function crearFacturaRecurrente(
  datos: FacturaRecurrenteInput
): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // ── 1. Validaciones previas a cualquier escritura en BD ──────────────────────

  // Perfil completo en una sola query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase.from('profiles') as any)
    .select(`
      plan, plan_status,
      nombre, apellidos, email, nif,
      telefono, direccion, ciudad, codigo_postal, provincia,
      logo_url, stripe_account_id, stripe_account_status,
      xrpl_addon, xrpl_address
    `)
    .eq('id', user.id)
    .single()

  const planValido = perfil?.plan === 'basico' || perfil?.plan === 'pro'
  if (!planValido || perfil?.plan_status !== 'active') {
    return { ok: false, error: 'Las facturas recurrentes requieren el plan Básico o superior' }
  }

  // Email del cliente es obligatorio — validar antes de crear nada
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: cliente } = await (supabase.from('clientes') as any)
    .select('id, nombre, email, nif, direccion, ciudad, codigo_postal, provincia, pais')
    .eq('id', datos.cliente_id)
    .eq('user_id', user.id)
    .single() as { data: Cliente | null }

  if (!cliente) {
    return { ok: false, error: 'Cliente no encontrado' }
  }
  if (!cliente.email) {
    return { ok: false, error: 'El cliente no tiene email. Añade un email al cliente antes de crear una factura recurrente.' }
  }

  // ── 2. Escrituras en BD ──────────────────────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: numeroBase, error: errorNumeroBase } = await (supabase.rpc as any)(
    'fn_generar_numero_factura', { p_user_id: user.id }
  )
  if (errorNumeroBase || !numeroBase) return { ok: false, error: 'Error generando número de factura' }

  // Factura base (plantilla, nunca se envía directamente)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: facturaBase, error: errorFactura } = await (supabase.from('facturas') as any)
    .insert({
      user_id:         user.id,
      cliente_id:      datos.cliente_id,
      numero:          numeroBase as string,
      fecha_emision:   datos.fecha_emision,
      estado:          'borrador',
      source:          'recurrente_base',
      base_imponible:  datos.base_imponible,
      iva_porcentaje:  datos.iva_porcentaje,
      iva_importe:     datos.iva_importe,
      irpf_porcentaje: datos.irpf_porcentaje,
      irpf_importe:    datos.irpf_importe,
      total:           datos.total,
      notas:           datos.notas ?? null,
    })
    .select('id')
    .single()

  if (errorFactura) return { ok: false, error: errorFactura.message }

  const lineasBase = datos.lineas.map((l, i) => ({
    factura_id:      facturaBase.id,
    descripcion:     l.descripcion,
    cantidad:        l.cantidad,
    precio_unitario: l.precio_unitario,
    subtotal:        l.subtotal,
    orden:           l.orden ?? i,
  }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: errorLineas } = await (supabase.from('lineas_factura') as any).insert(lineasBase)
  if (errorLineas) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any).delete().eq('id', facturaBase.id)
    return { ok: false, error: errorLineas.message }
  }

  const proxima_fecha = calcularProximaFecha(new Date(datos.fecha_emision), datos.frecuencia)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recurrente, error: errorRec } = await (supabase.from('facturas_recurrentes') as any)
    .insert({
      user_id:         user.id,
      factura_base_id: facturaBase.id,
      frecuencia:      datos.frecuencia,
      proxima_fecha,
      activo:          true,
    })
    .select('id')
    .single()

  if (errorRec) return { ok: false, error: errorRec.message }

  // Primera factura real en estado 'emitida'
  const hoy = new Date().toISOString().split('T')[0]
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: primerNumero } = await (supabase.rpc as any)(
    'fn_generar_numero_factura', { p_user_id: user.id }
  ) as { data: string | null }

  if (!primerNumero) {
    // Rollback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas_recurrentes') as any).delete().eq('id', recurrente.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any).delete().eq('id', facturaBase.id)
    return { ok: false, error: 'Error generando número de la primera factura' }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: primeraFactura, error: errorPrimera } = await (supabase.from('facturas') as any)
    .insert({
      user_id:               user.id,
      cliente_id:            datos.cliente_id,
      numero:                primerNumero,
      fecha_emision:         hoy,
      estado:                'emitida',
      base_imponible:        datos.base_imponible,
      iva_porcentaje:        datos.iva_porcentaje,
      iva_importe:           datos.iva_importe,
      irpf_porcentaje:       datos.irpf_porcentaje,
      irpf_importe:          datos.irpf_importe,
      total:                 datos.total,
      notas:                 datos.notas ?? null,
      fecha_envio:           new Date().toISOString(),
      factura_recurrente_id: recurrente.id,
    })
    .select('id, numero, payment_token')
    .single() as { data: { id: string; numero: string; payment_token: string | null } | null; error: unknown }

  if (errorPrimera || !primeraFactura) {
    // Rollback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas_recurrentes') as any).delete().eq('id', recurrente.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any).delete().eq('id', facturaBase.id)
    const msg = errorPrimera instanceof Error ? errorPrimera.message : JSON.stringify(errorPrimera)
    return { ok: false, error: `Error creando la primera factura: ${msg}` }
  }

  const lineasPrimera = lineasBase.map(l => ({ ...l, factura_id: primeraFactura.id }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('lineas_factura') as any).insert(lineasPrimera)

  // Link de pago si Stripe Connect activo
  const stripeActivo = perfil.stripe_account_status === 'active' && !!perfil.stripe_account_id
  let paymentLinkUrl: string | null = null
  if (stripeActivo && primeraFactura.payment_token) {
    paymentLinkUrl = `${appUrl}/pay/${primeraFactura.payment_token}`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any)
      .update({ payment_link_url: paymentLinkUrl })
      .eq('id', primeraFactura.id)
  }

  // ── 3. Envío del email — si falla se hace rollback de todo ───────────────────

  const nombreEmisor =
    [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') ||
    'Tu proveedor'

  const lineasEmail = lineasBase.map(l => ({
    descripcion:     l.descripcion,
    cantidad:        l.cantidad,
    precio_unitario: l.precio_unitario,
    subtotal:        l.subtotal,
  }))

  const facturaParaPDF = {
    id:               primeraFactura.id,
    numero:           primeraFactura.numero,
    fecha_emision:    hoy,
    fecha_vencimiento: null,
    estado:           'emitida' as const,
    base_imponible:   datos.base_imponible,
    iva_porcentaje:   datos.iva_porcentaje,
    iva_importe:      datos.iva_importe,
    irpf_porcentaje:  datos.irpf_porcentaje,
    irpf_importe:     datos.irpf_importe,
    total:            datos.total,
    notas:            datos.notas ?? null,
    factura_recurrente_id: recurrente.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    lineas:           lineasBase as unknown as LineaFactura[],
    cliente,
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (renderToBuffer as any)(
      createElement(FacturaPDF, { factura: facturaParaPDF, perfil })
    ) as Buffer

    const html = await render(
      createElement(FacturaEmail, {
        numeroFactura:    primeraFactura.numero,
        nombreEmisor,
        nombreCliente:    cliente.nombre,
        fechaEmision:     formatDate(hoy),
        fechaVencimiento: null,
        lineas:           lineasEmail,
        baseImponible:    datos.base_imponible,
        ivaPorcentaje:    datos.iva_porcentaje,
        ivaImporte:       datos.iva_importe,
        irpfPorcentaje:   datos.irpf_porcentaje,
        irpfImporte:      datos.irpf_importe,
        total:            datos.total,
        notas:            datos.notas,
        urlDescarga:      `${appUrl}/api/pay/${primeraFactura.payment_token}/pdf`,
        urlPago:          paymentLinkUrl,
      })
    )

    const { error: errorResend } = await getResend().emails.send({
      from:        process.env.RESEND_FROM ?? `${nombreEmisor} <onboarding@resend.dev>`,
      to:          cliente.email,
      subject:     `Factura ${primeraFactura.numero} de ${nombreEmisor}`,
      html,
      attachments: [{ filename: `${primeraFactura.numero}.pdf`, content: pdfBuffer }],
    })

    if (errorResend) throw new Error(errorResend.message)

  } catch (err) {
    // El envío falló — hacer rollback de todo lo creado en BD
    console.error('[recurrente] Error enviando primera factura, haciendo rollback:', err)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('lineas_factura') as any).delete().eq('factura_id', primeraFactura.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any).delete().eq('id', primeraFactura.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas_recurrentes') as any).delete().eq('id', recurrente.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('lineas_factura') as any).delete().eq('factura_id', facturaBase.id)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any).delete().eq('id', facturaBase.id)

    return { ok: false, error: 'No se pudo enviar el email al cliente. Verifica la configuración de Resend e inténtalo de nuevo.' }
  }

  // ── 4. Post-envío (no bloquean el flujo) ────────────────────────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('facturas_recurrentes') as any)
    .update({ ultima_generacion: new Date().toISOString() })
    .eq('id', recurrente.id)

  const tieneXrpl = perfil.plan === 'pro' || !!perfil.xrpl_addon
  if (tieneXrpl && perfil.xrpl_address) {
    registrarEventoBlockchain(primeraFactura.id, user.id, 'emision').catch((err: Error) => {
      console.error('[XRPL] fallo silencioso primera factura recurrente:', err.message)
    })
  }

  // xrpl_events: invoice_created para la primera factura de la recurrente
  recordXrplEvent({
    userId:    user.id,
    eventType: 'invoice_created',
    invoiceId: primeraFactura.id,
    payload: {
      invoiceNumber: primeraFactura.numero,
      amount:        datos.total,
      currency:      'EUR',
      isRecurring:   true,
      recurrenteId:  recurrente.id,
    },
  }).catch(() => {})

  revalidatePath('/facturas/recurrentes')
  redirect('/facturas/recurrentes')
}

export async function crearRecurrente(
  facturaBaseId: string,
  frecuencia: string
): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase.from('profiles') as any)
    .select('plan, plan_status')
    .eq('id', user.id)
    .single()

  const planValido = perfil?.plan === 'basico' || perfil?.plan === 'pro'
  if (!planValido || perfil?.plan_status !== 'active') {
    return { ok: false, error: 'Las facturas recurrentes requieren el plan Básico o superior' }
  }

  const proxima_fecha = calcularProximaFecha(new Date(), frecuencia)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas_recurrentes') as any).insert({
    user_id:         user.id,
    factura_base_id: facturaBaseId,
    frecuencia,
    proxima_fecha,
    activo:          true,
  })

  if (error) return { ok: false, error: error.message }

  revalidatePath('/facturas/recurrentes')
  return { ok: true }
}

export async function toggleRecurrente(
  id: string,
  activo: boolean
): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas_recurrentes') as any)
    .update({ activo })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/facturas/recurrentes')
  return { ok: true }
}

export async function eliminarRecurrente(id: string): Promise<ResultadoAccion> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from('facturas_recurrentes') as any)
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath('/facturas/recurrentes')
  return { ok: true }
}
