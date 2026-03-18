import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

interface PosCheckoutBody {
  importe: number
  concepto: string
  clienteId?: string
}

// Crea una factura POS y devuelve la URL de pago para mostrar en QR.
// El cobro va directamente a la cuenta Express del autónomo via Stripe Connect.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Verificar que tiene Stripe Connect activo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase as any)
    .from('profiles')
    .select('stripe_account_status')
    .eq('id', user.id)
    .single() as { data: { stripe_account_status: string | null } | null }

  if (perfil?.stripe_account_status !== 'active') {
    return NextResponse.json(
      { error: 'Activa tu cuenta en Configuración → Cobros para cobrar' },
      { status: 403 }
    )
  }

  let body: PosCheckoutBody
  try {
    body = await request.json() as PosCheckoutBody
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { importe, concepto, clienteId } = body

  if (!importe || importe <= 0) {
    return NextResponse.json({ error: 'El importe debe ser mayor que 0' }, { status: 400 })
  }
  if (!concepto?.trim()) {
    return NextResponse.json({ error: 'El concepto es obligatorio' }, { status: 400 })
  }

  const adminSupabase = await createAdminClient()

  // Resolver el cliente — si no se especifica, usar/crear "Cobro directo"
  let resolvedClienteId = clienteId

  if (!resolvedClienteId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: clienteExistente } = await (adminSupabase as any)
      .from('clientes')
      .select('id')
      .eq('user_id', user.id)
      .eq('nombre', 'Cobro directo')
      .single() as { data: { id: string } | null }

    if (clienteExistente) {
      resolvedClienteId = clienteExistente.id
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: nuevoCliente } = await (adminSupabase as any)
        .from('clientes')
        .insert({ user_id: user.id, nombre: 'Cobro directo', pais: 'ES' })
        .select('id')
        .single() as { data: { id: string } | null }

      resolvedClienteId = nuevoCliente?.id
    }
  }

  if (!resolvedClienteId) {
    return NextResponse.json({ error: 'No se pudo resolver el cliente' }, { status: 500 })
  }

  // Generar número de factura via RPC (misma lógica que facturas normales)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: numero } = await (adminSupabase.rpc as any)(
    'fn_generar_numero_factura', { p_user_id: user.id }
  ) as { data: string | null }

  const fechaHoy = new Date().toISOString().split('T')[0]
  const paymentToken = crypto.randomUUID()

  // Calcular importes (sin IVA ni IRPF por defecto en POS — el usuario puede ajustarlo después)
  const total = Number(importe.toFixed(2))

  // Crear la factura
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura, error: facturaError } = await (adminSupabase as any)
    .from('facturas')
    .insert({
      user_id: user.id,
      cliente_id: resolvedClienteId,
      numero: numero ?? `POS-${Date.now().toString(36).toUpperCase()}`,
      fecha_emision: fechaHoy,
      estado: 'emitida',
      base_imponible: total,
      iva_porcentaje: 0,
      iva_importe: 0,
      irpf_porcentaje: 0,
      irpf_importe: 0,
      total,
      notas: `Cobro POS: ${concepto.trim()}`,
      payment_token: paymentToken,
      source: 'pos',
    })
    .select('id, numero')
    .single() as { data: { id: string; numero: string } | null; error: unknown }

  if (facturaError || !factura) {
    console.error('[POS] Error creando factura:', facturaError)
    return NextResponse.json({ error: 'Error creando la factura' }, { status: 500 })
  }

  // Crear línea de factura
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (adminSupabase as any)
    .from('lineas_factura')
    .insert({
      factura_id: factura.id,
      descripcion: concepto.trim(),
      cantidad: 1,
      precio_unitario: total,
      subtotal: total,
      orden: 0,
    })

  // XRPL se registra al pagar, no al crear — el webhook checkout.session.completed lo gestiona
  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const paymentUrl = `${origin}/pay/${paymentToken}`

  return NextResponse.json({
    invoiceId: factura.id,
    numero: factura.numero,
    paymentUrl,
    total,
  })
}
