import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/data/profile'
import { formatCurrency } from '@/lib/utils'
import { GraficoIngresos, type DatoMesGrafico } from '@/components/dashboard/GraficoIngresos'
import { ProgresoConfiguracion } from '@/components/dashboard/ProgresoConfiguracion'
import { TablaFacturasDashboard, type FacturaTabla } from '@/components/dashboard/TablaFacturasDashboard'
import { SeccionSuscripciones, type SuscripcionActiva } from '@/components/dashboard/SeccionSuscripciones'
import { PanelXrpl } from '@/components/dashboard/PanelXrpl'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Panel de control — FacturX',
}

// Server Action: marca las notificaciones indicadas como leídas
async function marcarNotificacionesLeidas(ids: string[]) {
  'use server'
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('notificaciones') as any)
    .update({ leida: true })
    .in('id', ids)
}

// Últimos N meses como array de { año, mes(0-based), etiqueta }
function ultimosMeses(n: number) {
  const ahora = new Date()
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - (n - 1 - i), 1)
    return { año: d.getFullYear(), mes: d.getMonth(), etiqueta: d.toLocaleString('es-ES', { month: 'short' }) }
  })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
  const hace12Meses = new Date(ahora.getFullYear(), ahora.getMonth() - 11, 1).toISOString().slice(0, 10)

  // Próximo mes natural (para cobros automáticos)
  const inicioPróxMes = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 1)
  const finPróxMes = new Date(ahora.getFullYear(), ahora.getMonth() + 2, 0)
  const inicioPróxMesStr = inicioPróxMes.toISOString().slice(0, 10)
  const finPróxMesStr = finPróxMes.toISOString().slice(0, 10)

  // Notificaciones no leídas del usuario
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: notificaciones } = await (supabase.from('notificaciones') as any)
    .select('id, tipo, mensaje, created_at, metadata')
    .eq('user_id', user!.id)
    .eq('leida', false)
    .order('created_at', { ascending: false })
    .limit(5) as { data: { id: string; tipo: string; mensaje: string; created_at: string; metadata: Record<string, unknown> | null }[] | null }

  const [perfil, { data: rawFacturas }, { data: rawSuscripciones }, { data: rawRecurrentesAuto }] = await Promise.all([
    getPerfil(user!.id),

    // Todas las facturas del usuario — usadas para tabla, stats y gráfico
    // Se excluyen facturas POS no pagadas y plantillas base de recurrentes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('facturas')
      .select(`
        id, numero, fecha_emision, fecha_vencimiento, estado, total,
        paid_at, payment_link_url, payment_token, source,
        reminders_sent, last_reminder_at,
        clientes(nombre, email)
      `)
      .eq('user_id', user!.id)
      .gte('fecha_emision', hace12Meses)
      .or('source.is.null,and(source.neq.pos,source.neq.recurrente_base),and(source.eq.pos,estado.eq.pagada)')
      .order('fecha_emision', { ascending: false }) as Promise<{
        data: Array<{
          id: string
          numero: string
          fecha_emision: string
          fecha_vencimiento: string | null
          estado: 'borrador' | 'emitida' | 'pagada' | 'vencida' | 'cancelada'
          total: number
          paid_at: string | null
          payment_link_url: string | null
          source: string | null
          reminders_sent: number
          last_reminder_at: string | null
          clientes: { nombre: string; email: string | null } | null
        }> | null
      }>,

    // Suscripciones activas con nombre del cliente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('subscriptions')
      .select('id, plan_name, amount, currency, interval, status, next_billing_date, clientes(nombre)')
      .eq('user_id', user!.id)
      .eq('status', 'active') as Promise<{
        data: Array<{
          id: string
          plan_name: string
          amount: number
          currency: string
          interval: string
          status: string
          next_billing_date: string | null
          clientes: { nombre: string } | null
        }> | null
      }>,

    // Recurrentes con cobro automático activo y próxima ejecución en el mes siguiente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('facturas_recurrentes')
      .select('id, proxima_fecha, facturas!factura_base_id(total)')
      .eq('user_id', user!.id)
      .eq('cobro_automatico', true)
      .eq('cobro_status', 'active')
      .eq('activo', true)
      .gte('proxima_fecha', inicioPróxMesStr)
      .lte('proxima_fecha', finPróxMesStr) as Promise<{
        data: Array<{
          id: string
          proxima_fecha: string
          facturas: { total: number } | null
        }> | null
      }>,
  ])

  // ── Datos normalizados ──────────────────────────────────────────────────────
  const facturas = rawFacturas ?? []
  const suscripciones = rawSuscripciones ?? []
  const recurrentesAuto = rawRecurrentesAuto ?? []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const perfilAny = perfil as any
  const hasXrplAccess = perfilAny?.plan === 'pro' || !!perfilAny?.xrpl_addon
  const cobrosActivos = perfilAny?.stripe_account_status === 'active'

  // ── Stats ───────────────────────────────────────────────────────────────────
  const cobradoMes = facturas
    .filter(f => f.estado === 'pagada' && f.paid_at && new Date(f.paid_at) >= inicioMes)
    .reduce((s, f) => s + f.total, 0)

  const pendienteCobro = facturas
    .filter(f => f.estado === 'emitida')
    .reduce((s, f) => s + f.total, 0)
  const numPendientes = facturas.filter(f => f.estado === 'emitida').length

  const totalVencido = facturas
    .filter(f => f.estado === 'vencida')
    .reduce((s, f) => s + f.total, 0)
  const numVencidas = facturas.filter(f => f.estado === 'vencida').length

  // MRR automático: suma de totales con IVA de recurrentes con proxima_fecha en el mes siguiente
  const mrrProximoMes = recurrentesAuto.reduce((s, r) => s + (r.facturas?.total ?? 0), 0)
  const numRecurrentesAuto = recurrentesAuto.length

  // ── Gráfico: últimos 12 meses ───────────────────────────────────────────────
  const meses = ultimosMeses(12)
  const datosGrafico: DatoMesGrafico[] = meses.map(({ año, mes, etiqueta }) => {
    const deMes = facturas.filter(f => {
      const d = new Date(f.fecha_emision)
      return d.getFullYear() === año && d.getMonth() === mes
    })
    const cobrado = deMes.filter(f => f.estado === 'pagada').reduce((s, f) => s + f.total, 0)
    const pendiente = deMes
      .filter(f => f.estado === 'emitida' || f.estado === 'vencida')
      .reduce((s, f) => s + f.total, 0)
    return { mes: etiqueta, cobrado, pendiente }
  })

  // ── Tabla ───────────────────────────────────────────────────────────────────
  const facturasTabla: FacturaTabla[] = facturas.map(f => ({
    id: f.id,
    numero: f.numero,
    cliente_nombre: f.clientes?.nombre ?? '—',
    cliente_email: f.clientes?.email ?? null,
    fecha_emision: f.fecha_emision,
    fecha_vencimiento: f.fecha_vencimiento,
    total: f.total,
    estado: f.estado,
    source: f.source,
    payment_link_url: f.payment_link_url,
    reminders_sent: f.reminders_sent ?? 0,
    last_reminder_at: f.last_reminder_at,
  }))

  // ── Suscripciones ───────────────────────────────────────────────────────────
  const suscripcionesActivas: SuscripcionActiva[] = suscripciones.map(s => ({
    id: s.id,
    cliente_nombre: s.clientes?.nombre ?? '—',
    plan_name: s.plan_name,
    amount: s.amount,
    currency: s.currency,
    interval: s.interval,
    next_billing_date: s.next_billing_date,
  }))

  return (
    <div className="space-y-6">

      {/* ── Cabecera ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Panel de control</h1>
        <Link
          href="/facturas/nueva"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva factura
        </Link>
      </div>

      {/* ── Banner de notificaciones no leídas ── */}
      {notificaciones && notificaciones.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                {notificaciones.length === 1 ? '1 aviso pendiente' : `${notificaciones.length} avisos pendientes`}
              </p>
              <ul className="mt-2 space-y-1">
                {notificaciones.map(n => (
                  <li key={n.id} className="text-sm text-amber-800">
                    • {n.mensaje}
                    {n.metadata?.recurrente_id && (
                      <a
                        href="/facturas/recurrentes"
                        className="ml-1 text-xs font-semibold underline"
                      >
                        Ver recurrentes
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <form action={marcarNotificacionesLeidas.bind(null, notificaciones.map(n => n.id))} className="mt-3">
                <button
                  type="submit"
                  className="text-xs font-semibold text-amber-700 underline hover:text-amber-900"
                >
                  Marcar como leídas
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Progreso perfil ── */}
      {perfil && <ProgresoConfiguracion perfil={perfil} />}

      {/* ── Tarjetas de resumen ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TarjetaStat
          titulo="Cobrado este mes"
          valor={formatCurrency(cobradoMes)}
          descripcion={ahora.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          color="green"
        />
        <TarjetaStat
          titulo="Pendiente de cobro"
          valor={formatCurrency(pendienteCobro)}
          descripcion={`${numPendientes} factura${numPendientes !== 1 ? 's' : ''} emitida${numPendientes !== 1 ? 's' : ''}`}
          color="orange"
        />
        <TarjetaStat
          titulo="Vencido"
          valor={formatCurrency(totalVencido)}
          descripcion={`${numVencidas} sin cobrar`}
          color="red"
        />
        <TarjetaStat
          titulo="Cobros automáticos próximo mes"
          valor={mrrProximoMes > 0 ? formatCurrency(mrrProximoMes) : '—'}
          descripcion={
            mrrProximoMes > 0
              ? `Basado en ${numRecurrentesAuto} recurrente${numRecurrentesAuto !== 1 ? 's' : ''} activa${numRecurrentesAuto !== 1 ? 's' : ''}`
              : 'Sin cobros automáticos programados'
          }
          color="blue"
        />
      </div>

      {/* ── Gráfico 12 meses ── */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800">
        <h2 className="mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">Ingresos — últimos 12 meses</h2>
        <GraficoIngresos datos={datosGrafico} />
      </div>

      {/* ── Tabla de facturas ── */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Facturas</h2>
        <TablaFacturasDashboard
          facturas={facturasTabla}
          cobrosActivos={cobrosActivos}
        />
      </div>

      {/* ── Suscripciones activas ── */}
      <SeccionSuscripciones suscripciones={suscripcionesActivas} />

      {/* ── Panel XRPL (solo si tiene acceso, colapsable) ── */}
      {hasXrplAccess && <PanelXrpl />}

    </div>
  )
}

// ─── Tarjeta estadística ───────────────────────────────────────────────────────

function TarjetaStat({
  titulo, valor, descripcion, color, esContador = false,
}: {
  titulo: string
  valor: string
  descripcion?: string
  color: 'green' | 'orange' | 'red' | 'blue' | 'indigo'
  esContador?: boolean
}) {
  const estilos = {
    green:  { borde: 'border-green-100 dark:border-green-900/30',   texto: 'text-green-700 dark:text-green-400' },
    orange: { borde: 'border-orange-100 dark:border-orange-900/30', texto: 'text-gray-900 dark:text-gray-100' },
    red:    { borde: 'border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-900/10',       texto: 'text-red-700 dark:text-red-400' },
    blue:   { borde: 'border-blue-100 dark:border-blue-900/30',     texto: 'text-gray-900 dark:text-gray-100' },
    indigo: { borde: 'border-indigo-100 bg-indigo-50 dark:border-indigo-900/30 dark:bg-indigo-900/10', texto: 'text-indigo-700 dark:text-indigo-400' },
  }
  const { borde, texto } = estilos[color]

  return (
    <div className={`rounded-xl border bg-white p-5 dark:bg-gray-800 dark:border-gray-700 ${borde}`}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{titulo}</p>
      <p className={`mt-1 font-bold ${esContador ? 'text-3xl' : 'text-2xl'} ${texto}`}>{valor}</p>
      {descripcion && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{descripcion}</p>}
    </div>
  )
}
