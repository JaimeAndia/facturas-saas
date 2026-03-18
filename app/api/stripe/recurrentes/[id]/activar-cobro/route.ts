import { NextResponse } from 'next/server'
import { createElement } from 'react'
import { render } from '@react-email/components'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { getResend } from '@/lib/resend/client'
import { SubscriptionSetupEmail } from '@/emails/subscription-setup'
import { formatCurrency } from '@/lib/utils'
import type Stripe from 'stripe'

// Convierte la frecuencia interna al intervalo de Stripe
function frecuenciaAStripeInterval(
  frecuencia: string
): { interval: Stripe.PriceCreateParams.Recurring.Interval; interval_count: number } {
  if (frecuencia === 'mensual')    return { interval: 'month', interval_count: 1 }
  if (frecuencia === 'trimestral') return { interval: 'month', interval_count: 3 }
  if (frecuencia === 'anual')      return { interval: 'year',  interval_count: 1 }

  const match = frecuencia.match(/^personalizado_(\d+)_(dias|semanas|meses)$/)
  if (match) {
    const count = parseInt(match[1], 10)
    const unidad = match[2]
    if (unidad === 'dias')    return { interval: 'day',   interval_count: count }
    if (unidad === 'semanas') return { interval: 'week',  interval_count: count }
    if (unidad === 'meses')   return { interval: 'month', interval_count: count }
  }

  // Fallback seguro
  return { interval: 'month', interval_count: 1 }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const adminSupabase = await createAdminClient()

  // ── 1. Obtener recurrente con factura base y cliente ─────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recurrente, error: errRec } = await (adminSupabase.from('facturas_recurrentes') as any)
    .select(`
      id, frecuencia, cobro_automatico, stripe_customer_id, stripe_price_id,
      facturas!factura_base_id (
        total, base_imponible, iva_porcentaje, iva_importe,
        irpf_porcentaje, irpf_importe, notas, cliente_id,
        clientes ( nombre, email )
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (errRec || !recurrente) {
    return NextResponse.json({ error: 'Recurrente no encontrada' }, { status: 404 })
  }

  if (recurrente.cobro_automatico) {
    return NextResponse.json({ error: 'Esta recurrente ya tiene cobro automático activo' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const facturaBase = recurrente.facturas as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cliente = facturaBase?.clientes as any

  if (!cliente?.email) {
    return NextResponse.json(
      { error: 'El cliente no tiene email. Añade un email al cliente para activar el cobro automático.' },
      { status: 400 }
    )
  }

  // ── 2. Obtener perfil del autónomo y verificar cuenta Express ────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (adminSupabase.from('profiles') as any)
    .select('stripe_account_id, stripe_account_status, nombre, apellidos')
    .eq('id', user.id)
    .single()

  // REGLA ABSOLUTA: solo si la cuenta Express está activa
  if (perfil?.stripe_account_status !== 'active' || !perfil?.stripe_account_id) {
    return NextResponse.json(
      { error: 'Activa tu cuenta en Configuración → Cobros para poder activar el cobro automático.' },
      { status: 403 }
    )
  }

  const stripeAccountId: string = perfil.stripe_account_id
  const stripe = getStripe()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Importe en céntimos (Stripe requiere entero)
  const importeCentimos = Math.round(Number(facturaBase.total) * 100)
  if (importeCentimos <= 0) {
    return NextResponse.json({ error: 'El importe de la recurrente debe ser mayor que 0' }, { status: 400 })
  }

  try {
    // ── 3. Crear o reutilizar Customer en la cuenta Express ───────────────────
    // CRÍTICO: { stripeAccount } → dinero va al banco del autónomo, NUNCA a FacturX
    let stripeCustomerId: string = recurrente.stripe_customer_id ?? ''

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create(
        {
          email: cliente.email,
          name: cliente.nombre,
          metadata: {
            cliente_id: facturaBase.cliente_id,
            factura_recurrente_id: id,
            facturx_user_id: user.id,
          },
        },
        { stripeAccount: stripeAccountId }  // SIEMPRE en la cuenta Express
      )
      stripeCustomerId = customer.id
    }

    // ── 4. Crear Product en la cuenta Express ─────────────────────────────────
    const nombreEmisor = [perfil.nombre, perfil.apellidos].filter(Boolean).join(' ') || 'Tu proveedor'

    const product = await stripe.products.create(
      {
        name: `Facturación recurrente — ${cliente.nombre}`,
        metadata: {
          factura_recurrente_id: id,
          emisor: nombreEmisor,
        },
      },
      { stripeAccount: stripeAccountId }  // SIEMPRE en la cuenta Express
    )

    // ── 5. Crear Price en la cuenta Express ───────────────────────────────────
    const { interval, interval_count } = frecuenciaAStripeInterval(recurrente.frecuencia)

    const price = await stripe.prices.create(
      {
        product: product.id,
        unit_amount: importeCentimos,
        currency: 'eur',
        recurring: { interval, interval_count },
        metadata: { factura_recurrente_id: id },
      },
      { stripeAccount: stripeAccountId }  // SIEMPRE en la cuenta Express
    )

    // ── 6. Crear Checkout Session (modo suscripción) en la cuenta Express ─────
    // El cliente introduce su tarjeta aquí — el dinero va DIRECTO al banco del autónomo
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        customer: stripeCustomerId,
        line_items: [{ price: price.id, quantity: 1 }],
        subscription_data: {
          metadata: {
            factura_recurrente_id: id,  // para identificar en el webhook
            facturx_user_id: user.id,
          },
        },
        metadata: {
          recurrente_id: id,            // para el webhook checkout.session.completed
          user_id: user.id,
        },
        success_url: `${appUrl}/facturas/recurrentes?cobro_activado=1`,
        cancel_url:  `${appUrl}/facturas/recurrentes`,
        locale: 'es',
        payment_method_types: ['card'],
      },
      { stripeAccount: stripeAccountId }  // SIEMPRE en la cuenta Express
    )

    // ── 7. Guardar en la BD ───────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase.from('facturas_recurrentes') as any)
      .update({
        stripe_customer_id: stripeCustomerId,
        stripe_price_id:    price.id,
        setup_url:          session.url,
        cobro_status:       'pending_setup',
      })
      .eq('id', id)
      .eq('user_id', user.id)

    // ── 8. Enviar email al cliente con el link de configuración ───────────────
    if (session.url && cliente.email) {
      try {
        const intervalLabels: Record<string, string> = {
          mensual: 'mensual', trimestral: 'trimestral', anual: 'anual',
        }
        const intervalLabel = intervalLabels[recurrente.frecuencia] ?? recurrente.frecuencia

        const html = await render(
          createElement(SubscriptionSetupEmail, {
            clientName:  cliente.nombre,
            companyName: nombreEmisor,
            amount:      formatCurrency(Number(facturaBase.total)),
            interval:    intervalLabel,
            setupUrl:    session.url,
          })
        )

        await getResend().emails.send({
          from:    process.env.RESEND_FROM ?? `${nombreEmisor} <onboarding@resend.dev>`,
          to:      cliente.email,
          subject: `${nombreEmisor} ha activado el cobro automático — configura tu pago`,
          html,
        })
      } catch (emailErr) {
        // El email falla silenciosamente — el setup_url sigue disponible en la app
        console.error('[activar-cobro] Error enviando email:', emailErr)
      }
    }

    return NextResponse.json({ setup_url: session.url })

  } catch (err) {
    console.error('[activar-cobro] Error Stripe:', err)
    return NextResponse.json(
      { error: 'Error al crear la suscripción en Stripe. Inténtalo de nuevo.' },
      { status: 500 }
    )
  }
}
