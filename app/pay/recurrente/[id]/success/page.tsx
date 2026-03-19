import { createElement } from 'react'
import { render } from '@react-email/components'
import { createAdminClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/client'
import { getResend } from '@/lib/resend/client'
import { registrarEventoBlockchain } from '@/lib/blockchain-event'
import { SubscriptionConfirmedEmail } from '@/emails/subscription-confirmed'
import { formatCurrency } from '@/lib/utils'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ session_id?: string }>
}

export default async function PaginaExitoRecurrente({ params, searchParams }: PageProps) {
  const { id } = await params
  const { session_id: sessionId } = await searchParams
  const supabase = await createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  let emailEnviado = false

  // Si hay session_id, verificar con Stripe y actualizar BD directamente
  // (no esperar al webhook, que puede llegar tarde o no llegar en dev/staging)
  if (sessionId) {
    try {
      // Obtener el stripe_account_id del autónomo dueño de esta recurrente
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: recData } = await (supabase as any)
        .from('facturas_recurrentes')
        .select('user_id, cobro_status, proxima_fecha, profiles!inner(stripe_account_id)')
        .eq('id', id)
        .single() as {
          data: {
            user_id: string
            cobro_status: string
            proxima_fecha: string | null
            profiles: { stripe_account_id: string | null }
          } | null
        }

      const stripeAccountId = recData?.profiles?.stripe_account_id
      const yaActivo = recData?.cobro_status === 'active'

      if (stripeAccountId) {
        const stripe = getStripe()
        const session = await stripe.checkout.sessions.retrieve(
          sessionId,
          {},
          { stripeAccount: stripeAccountId }
        )

        if (session.status === 'complete' && session.mode === 'subscription') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('facturas_recurrentes')
            .update({
              stripe_subscription_id: session.subscription as string,
              stripe_customer_id:     session.customer as string,
              cobro_automatico:       true,
              cobro_status:           'active',
              setup_url:              null,
            })
            .eq('id', id)

          // Marcar primera factura pendiente como pagada (sin esperar al webhook)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: factPendiente } = await (supabase as any)
            .from('facturas')
            .select('id')
            .eq('factura_recurrente_id', id)
            .not('estado', 'in', '(pagada,cancelada)')
            .order('fecha_emision', { ascending: true })
            .limit(1)
            .maybeSingle() as { data: { id: string } | null }

          if (factPendiente) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from('facturas')
              .update({ estado: 'pagada', paid_at: new Date().toISOString() })
              .eq('id', factPendiente.id)

            // Registrar pago en blockchain (fire-and-forget)
            registrarEventoBlockchain(factPendiente.id, recData.user_id, 'pago').catch((err) =>
              console.error('[recurrente-success] blockchain event error:', err)
            )
          }

          // Enviar email de confirmación solo la primera vez (cobro_status no era active aún)
          if (!yaActivo) {
            emailEnviado = true
            const stripeCustomerId = session.customer as string

            try {
              // Obtener datos completos para el email
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const { data: emailData } = await (supabase as any)
                .from('facturas_recurrentes')
                .select(`
                  frecuencia, proxima_fecha,
                  facturas!factura_base_id (
                    total,
                    clientes ( nombre, email ),
                    profiles!facturas_user_id_fkey ( nombre, apellidos, email )
                  )
                `)
                .eq('id', id)
                .single() as {
                  data: {
                    frecuencia: string
                    proxima_fecha: string | null
                    facturas: {
                      total: number
                      clientes: { nombre: string; email: string | null } | null
                      profiles: { nombre: string | null; apellidos: string | null; email: string | null } | null
                    } | null
                  } | null
                }

              const clienteEmail = emailData?.facturas?.clientes?.email
              const clienteNombre = emailData?.facturas?.clientes?.nombre ?? ''
              const nombreEmisor = emailData?.facturas?.profiles
                ? [emailData.facturas.profiles.nombre, emailData.facturas.profiles.apellidos].filter(Boolean).join(' ') || 'Tu proveedor'
                : 'Tu proveedor'
              const remitenteEmail = emailData?.facturas?.profiles?.email
              const total = emailData?.facturas?.total ?? 0
              const frecuencia = emailData?.frecuencia ?? ''
              const proximaFecha = emailData?.proxima_fecha ?? recData?.proxima_fecha

              if (clienteEmail) {
                const intervalLabels: Record<string, string> = {
                  mensual: 'mensual', trimestral: 'trimestral', anual: 'anual',
                }
                const intervalLabel = intervalLabels[frecuencia] ?? frecuencia
                const portalUrl = `${appUrl}/api/stripe/recurrentes/${id}/portal-publico?cid=${stripeCustomerId}`
                const startDate = proximaFecha
                  ? new Date(proximaFecha).toLocaleDateString('es-ES', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })
                  : 'Próximo ciclo'

                const html = await render(
                  createElement(SubscriptionConfirmedEmail, {
                    clientName:  clienteNombre,
                    companyName: nombreEmisor,
                    amount:      formatCurrency(total),
                    interval:    intervalLabel,
                    startDate,
                    portalUrl,
                  })
                )

                await getResend().emails.send({
                  from:    process.env.RESEND_FROM ?? `${nombreEmisor} <onboarding@resend.dev>`,
                  to:      clienteEmail,
                  ...(remitenteEmail ? { replyTo: remitenteEmail } : {}),
                  subject: `Tu suscripción con ${nombreEmisor} está activa`,
                  html,
                })
              }
            } catch (emailErr) {
              console.error('[recurrente-success] Error enviando email:', emailErr)
            }
          }
        }
      }
    } catch {
      // Fallo silencioso: si algo sale mal, el webhook lo manejará igualmente
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('facturas_recurrentes')
    .select(`
      frecuencia, stripe_customer_id,
      facturas!factura_base_id (
        total,
        clientes ( nombre ),
        profiles!facturas_user_id_fkey ( nombre, apellidos, email )
      )
    `)
    .eq('id', id)
    .single() as {
      data: {
        frecuencia: string
        stripe_customer_id: string | null
        facturas: {
          total: number
          clientes: { nombre: string } | null
          profiles: { nombre: string | null; apellidos: string | null; email: string | null } | null
        } | null
      } | null
    }

  const fmt = (n: number) =>
    new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)

  const frecuenciaLabel: Record<string, string> = {
    mensual: 'mensual',
    trimestral: 'trimestral',
    anual: 'anual',
  }

  const nombreEmisor = data?.facturas?.profiles
    ? [data.facturas.profiles.nombre, data.facturas.profiles.apellidos].filter(Boolean).join(' ') || 'Tu proveedor'
    : 'Tu proveedor'

  const nombreCliente = data?.facturas?.clientes?.nombre ?? ''
  const total = data?.facturas?.total ?? 0
  const frecuencia = data ? (frecuenciaLabel[data.frecuencia] ?? data.frecuencia) : ''
  const emailEmisor = data?.facturas?.profiles?.email ?? null
  const portalUrl = data?.stripe_customer_id
    ? `${appUrl}/api/stripe/recurrentes/${id}/portal-publico?cid=${data.stripe_customer_id}`
    : null

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Icono de éxito */}
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        {/* Mensaje principal */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">¡Suscripción activada!</h1>
          {data ? (
            <p className="mt-2 text-gray-500">
              Tu cobro automático de{' '}
              <span className="font-semibold text-gray-900">{fmt(total)}</span>{' '}
              {frecuencia && <span>({frecuencia}) </span>}
              con <span className="font-semibold text-gray-900">{nombreEmisor}</span> ha sido
              configurado correctamente.
            </p>
          ) : (
            <p className="mt-2 text-gray-500">
              Tu suscripción ha sido configurada correctamente.
            </p>
          )}
          <p className="mt-2 text-sm text-gray-400">
            {emailEnviado
              ? 'Te hemos enviado un email con todos los detalles.'
              : 'Recibirás la factura por email tras cada cobro.'}
          </p>
        </div>

        {/* Tarjeta de acciones */}
        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Portal de gestión */}
          {portalUrl && (
            <a
              href={portalUrl}
              className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 text-sm transition-colors hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Gestionar o cancelar suscripción</p>
                <p className="text-xs text-gray-400">Modifica o cancela cuando quieras</p>
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          )}

          {/* Contacto con el emisor */}
          {emailEmisor && (
            <a
              href={`mailto:${emailEmisor}`}
              className="flex items-center gap-3 px-5 py-4 text-sm transition-colors hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Contactar con {nombreEmisor}</p>
                <p className="text-xs text-gray-400">{emailEmisor}</p>
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          )}
        </div>

        {/* Aviso de gestión si no hay portal */}
        {!portalUrl && nombreCliente && (
          <p className="mt-4 text-center text-sm text-gray-400">
            Para cancelar o modificar tu suscripción, contacta con{' '}
            <span className="font-medium text-gray-600">{nombreEmisor}</span>.
          </p>
        )}
      </div>
    </div>
  )
}
