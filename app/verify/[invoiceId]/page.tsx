import { createClient } from '@supabase/supabase-js'
import { computeInvoiceHash, type InvoiceProofData } from '@/lib/invoice-proof'
import { InfoColapsable, CanonicalColapsable } from './InfoColapsable'
import type { Metadata } from 'next'
import Link from 'next/link'

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ invoiceId: string }>
}

type XrplEventType =
  | 'invoice_created' | 'invoice_sent'   | 'invoice_seal'
  | 'invoice_paid'    | 'invoice_overdue' | 'invoice_cancelled'
  | 'subscription_created' | 'subscription_payment'
  | 'subscription_failed'  | 'subscription_cancelled'
  | 'dispute_opened'  | 'dispute_resolved'

interface XrplEvento {
  event_type: XrplEventType
  xrpl_tx: string | null
  xrpl_ledger: number | null
  xrpl_status: string
  payload: Record<string, unknown> | null
  created_at: string
  confirmed_at: string | null
}

// ─── Configuración visual por tipo de evento ─────────────────────────────────

const EVENTO_CONFIG: Record<XrplEventType, {
  label: string
  desc: string
  bgIcon: string
  textIcon: string
  dot: string
}> = {
  invoice_created:       { label: 'Factura emitida',                      desc: 'La factura fue creada y registrada.',                              bgIcon: 'bg-blue-500',    textIcon: 'text-white', dot: 'bg-blue-400'    },
  invoice_sent:          { label: 'Factura enviada al cliente',            desc: 'La factura fue enviada al destinatario.',                          bgIcon: 'bg-indigo-500',  textIcon: 'text-white', dot: 'bg-indigo-400'  },
  invoice_seal:          { label: 'Sello de autenticidad registrado',      desc: 'El contenido de la factura quedó sellado de forma irrevocable.',   bgIcon: 'bg-emerald-500', textIcon: 'text-white', dot: 'bg-emerald-400' },
  invoice_paid:          { label: 'Factura cobrada',                       desc: 'Se registró el pago de esta factura.',                             bgIcon: 'bg-green-500',   textIcon: 'text-white', dot: 'bg-green-400'   },
  invoice_overdue:       { label: 'Factura no pagada en su vencimiento',   desc: 'La factura superó la fecha de vencimiento sin ser cobrada.',       bgIcon: 'bg-red-500',     textIcon: 'text-white', dot: 'bg-red-400'     },
  invoice_cancelled:     { label: 'Factura cancelada',                     desc: 'La factura fue anulada.',                                          bgIcon: 'bg-gray-400',    textIcon: 'text-white', dot: 'bg-gray-300'    },
  subscription_created:  { label: 'Suscripción recurrente creada',         desc: 'Se activó el cobro automático recurrente.',                        bgIcon: 'bg-violet-500',  textIcon: 'text-white', dot: 'bg-violet-400'  },
  subscription_payment:  { label: 'Cobro recurrente exitoso',              desc: 'Se procesó correctamente un pago recurrente.',                     bgIcon: 'bg-green-500',   textIcon: 'text-white', dot: 'bg-green-400'   },
  subscription_failed:   { label: 'Cobro recurrente fallido',              desc: 'Un intento de cobro recurrente no pudo procesarse.',               bgIcon: 'bg-red-500',     textIcon: 'text-white', dot: 'bg-red-400'     },
  subscription_cancelled:{ label: 'Suscripción cancelada',                 desc: 'Se canceló la suscripción recurrente.',                            bgIcon: 'bg-gray-400',    textIcon: 'text-white', dot: 'bg-gray-300'    },
  dispute_opened:        { label: 'Disputa abierta',                       desc: 'Se abrió una reclamación o contracargo.',                          bgIcon: 'bg-orange-500',  textIcon: 'text-white', dot: 'bg-orange-400'  },
  dispute_resolved:      { label: 'Disputa resuelta',                      desc: 'La reclamación o contracargo fue resuelta.',                       bgIcon: 'bg-teal-500',    textIcon: 'text-white', dot: 'bg-teal-400'    },
}

