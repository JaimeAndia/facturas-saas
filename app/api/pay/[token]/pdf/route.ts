import { NextResponse } from 'next/server'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { renderToBuffer } from '@react-pdf/renderer'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/server'
import { FacturaPDF } from '@/components/facturas/FacturaPDF'
import type { Factura, LineaFactura, Cliente } from '@/types'

interface RouteParams {
  params: Promise<{ token: string }>
}

// Endpoint público para descargar el PDF de una factura mediante su payment_token
export async function GET(_request: Request, { params }: RouteParams) {
  const { token } = await params
  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawFactura } = await (supabase as any)
    .from('facturas')
    .select('*, clientes(*), lineas_factura(*)')
    .eq('payment_token', token)
    .single()

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

  // Cargar perfil del emisor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawPerfil } = await (supabase as any)
    .from('profiles')
    .select('nombre, apellidos, nif, email, telefono, direccion, ciudad, codigo_postal, provincia, logo_url, iban')
    .eq('id', raw.user_id)
    .single()

  const perfil = rawPerfil ?? {
    nombre: null, apellidos: null, nif: null, email: '',
    telefono: null, direccion: null, ciudad: null,
    codigo_postal: null, provincia: null, logo_url: null,
  }

  // Obtener tx hash XRPL — busca siempre el más reciente liquidado,
  // independientemente de cuándo se descargue el PDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: logRow } = await (supabase.from('payment_logs') as any)
    .select('xrpl_settlement_tx')
    .eq('invoice_id', raw.id)
    .eq('xrpl_settlement_status', 'settled')
    .order('xrpl_settled_at', { ascending: false })
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
  const verifyUrl = blockchainTx ? `${appUrl}/verify/${raw.id}` : null

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
    console.error('Error generando PDF público:', err)
    return NextResponse.json({ error: 'Error generando el PDF' }, { status: 500 })
  }
}
