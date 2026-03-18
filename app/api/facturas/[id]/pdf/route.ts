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
      .select('nombre, apellidos, nif, email, telefono, direccion, ciudad, codigo_postal, provincia, logo_url, iban')
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

  // Obtener tx hash XRPL si el pago está liquidado
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logRow } = await (supabase.from('payment_logs') as any)
    .select('xrpl_settlement_tx')
    .eq('invoice_id', id)
    .eq('xrpl_settlement_status', 'settled')
    .order('created_at', { ascending: false })
    .limit(1)
    .single() as { data: { xrpl_settlement_tx: string | null } | null }

  const xrplTxHash = logRow?.xrpl_settlement_tx ?? null
  const isTestnet = (process.env.XRPL_NETWORK ?? '').includes('altnet')
  const explorerBase = isTestnet
    ? 'https://testnet.xrpl.org/transactions'
    : 'https://xrpl.org/transactions'
  const xrplExplorerUrl = xrplTxHash ? `${explorerBase}/${xrplTxHash}` : null

  // Datos de registro blockchain (integridad de la factura)
  const blockchainTx = (raw as { blockchain_tx?: string | null }).blockchain_tx ?? null
  const blockchainHash = (raw as { blockchain_hash?: string | null }).blockchain_hash ?? null
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://facturx.es'
  const verifyUrl = blockchainTx ? `${appUrl}/verify/${id}` : null

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await (renderToBuffer as any)(
      createElement(FacturaPDF, { factura, perfil, xrplTxHash, xrplExplorerUrl, blockchainTx, blockchainHash, verifyUrl })
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
