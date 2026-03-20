import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Metadata } from 'next'
import { FacturaEventosCard, type BlockchainEvento } from './FacturaEventosCard'
import { PendingPoller } from './PendingPoller'

export const metadata: Metadata = {
  title: 'Registro blockchain — FacturX',
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default async function BlockchainPage({
  searchParams,
}: {
  searchParams: Promise<{ factura?: string }>
}) {
  const { factura: facturaFiltro } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const adminSupabase = await createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rawEventos } = await (adminSupabase as any)
    .from('blockchain_events')
    .select('id, created_at, event_type, tx_hash, tx_status, ledger, factura_numero, factura_total, cliente_nombre, factura_id, attempts, error_message')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: true }) as { data: BlockchainEvento[] | null }

  const eventos = rawEventos ?? []
  const hayPendientes = eventos.some(e => e.tx_status === 'pending')

  // ── Agrupar eventos por factura ──────────────────────────────────────────────
  // Clave de agrupación: factura_id si existe, si no factura_numero
  const grupos = new Map<string, {
    facturaId:     string | null
    facturaNumero: string | null
    facturaTotal:  number | null
    clienteNombre: string | null
    eventos:       BlockchainEvento[]
  }>()

  for (const evento of eventos) {
    const clave = evento.factura_id ?? evento.factura_numero ?? evento.id
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        facturaId:     evento.factura_id,
        facturaNumero: evento.factura_numero,
        facturaTotal:  evento.factura_total,
        clienteNombre: evento.cliente_nombre,
        eventos:       [],
      })
    }
    grupos.get(clave)!.eventos.push(evento)
  }

  // Ordenar grupos: el más reciente primero (por el último evento de cada grupo)
  const gruposOrdenados = Array.from(grupos.values()).sort((a, b) => {
    const fechaA = a.eventos[a.eventos.length - 1]?.created_at ?? ''
    const fechaB = b.eventos[b.eventos.length - 1]?.created_at ?? ''
    return fechaB.localeCompare(fechaA)
  })

  // ── Stats ────────────────────────────────────────────────────────────────────
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const totalEventos   = eventos.length
  const eventosMes     = eventos.filter(e => new Date(e.created_at) >= inicioMes).length
  const facturasUnicas = gruposOrdenados.length

  return (
    <div className="space-y-6">
      <PendingPoller hayPendientes={hayPendientes} />

      {/* ── Cabecera ── */}
      <div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Registro blockchain</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Eventos de tus facturas registrados en el XRP Ledger como prueba de autenticidad.
        </p>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Total eventos</p>
          <p className="mt-1 text-3xl font-bold text-gray-900 dark:text-gray-100">{totalEventos}</p>
          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">registros en blockchain</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-5 dark:border-blue-800 dark:bg-blue-900/20">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Este mes</p>
          <p className="mt-1 text-3xl font-bold text-blue-700 dark:text-blue-400">{eventosMes}</p>
          <p className="mt-1 text-xs text-blue-500 dark:text-blue-400">
            {ahora.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="rounded-xl border border-violet-100 bg-violet-50 p-5 dark:border-violet-900/50 dark:bg-violet-900/20">
          <p className="text-xs font-medium text-violet-600 dark:text-violet-400">Facturas únicas</p>
          <p className="mt-1 text-3xl font-bold text-violet-700 dark:text-violet-400">{facturasUnicas}</p>
          <p className="mt-1 text-xs text-violet-500 dark:text-violet-400">con al menos un evento</p>
        </div>
      </div>

      {/* ── Listado de facturas desplegables ── */}
      {gruposOrdenados.length === 0 ? (

        <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center dark:border-gray-700 dark:bg-gray-800">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
            <svg className="h-7 w-7 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <p className="mt-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Sin registros blockchain</p>
          <p className="mt-2 mx-auto max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Aún no hay registros. Los eventos se registran automáticamente
            cuando emites, cobras o cancelas una factura.
          </p>
          <Link
            href="/facturas/nueva"
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Crear factura
          </Link>
        </div>

      ) : (

        <div className="space-y-3">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {facturasUnicas} factura{facturasUnicas !== 1 ? 's' : ''} · haz clic en cada tarjeta para ver sus transacciones
          </p>

          {gruposOrdenados.map((grupo, idx) => (
            <FacturaEventosCard
              key={grupo.facturaId ?? grupo.facturaNumero ?? idx}
              facturaId={grupo.facturaId}
              facturaNumero={grupo.facturaNumero}
              facturaTotal={grupo.facturaTotal}
              clienteNombre={grupo.clienteNombre}
              eventos={grupo.eventos}
              defaultOpen={
                facturaFiltro
                  ? grupo.facturaId === facturaFiltro
                  : idx === 0
              }
            />
          ))}
        </div>

      )}
    </div>
  )
}
