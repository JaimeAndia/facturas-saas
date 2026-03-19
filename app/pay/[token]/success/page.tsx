import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { XrplSettlementBadge } from '../XrplSettlementBadge'

interface PageProps {
  params: Promise<{ token: string }>
}

export default async function PaginaExito({ params }: PageProps) {
  const { token } = await params
  const supabase = await createAdminClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: raw } = await (supabase as any)
    .from('facturas')
    .select('id, numero, total, paid_at, profiles!facturas_user_id_fkey(nombre, apellidos, email)')
    .eq('payment_token', token)
    .single() as { data: {
      id: string
      numero: string
      total: number
      paid_at: string | null
      profiles: { nombre: string | null; apellidos: string | null; email: string | null } | null
    } | null }

  const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
  const nombreEmisor = raw
    ? [raw.profiles?.nombre, raw.profiles?.apellidos].filter(Boolean).join(' ') || 'la empresa'
    : 'la empresa'

  const pagadoConfirmado = !!raw?.paid_at

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Icono de estado */}
        <div className="mb-6 flex justify-center">
          {pagadoConfirmado ? (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
              <svg className="h-10 w-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100">
              <svg className="h-10 w-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          )}
        </div>

        {/* Mensaje principal */}
        <div className="text-center">
          {pagadoConfirmado ? (
            <>
              <h1 className="text-2xl font-bold text-gray-900">¡Pago completado!</h1>
              {raw && (
                <p className="mt-2 text-gray-500">
                  Tu pago de <span className="font-semibold text-gray-900">{fmt(raw.total)}</span> para la
                  factura <span className="font-semibold text-gray-900">{raw.numero}</span> ha sido
                  procesado correctamente.
                </p>
              )}
              <p className="mt-1 text-sm text-gray-400">
                {new Intl.DateTimeFormat('es-ES', {
                  day: '2-digit', month: '2-digit', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                }).format(new Date(raw!.paid_at!))}
              </p>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gray-900">Error al procesar el pago</h1>
              <p className="mt-2 text-gray-500">
                El pago no ha podido ser confirmado en nuestro sistema.
                Si se ha cobrado en tu tarjeta, contacta con el emisor de la factura.
              </p>
            </>
          )}
        </div>

        {/* Tarjeta de acciones — solo si el pago fue confirmado */}
        <div className={`mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${!pagadoConfirmado ? 'hidden' : ''}`}>
          {/* Descargar PDF */}
          {raw && (
            <a
              href={`/api/pay/${token}/pdf`}
              className="flex items-center gap-3 border-b border-gray-100 px-5 py-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">Descargar factura en PDF</p>
                <p className="text-xs text-gray-400">Incluye verificación blockchain</p>
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </a>
          )}

          {/* Contacto */}
          {raw?.profiles?.email && (
            <a
              href={`mailto:${raw.profiles.email}`}
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
                <p className="text-xs text-gray-400">{raw.profiles.email}</p>
              </div>
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          )}
        </div>

        {/* Badge XRPL — se actualiza solo cuando el settlement completa */}
        <XrplSettlementBadge token={token} />

        {/* Ver factura */}
        <div className="mt-6 text-center">
          <Link href={`/pay/${token}`} className="text-sm text-gray-400 hover:text-gray-600">
            Ver factura
          </Link>
        </div>
      </div>
    </div>
  )
}
