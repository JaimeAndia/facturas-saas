import { NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { FacturaPDF } from '@/components/facturas/FacturaPDF'
import type { Factura, LineaFactura, Cliente } from '@/types'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Cargar factura con líneas y cliente en paralelo con el perfil
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
  const factura = {
    ...(raw as Factura),
    lineas: (raw.lineas_factura ?? []) as LineaFactura[],
    cliente: raw.clientes as Cliente,
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perfil = (rawPerfil as any) ?? {
    nombre: null, apellidos: null, nif: null, email: '',
    telefono: null, direccion: null, ciudad: null,
    codigo_postal: null, provincia: null, logo_url: null,
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await (renderToBuffer as any)(
      createElement(FacturaPDF, { factura, perfil })
    )

    return new NextResponse(buffer as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${factura.numero}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Error generando PDF:', err)
    return NextResponse.json({ error: 'Error generando el PDF' }, { status: 500 })
  }
}
