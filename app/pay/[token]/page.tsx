import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/server'
import { PayButton } from './PayButton'
import type { Metadata } from 'next'

interface PageProps {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params
  const supabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('facturas')
    .select('numero, profiles(nombre, apellidos)')
    .eq('payment_token', token)
    .single() as { data: { numero: string; profiles: { nombre: string | null; apellidos: string | null } | null } | null }

  if (!data) return { title: 'Pago de factura' }
  const emisor = [data.profiles?.nombre, data.profiles?.apellidos].filter(Boolean).join(' ')
  return { title: `Pagar factura ${data.numero}${emisor ? ` — ${emisor}` : ''}` }
}

export default async function PaginaPago({ params }: PageProps) {
  const { token } = await params
  const supabase = await createAdminClient()

  // Cargar factura con líneas, cliente y perfil del emisor
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: raw } = await (supabase as any)
    .from('facturas')
    .select(`
      id, numero, fecha_emision, fecha_vencimiento,
      base_imponible, iva_porcentaje, iva_importe,
      irpf_porcentaje, irpf_importe, total,
      estado, notas, payment_token,
      blockchain_tx, blockchain_hash,
      clientes(nombre, nif, email, direccion, ciudad),
      profiles!facturas_user_id_fkey(nombre, apellidos, nif, email, telefono, logo_url, ciudad, iban)
    `)
    .eq('payment_token', token)
    .single()

  if (!raw) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const factura = raw as any
  const cliente = factura.clientes
  const emisor = factura.profiles

  // Cargar líneas de la factura
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lineas } = await (supabase as any)
    .from('lineas_factura')
    .select('descripcion, cantidad, precio_unitario, subtotal, orden')
    .eq('factura_id', factura.id)
    .order('orden')

  const nombreEmisor = [emisor?.nombre, emisor?.apellidos].filter(Boolean).join(' ') || 'Empresa'
  const fmt = (n: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
  const fmtFecha = (d: string) => new Intl.DateTimeFormat('es-ES').format(new Date(d))

  // Factura ya pagada
  const yaPagada = factura.estado === 'pagada'

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Cabecera del emisor */}
      <div className="mb-6 flex items-center gap-4">
        {emisor?.logo_url ? (
          <Image
            src={emisor.logo_url}
            alt={`Logo de ${nombreEmisor}`}
            width={56}
            height={56}
            className="h-14 w-14 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-blue-600 text-xl font-bold text-white">
            {nombreEmisor.charAt(0).toUpperCase()}
          </div>
        )}
        <div>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{nombreEmisor}</p>
          {emisor?.nif && <p className="text-sm text-gray-500 dark:text-gray-400">NIF: {emisor.nif}</p>}
          {emisor?.ciudad && <p className="text-sm text-gray-400 dark:text-gray-500">{emisor.ciudad}</p>}
        </div>
      </div>

      {/* Tarjeta principal */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
        {/* Título de la factura */}
        <div className="border-b border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Factura</p>
              <p className="mt-0.5 text-2xl font-bold text-gray-900 dark:text-gray-100">{factura.numero}</p>
            </div>
            <div className="text-right">
              {yaPagada ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Pagada
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-3 py-1 text-sm font-semibold text-orange-700">
                  Pendiente de pago
                </span>
              )}
              <p className="mt-1.5 text-xs text-gray-400 dark:text-gray-500">Emitida el {fmtFecha(factura.fecha_emision)}</p>
              {factura.fecha_vencimiento && (
                <p className="text-xs text-gray-400 dark:text-gray-500">Vence el {fmtFecha(factura.fecha_vencimiento)}</p>
              )}
            </div>
          </div>
        </div>

        {/* Datos del cliente */}
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Facturado a</p>
          <p className="font-semibold text-gray-900 dark:text-gray-100">{cliente?.nombre}</p>
          {cliente?.nif && <p className="text-sm text-gray-500 dark:text-gray-400">NIF: {cliente.nif}</p>}
          {cliente?.email && <p className="text-sm text-gray-500 dark:text-gray-400">{cliente.email}</p>}
        </div>

        {/* Líneas de la factura */}
        <div className="px-6 py-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wide text-gray-400 dark:border-gray-700 dark:text-gray-500">
                <th className="pb-2 pr-4">Concepto</th>
                <th className="pb-2 pr-4 text-right">Cant.</th>
                <th className="pb-2 pr-4 text-right">Precio</th>
                <th className="pb-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {(lineas ?? []).map((linea: { descripcion: string; cantidad: number; precio_unitario: number; subtotal: number }, i: number) => (
                <tr key={i}>
                  <td className="py-2.5 pr-4 text-gray-900 dark:text-gray-100">{linea.descripcion}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-500 dark:text-gray-400">{linea.cantidad}</td>
                  <td className="py-2.5 pr-4 text-right text-gray-500 dark:text-gray-400">{fmt(linea.precio_unitario)}</td>
                  <td className="py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">{fmt(linea.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totales */}
        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
          <div className="ml-auto max-w-xs space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 dark:text-gray-400">Base imponible</span>
              <span className="text-gray-900 dark:text-gray-100">{fmt(factura.base_imponible)}</span>
            </div>
            {factura.iva_porcentaje > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">IVA ({factura.iva_porcentaje}%)</span>
                <span className="text-gray-900 dark:text-gray-100">+ {fmt(factura.iva_importe)}</span>
              </div>
            )}
            {factura.irpf_porcentaje > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">IRPF ({factura.irpf_porcentaje}%)</span>
                <span className="text-red-600 dark:text-red-400">− {fmt(factura.irpf_importe)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-gray-200 pt-2 dark:border-gray-700">
              <span className="text-base font-bold text-gray-900 dark:text-gray-100">Total a pagar</span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{fmt(factura.total)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        {factura.notas && (
          <div className="border-t border-gray-100 px-6 py-4 dark:border-gray-700">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Notas</p>
            <p className="whitespace-pre-line text-sm text-gray-600 dark:text-gray-400">{factura.notas}</p>
          </div>
        )}

        {/* Transferencia bancaria */}
        {!yaPagada && emisor?.iban && (
          <div className="border-t border-gray-100 bg-blue-50 px-6 py-4 dark:border-gray-700 dark:bg-blue-900/20">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-blue-500 dark:text-blue-400">Pago por transferencia bancaria</p>
            <p className="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">{emisor.iban}</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Indique <strong>{factura.numero}</strong> en el concepto de la transferencia.</p>
          </div>
        )}

        {/* Botón de pago */}
        {!yaPagada && (
          <div className="border-t border-gray-100 px-6 py-5 dark:border-gray-700">
            <PayButton token={token} total={factura.total} />
          </div>
        )}

        {/* Mensaje si ya está pagada */}
        {yaPagada && (
          <div className="border-t border-gray-100 px-6 py-5 dark:border-gray-700">
            <div className="flex items-center gap-3 rounded-xl bg-green-50 p-4 text-green-800 dark:bg-green-900/20 dark:text-green-400">
              <svg className="h-6 w-6 shrink-0 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-semibold">Esta factura ya ha sido pagada</p>
                <p className="text-sm text-green-700 dark:text-green-400">No es necesario realizar ningún pago adicional.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sello de autenticidad — solo si está registrada en XRPL */}
      {factura.blockchain_tx && (
        <a
          href={`/verify/${factura.id}`}
          className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-950 to-slate-900 px-5 py-4 transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
            <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Sello de autenticidad</p>
            <p className="mt-0.5 text-sm text-slate-300">Verificar integridad de esta factura →</p>
          </div>
        </a>
      )}

      {/* Footer */}
      <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
        Si tienes alguna duda, contacta con {nombreEmisor}
        {emisor?.email ? ` en ${emisor.email}` : ''}.
      </p>
    </div>
  )
}
