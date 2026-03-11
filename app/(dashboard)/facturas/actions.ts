'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'
import { formatCurrency, formatDate } from '@/lib/utils'

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
  await (supabase.from('lineas_factura') as any).insert(lineas)

  revalidatePath('/facturas')
  return { ok: true, datos: { id: nueva.id } }
}

export async function eliminarFactura(id: string): Promise<ResultadoAccion> {
  const { supabase, user } = await obtenerUsuario()
  if (!user) return { ok: false, error: 'No autenticado' }

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
      .select('*, clientes(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('nombre, apellidos, email, nif')
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
    const emisor = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(' ') || 'Tu proveedor'

    await getResend().emails.send({
      from: `${emisor} <facturas@resend.dev>`,
      to: factura.clientes.email,
      subject: `Factura ${factura.numero} — ${formatCurrency(factura.total)}`,
      html: `
        <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1e3a5f;">Factura ${factura.numero}</h2>
          <p>Estimado/a <strong>${factura.clientes.nombre}</strong>,</p>
          <p>Te remitimos la factura correspondiente:</p>
          <table style="width:100%; border-collapse:collapse; margin: 16px 0;">
            <tr style="background:#f3f4f6;">
              <td style="padding:8px; font-weight:bold;">Número</td>
              <td style="padding:8px;">${factura.numero}</td>
            </tr>
            <tr>
              <td style="padding:8px; font-weight:bold;">Fecha</td>
              <td style="padding:8px;">${formatDate(factura.fecha_emision)}</td>
            </tr>
            ${factura.fecha_vencimiento ? `
            <tr style="background:#f3f4f6;">
              <td style="padding:8px; font-weight:bold;">Vencimiento</td>
              <td style="padding:8px;">${formatDate(factura.fecha_vencimiento)}</td>
            </tr>` : ''}
            <tr style="background:#dbeafe;">
              <td style="padding:8px; font-weight:bold;">Total</td>
              <td style="padding:8px; font-weight:bold; font-size:18px;">${formatCurrency(factura.total)}</td>
            </tr>
          </table>
          <p style="color:#6b7280; font-size:14px;">Un saludo,<br><strong>${emisor}</strong></p>
        </div>
      `,
    })

    // Pasar a "emitida" si estaba en borrador
    if (factura.estado === 'borrador') {
      await actualizarEstadoFactura(id, 'emitida')
    }

    return { ok: true }
  } catch {
    return { ok: false, error: 'Error enviando el email. Verifica la configuración de Resend.' }
  }
}
