import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface PaymentLinkBody {
  invoiceId: string
}

// Genera la URL de la página de pago branded (/pay/[token]) y la guarda en la factura
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Verificar que el usuario tiene Stripe Connect activo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase as any)
    .from('profiles')
    .select('stripe_account_status')
    .eq('id', user.id)
    .single() as { data: { stripe_account_status: string | null } | null }

  if (perfil?.stripe_account_status !== 'active') {
    return NextResponse.json(
      { error: 'Activa tu cuenta en Configuración → Cobros para generar links de pago' },
      { status: 403 }
    )
  }

  let body: PaymentLinkBody
  try {
    body = await request.json() as PaymentLinkBody
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { invoiceId } = body
  if (!invoiceId) {
    return NextResponse.json({ error: 'invoiceId requerido' }, { status: 400 })
  }

  interface FacturaRow {
    id: string
    estado: string
    payment_link_url: string | null
    payment_token: string | null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura, error } = await (supabase as any)
    .from('facturas')
    .select('id, estado, payment_link_url, payment_token')
    .eq('id', invoiceId)
    .eq('user_id', user.id)
    .single() as { data: FacturaRow | null; error: unknown }

  if (error || !factura) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 })
  }

  if (factura.estado !== 'emitida') {
    return NextResponse.json(
      { error: 'Solo se pueden generar links para facturas emitidas' },
      { status: 400 }
    )
  }

  if (!factura.payment_token) {
    return NextResponse.json({ error: 'La factura no tiene token de pago' }, { status: 500 })
  }

  // La URL es nuestra página branded, no la de Stripe directamente
  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const url = `${origin}/pay/${factura.payment_token}`

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('facturas')
    .update({ payment_link_url: url })
    .eq('id', invoiceId)

  if (updateError) {
    console.error('Error guardando payment_link_url:', updateError)
    return NextResponse.json({ error: 'Error guardando el link' }, { status: 500 })
  }

  return NextResponse.json({ url })
}
