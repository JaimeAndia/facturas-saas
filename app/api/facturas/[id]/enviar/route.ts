import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { render } from '@react-email/components'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { resend } from '@/lib/resend/client'
import { FacturaPDF } from '@/components/facturas/FacturaPDF'
import { FacturaEmail } from '@/emails/FacturaEmail'
import { formatDate } from '@/lib/utils'
import type { Factura, LineaFactura, Cliente, Profile } from '@/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Cargar factura + perfil en paralelo
  const [{ data: rawFactura }, { data: rawPerfil }] = await Promise.all([
    supabase
      .from('facturas')
      .select('*, clientes(*), lineas_factura(*)')
      .eq('id', id)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('profiles')
      .select('nombre, apellidos, nif, email, telefono, direccion, ciudad, codigo_postal, provincia, logo_url')
      .eq('id', user.id)
      .single(),
  ])

  if (!rawFactura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = rawFactura as any
  const factura: Factura & { lineas: LineaFactura[]; cliente: Cliente } = {
    ...(raw as Factura),
    lineas: (raw.lineas_factura ?? []) as LineaFactura[],
    cliente: raw.clientes as Cliente,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perfil = (rawPerfil as any) ?? {} as Pick<Profile, 'nombre' | 'apellidos' | 'nif' | 'email' | 'telefono' | 'direccion' | 'ciudad' | 'codigo_postal' | 'provincia' | 'logo_url'>

  if (!factura.cliente.email) {
    return NextResponse.json({ error: 'El cliente no tiene email configurado' }, { status: 400 })
  }

  const nombreEmisor = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') || 'Tu proveedor'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    // 1. Generar PDF como buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await (renderToBuffer as any)(
      createElement(FacturaPDF, { factura, perfil })
    ) as Buffer

    // 2. Renderizar plantilla React Email a HTML
    const html = await render(
      createElement(FacturaEmail, {
        numeroFactura: factura.numero,
        nombreEmisor,
        nombreCliente: factura.cliente.nombre,
        fechaEmision: formatDate(factura.fecha_emision),
        fechaVencimiento: factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : null,
        lineas: factura.lineas
          .sort((a, b) => a.orden - b.orden)
          .map((l) => ({
            descripcion: l.descripcion,
            cantidad: l.cantidad,
            precio_unitario: l.precio_unitario,
            subtotal: l.subtotal,
          })),
        baseImponible: factura.base_imponible,
        ivaPorcentaje: factura.iva_porcentaje,
        ivaImporte: factura.iva_importe,
        irpfPorcentaje: factura.irpf_porcentaje,
        irpfImporte: factura.irpf_importe,
        total: factura.total,
        notas: factura.notas,
        urlDescarga: `${appUrl}/api/facturas/${id}/pdf`,
      })
    )

    // 3. Enviar email con Resend (PDF adjunto)
    const { error: errorResend } = await resend.emails.send({
      from: `${nombreEmisor} <facturas@resend.dev>`,
      to: factura.cliente.email,
      subject: `Factura ${factura.numero} de ${nombreEmisor}`,
      html,
      attachments: [
        {
          filename: `${factura.numero}.pdf`,
          content: pdfBuffer,
        },
      ],
    })

    if (errorResend) {
      console.error('Error Resend:', errorResend)
      return NextResponse.json({ error: 'Error enviando el email' }, { status: 500 })
    }

    // 4. Actualizar estado y fecha_envio en Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('facturas') as any)
      .update({
        estado: factura.estado === 'borrador' ? 'emitida' : factura.estado,
        fecha_envio: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', user.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Error enviando factura por email:', err)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
