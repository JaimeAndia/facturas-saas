import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { renderToBuffer } from '@react-pdf/renderer'
import { render } from '@react-email/components'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend/client'
import { FacturaPDF } from '@/components/facturas/FacturaPDF'
import { FacturaEmail } from '@/emails/FacturaEmail'
import { formatDate } from '@/lib/utils'
import { calcularProximaFecha } from '@/lib/utils'
import type { Factura, LineaFactura, Cliente } from '@/types'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  // Verificar que la llamada viene de Vercel Cron
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = await createClient()
  const hoy = new Date().toISOString().split('T')[0]

  // Obtener recurrentes activas cuya próxima fecha ya ha llegado
  // Solo de usuarios con plan Pro activo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recurrentes, error } = await (supabase.from('facturas_recurrentes') as any)
    .select(`
      *,
      profiles!inner(plan, plan_status, nombre, apellidos, email, nif, telefono, direccion, ciudad, codigo_postal, provincia, logo_url),
      facturas!inner(*, clientes(*), lineas_factura(*))
    `)
    .eq('activo', true)
    .lte('proxima_fecha', hoy)
    .eq('profiles.plan', 'pro')
    .eq('profiles.plan_status', 'active')

  if (error) {
    console.error('Error cargando recurrentes:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const generadas: string[] = []
  const fallidas: string[] = []

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

      // 2. Crear nueva factura basada en la original
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
        })
        .select('id, numero')
        .single()

      if (errFactura) throw new Error(errFactura.message)

      // 3. Copiar líneas de la factura base
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

      // 4. Enviar email con PDF si el cliente tiene email
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
            urlDescarga: `${appUrl}/api/facturas/${nuevaFactura.id}/pdf`,
          })
        )

        await resend.emails.send({
          from: `${nombreEmisor} <facturas@resend.dev>`,
          to: cliente.email,
          subject: `Factura ${nuevaFactura.numero} de ${nombreEmisor}`,
          html,
          attachments: [{ filename: `${nuevaFactura.numero}.pdf`, content: pdfBuffer }],
        })
      }

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