const ESTADO_LABEL: Record<string, { label: string; cls: string }> = {
  borrador:  { label: 'Borrador',  cls: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'    },
  emitida:   { label: 'Emitida',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  pagada:    { label: 'Cobrada',   cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  vencida:   { label: 'Vencida',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'     },
  cancelada: { label: 'Cancelada', cls: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'    },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })
}
function fmtHora(iso: string) {
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtEur(n: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n)
}

// ─── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { invoiceId } = await params
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from('facturas')
    .select('numero, user_id')
    .eq('id', invoiceId)
    .single() as { data: { numero: string; user_id: string } | null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = data ? await (supabase as any)
    .from('profiles')
    .select('nombre, apellidos')
    .eq('id', data.user_id)
    .single() as { data: { nombre: string | null; apellidos: string | null } | null } : { data: null }

  const numero  = data?.numero ?? 'desconocida'
  const emisor  = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(' ') || 'FacturX'

  return {
    title:       `Verificación factura ${numero} — FacturX`,
    description: `Verifica la autenticidad de la factura ${numero} emitida por ${emisor}`,
    robots:      { index: false, follow: false },
    openGraph:   { type: 'website' },
  }
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default async function VerificarFacturaPage({ params }: Props) {
  const { invoiceId } = await params

  // Service role — página pública sin sesión de usuario
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  // ── 1. Datos de la factura ─────────────────────────────────────────────────
  // Nunca se expone: email, stripe IDs, seeds, user UUID
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: factura } = await (supabase as any)
    .from('facturas')
    .select(`
      id, numero, fecha_emision, fecha_vencimiento, estado,
      base_imponible, iva_porcentaje, iva_importe,
      irpf_porcentaje, irpf_importe, total, notas,
      blockchain_hash, blockchain_tx, blockchain_ledger, blockchain_registered_at,
      user_id,
      clientes(nif),
      lineas_factura(descripcion, cantidad, precio_unitario, subtotal, orden)
    `)
    .eq('id', invoiceId)
    .single() as {
      data: {
        id: string
        numero: string
        fecha_emision: string
        fecha_vencimiento: string | null
        estado: string
        base_imponible: number
        iva_porcentaje: number
        iva_importe: number
        irpf_porcentaje: number
        irpf_importe: number
        total: number
        notas: string | null
        blockchain_hash: string | null
        blockchain_tx: string | null
        blockchain_ledger: number | null
        blockchain_registered_at: string | null
        user_id: string
        clientes: { nif: string | null } | null
        lineas_factura: {
          descripcion: string
          cantidad: number
          precio_unitario: number
          subtotal: number
          orden: number
        }[]
      } | null
    }

  if (!factura) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 dark:bg-gray-950">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <svg className="h-7 w-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Factura no encontrada</h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            El identificador no corresponde a ninguna factura en el sistema.
          </p>
        </div>
      </div>
    )
  }

  // ── 2. Datos públicos del emisor (nombre, NIF — aparecen en la factura) ────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: perfil } = await (supabase as any)
    .from('profiles')
    .select('nombre, apellidos, nif')
    .eq('id', factura.user_id)
    .single() as { data: { nombre: string | null; apellidos: string | null; nif: string | null } | null }

  // ── 3. Eventos XRPL confirmados de esta factura ────────────────────────────
  // Solo status = 'confirmed'. Nunca pending ni failed.
  // Nunca se expone xrpl_seed_encrypted ni datos del perfil.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawEventos } = await (supabase as any)
    .from('xrpl_events')
    .select('event_type, xrpl_tx, xrpl_ledger, xrpl_status, payload, created_at, confirmed_at')
    .eq('invoice_id', invoiceId)
    .eq('xrpl_status', 'confirmed')
    .order('created_at', { ascending: true }) as { data: XrplEvento[] | null }

  const eventos = rawEventos ?? []

  // ── 4. Verificación de integridad ──────────────────────────────────────────
  const lineasOrdenadas = [...factura.lineas_factura].sort((a, b) => a.orden - b.orden)

  const proofData: InvoiceProofData = {
    invoiceId:      factura.id,
    userId:         factura.user_id,
    numero:         factura.numero,
    fecha_emision:  factura.fecha_emision,
    base_imponible: factura.base_imponible,
    iva_porcentaje: factura.iva_porcentaje,
    iva_importe:    factura.iva_importe,
    irpf_porcentaje: factura.irpf_porcentaje,
    irpf_importe:   factura.irpf_importe,
    total:          factura.total,
    emisorNif:      perfil?.nif     ?? null,
    clienteNif:     factura.clientes?.nif ?? null,
    lineas:         lineasOrdenadas,
  }

  const hashActual   = computeInvoiceHash(proofData)
  const registrada   = !!factura.blockchain_tx
  const integra      = registrada && hashActual === factura.blockchain_hash

  // Objeto canónico legible para verificación independiente
  const canonicalObj = {
    numero:          factura.numero,
    fecha_emision:   factura.fecha_emision,
    emisor_nif:      perfil?.nif ?? '',
    cliente_nif:     factura.clientes?.nif ?? '',
    base_imponible:  Number(factura.base_imponible.toFixed(2)),
    iva_porcentaje:  factura.iva_porcentaje,
    iva_importe:     Number(factura.iva_importe.toFixed(2)),
    irpf_porcentaje: factura.irpf_porcentaje,
    irpf_importe:    Number(factura.irpf_importe.toFixed(2)),
    total:           Number(factura.total.toFixed(2)),
    lineas:          lineasOrdenadas.map(l => ({
      descripcion:     l.descripcion,
      cantidad:        l.cantidad,
      precio_unitario: Number(l.precio_unitario.toFixed(6)),
      subtotal:        Number(l.subtotal.toFixed(2)),
    })),
  }

  const isTestnet = (process.env.XRPL_NETWORK ?? '').includes('altnet') ||
                    (process.env.XRPL_NETWORK ?? '').includes('testnet')
  const explorerBase = `https://${isTestnet ? 'testnet' : 'livenet'}.xrpl.org/transactions`

  const emisorNombre = [perfil?.nombre, perfil?.apellidos].filter(Boolean).join(' ') || '—'
  const estadoInfo   = ESTADO_LABEL[factura.estado] ?? { label: factura.estado, cls: 'bg-gray-100 text-gray-600' }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-950">
      <div className="mx-auto w-full max-w-2xl space-y-6">

        {/* ── Cabecera ── */}
        <div className="text-center">
          <Link href="/" className="inline-block text-xl font-bold tracking-tight text-blue-600">
            FacturX
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">Verificación de factura</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Autenticidad e historia verificable en el XRP Ledger
          </p>
        </div>

        {/* ── Badge de resultado ── */}
        {!registrada ? (
          <div className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
              <svg className="h-6 w-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Sin sello de autenticidad</p>
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                Esta factura no tiene un registro en blockchain. El emisor no ha activado el sello de autenticidad.
              </p>
            </div>
          </div>
        ) : integra ? (
          <div className="flex items-start gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-900/20">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-emerald-800 dark:text-emerald-400">✓ Factura auténtica</p>
              <p className="mt-0.5 text-sm text-emerald-700 dark:text-emerald-400">
                Esta factura fue emitida el {fmt(factura.fecha_emision)} y su contenido no ha sido
                modificado desde entonces. La autenticidad está respaldada por un registro público e inmutable en el XRP Ledger.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm dark:border-red-900/50 dark:bg-red-900/20">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500">
              <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-red-800 dark:text-red-400">⚠ Factura modificada</p>
              <p className="mt-0.5 text-sm text-red-700 dark:text-red-400">
                El contenido actual de esta factura no coincide con el registro original en blockchain.
                Los datos pueden haber sido alterados tras el registro.
              </p>
            </div>
          </div>
        )}

        {/* ── Datos de la factura ── */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Datos de la factura</h2>
          </div>
          <div className="px-6 py-5">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Número de factura</dt>
                <dd className="mt-0.5 font-semibold text-gray-900 dark:text-gray-100">{factura.numero}</dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Estado</dt>
                <dd className="mt-0.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${estadoInfo.cls}`}>
                    {estadoInfo.label}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Emisor</dt>
                <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{emisorNombre}</dd>
              </div>
              {perfil?.nif && (
                <div>
                  <dt className="text-xs text-gray-400 dark:text-gray-500">NIF emisor</dt>
                  <dd className="mt-0.5 font-mono text-sm text-gray-700 dark:text-gray-300">{perfil.nif}</dd>
                </div>
              )}
              {factura.clientes?.nif && (
                <div>
                  <dt className="text-xs text-gray-400 dark:text-gray-500">NIF destinatario</dt>
                  <dd className="mt-0.5 font-mono text-sm text-gray-700 dark:text-gray-300">{factura.clientes.nif}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Fecha de emisión</dt>
                <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{fmt(factura.fecha_emision)}</dd>
              </div>
              {factura.fecha_vencimiento && (
                <div>
                  <dt className="text-xs text-gray-400 dark:text-gray-500">Fecha de vencimiento</dt>
                  <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{fmt(factura.fecha_vencimiento)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs text-gray-400 dark:text-gray-500">Base imponible</dt>
                <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{fmtEur(factura.base_imponible)}</dd>
              </div>
              {factura.iva_porcentaje > 0 && (
                <div>
                  <dt className="text-xs text-gray-400 dark:text-gray-500">IVA ({factura.iva_porcentaje}%)</dt>
                  <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{fmtEur(factura.iva_importe)}</dd>
                </div>
              )}
              {factura.irpf_porcentaje > 0 && (
                <div>
                  <dt className="text-xs text-gray-400 dark:text-gray-500">IRPF ({factura.irpf_porcentaje}%)</dt>
                  <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">−{fmtEur(factura.irpf_importe)}</dd>
                </div>
              )}
              <div className="col-span-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                <dt className="text-xs text-gray-400 dark:text-gray-500">Total</dt>
                <dd className="mt-0.5 text-xl font-bold text-gray-900 dark:text-gray-100">{fmtEur(factura.total)}</dd>
              </div>
            </dl>
          </div>

          {/* Líneas de factura */}
          {lineasOrdenadas.length > 0 && (
            <div className="border-t border-gray-100 px-6 pb-5 dark:border-gray-700">
              <p className="mb-3 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">Conceptos</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-400 dark:border-gray-700 dark:text-gray-500">
                    <th className="pb-2 text-left font-medium">Descripción</th>
                    <th className="pb-2 text-right font-medium">Cant.</th>
                    <th className="pb-2 text-right font-medium">Precio</th>
                    <th className="pb-2 text-right font-medium">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {lineasOrdenadas.map((l, i) => (
                    <tr key={i} className="text-gray-700 dark:text-gray-300">
                      <td className="py-2 pr-4">{l.descripcion}</td>
                      <td className="py-2 text-right tabular-nums">{l.cantidad}</td>
                      <td className="py-2 text-right tabular-nums">{fmtEur(l.precio_unitario)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmtEur(l.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Sello de autenticidad (blockchain_tx) ── */}
        {registrada && (
          <div className="overflow-hidden rounded-2xl border border-gray-700 bg-gray-950 shadow-sm">
            <div className="border-b border-gray-700 px-6 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                Sello de autenticidad — XRP Ledger
              </h2>
            </div>
            <div className="space-y-4 px-6 py-5 text-xs">
              {/* TX hash original */}
              <div>
                <p className="mb-1 text-gray-500">Transaction Hash (blockchain)</p>
                <p className="break-all font-mono text-emerald-400">{factura.blockchain_tx}</p>
              </div>
              {factura.blockchain_ledger && (
                <div>
                  <p className="mb-1 text-gray-500">Número de ledger</p>
                  <p className="font-mono text-gray-300">{factura.blockchain_ledger.toLocaleString('es-ES')}</p>
                </div>
              )}
              {/* Hash almacenado */}
              <div>
                <p className="mb-1 text-gray-500">Hash SHA-256 registrado</p>
                <p className="break-all font-mono text-gray-300">{factura.blockchain_hash}</p>
              </div>
              {/* Hash recalculado ahora */}
              <div>
                <p className="mb-1 text-gray-500">Hash SHA-256 recalculado ahora</p>
                <p className={`break-all font-mono ${integra ? 'text-emerald-400' : 'text-red-400'}`}>
                  {hashActual}
                </p>
                <p className={`mt-1.5 font-medium ${integra ? 'text-emerald-500' : 'text-red-500'}`}>
                  {integra
                    ? '✓ Los hashes coinciden — el contenido no ha sido alterado'
                    : '✗ Los hashes no coinciden — el contenido puede haber sido modificado'}
                </p>
              </div>
              {factura.blockchain_registered_at && (
                <div>
                  <p className="mb-1 text-gray-500">Registrado el</p>
                  <p className="text-gray-300">{fmtHora(factura.blockchain_registered_at)}</p>
                </div>
              )}
              {/* Link al explorador */}
              <div className="pt-1">
                <a
                  href={`${explorerBase}/${factura.blockchain_tx}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-900/50 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-900"
                >
                  Ver registro público en XRPL Explorer
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ── Historia verificable (xrpl_events confirmed) ── */}
        {eventos.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-700">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Historia verificable de esta factura</h2>
              <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">
                Cada evento ha quedado registrado de forma pública e inmutable en el XRP Ledger.
              </p>
            </div>
            <div className="px-6 py-5">
              <ol className="relative">
                {eventos.map((ev, idx) => {
                  const cfg     = EVENTO_CONFIG[ev.event_type] ?? EVENTO_CONFIG.invoice_created
                  const esUlt   = idx === eventos.length - 1
                  const amount  = ev.payload?.amount as number | undefined
                  const currency = ev.payload?.currency as string | undefined
                  return (
                    <li key={idx} className="relative pb-6 pl-10 last:pb-0">
                      {/* Línea vertical */}
                      {!esUlt && (
                        <span className="absolute left-[14px] top-7 h-full w-0.5 bg-gray-200 dark:bg-gray-700" />
                      )}
                      {/* Icono */}
                      <span className={`absolute left-0 flex h-7 w-7 items-center justify-center rounded-full shadow-sm ${cfg.bgIcon}`}>
                        <svg className={`h-3.5 w-3.5 ${cfg.textIcon}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </span>
                      {/* Contenido */}
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{cfg.label}</p>
                          {amount !== undefined && currency && (
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                              · {fmtEur(amount)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{cfg.desc}</p>
                        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                          {fmtHora(ev.confirmed_at ?? ev.created_at)}
                          {ev.xrpl_ledger && (
                            <span className="ml-2 text-gray-300 dark:text-gray-600">· Ledger #{ev.xrpl_ledger.toLocaleString('es-ES')}</span>
                          )}
                        </p>
                        {ev.xrpl_tx && (
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            <span className="rounded bg-gray-50 px-1.5 py-0.5 font-mono text-xs text-gray-500 ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-400 dark:ring-gray-600">
                              {ev.xrpl_tx.slice(0, 8)}…{ev.xrpl_tx.slice(-8)}
                            </span>
                            <a
                              href={`${explorerBase}/${ev.xrpl_tx}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400"
                            >
                              Ver registro público
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        )}
                        <p className="mt-0.5 text-xs text-gray-300 dark:text-gray-600">Verificable por cualquier persona en cualquier momento.</p>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        )}

        {/* ── Datos canónicos para verificación independiente ── */}
        <CanonicalColapsable canonical={JSON.stringify(canonicalObj, null, 2)} />

        {/* ── ¿Qué significa esto? ── */}
        <InfoColapsable />

        {/* ── Pie ── */}
        <div className="text-center text-xs text-gray-400 dark:text-gray-500">
          <p>Verificación criptográfica proporcionada por{' '}
            <Link href="/" className="font-semibold text-blue-600 hover:underline">FacturX</Link>
            {' '}· {isTestnet ? 'Testnet' : 'Mainnet'} · XRP Ledger
          </p>
          <p className="mt-1">
            <Link href="/precios" className="hover:underline">
              ¿Quieres sellos de autenticidad para tus facturas? →
            </Link>
          </p>
        </div>

      </div>
    </div>
  )
}
