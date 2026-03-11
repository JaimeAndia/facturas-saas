import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getPerfil } from '@/lib/data/profile'
import { formatCurrency, formatDate } from '@/lib/utils'
import { GraficoIngresos } from '@/components/dashboard/GraficoIngresos'
import { ProgresoConfiguracion } from '@/components/dashboard/ProgresoConfiguracion'
import type { Database } from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Inicio — FacturApp',
}

type Factura = Database['public']['Tables']['facturas']['Row']

// Inicio y fin del trimestre actual
function rangoTrimestre(): { inicio: string; fin: string } {
  const ahora = new Date()
  const mes = ahora.getMonth() // 0-based
  const q = Math.floor(mes / 3)
  const año = ahora.getFullYear()
  const inicioMes = q * 3
  const inicio = new Date(año, inicioMes, 1).toISOString().slice(0, 10)
  const fin = new Date(año, inicioMes + 3, 0).toISOString().slice(0, 10)
  return { inicio, fin }
}

// Últimos N meses: devuelve array de { año, mes (0-based), etiqueta }
function ultimosMeses(n: number) {
  const meses = []
  const ahora = new Date()
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1)
    meses.push({
      año: d.getFullYear(),
      mes: d.getMonth(),
      etiqueta: d.toLocaleString('es-ES', { month: 'short' }),
    })
  }
  return meses
}

const ETIQUETAS_ESTADO: Record<string, { texto: string; clase: string }> = {
  borrador: { texto: 'Borrador', clase: 'bg-gray-100 text-gray-600' },
  emitida: { texto: 'Emitida', clase: 'bg-blue-100 text-blue-700' },
  pagada: { texto: 'Pagada', clase: 'bg-green-100 text-green-700' },
  vencida: { texto: 'Vencida', clase: 'bg-red-100 text-red-700' },
  cancelada: { texto: 'Cancelada', clase: 'bg-gray-100 text-gray-500' },
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString().slice(0, 10)
  const { inicio: inicioTrim, fin: finTrim } = rangoTrimestre()

  // Perfil via React cache() — reutiliza la query del layout sin hacer otra llamada
  const perfil = await getPerfil(user!.id)

  // Cargar todas las facturas necesarias en paralelo
  const [
    { data: facturasMes },
    { data: facturasTrim },
    { data: facturasPendientes },
    { data: facturasVencidas },
    { data: facturasRecientes },
    { data: facturasGrafico },
  ] = await Promise.all([
    // Ingresos este mes (solo pagadas)
    supabase
      .from('facturas')
      .select('total')
      .eq('user_id', user!.id)
      .eq('estado', 'pagada')
      .gte('fecha_emision', inicioMes),

    // Ingresos este trimestre (solo pagadas)
    supabase
      .from('facturas')
      .select('total')
      .eq('user_id', user!.id)
      .eq('estado', 'pagada')
      .gte('fecha_emision', inicioTrim)
      .lte('fecha_emision', finTrim),

    // Facturas pendientes de cobro (emitidas)
    supabase
      .from('facturas')
      .select('total')
      .eq('user_id', user!.id)
      .eq('estado', 'emitida'),

    // Facturas vencidas
    supabase
      .from('facturas')
      .select('total')
      .eq('user_id', user!.id)
      .eq('estado', 'vencida'),

    // Últimas 5 facturas (cualquier estado)
    supabase
      .from('facturas')
      .select('id, numero, total, estado, fecha_emision, clientes(nombre)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(5),

    // Facturas pagadas de los últimos 6 meses para el gráfico
    supabase
      .from('facturas')
      .select('total, fecha_emision')
      .eq('user_id', user!.id)
      .eq('estado', 'pagada')
      .gte('fecha_emision', new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1).toISOString().slice(0, 10)),
  ])

  // Calcular totales
  const totalMes = (facturasMes ?? []).reduce((s, f) => s + f.total, 0)
  const totalTrim = (facturasTrim ?? []).reduce((s, f) => s + f.total, 0)
  const totalPendiente = (facturasPendientes ?? []).reduce((s, f) => s + f.total, 0)
  const totalVencido = (facturasVencidas ?? []).reduce((s, f) => s + f.total, 0)
  const numPendientes = (facturasPendientes ?? []).length
  const numVencidas = (facturasVencidas ?? []).length

  // Construir datos del gráfico agrupados por mes
  const meses = ultimosMeses(6)
  const datoGrafico = meses.map(({ año, mes, etiqueta }) => {
    const ingresos = (facturasGrafico ?? [])
      .filter((f) => {
        const d = new Date(f.fecha_emision)
        return d.getFullYear() === año && d.getMonth() === mes
      })
      .reduce((s, f) => s + f.total, 0)
    return { mes: etiqueta, ingresos }
  })

  const recientes = (facturasRecientes ?? []) as Array<
    Factura & { clientes: { nombre: string } | null }
  >

  return (
    <div className="space-y-6">
      {/* Cabecera con acción rápida */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Panel de control</h1>
        <Link
          href="/facturas/nueva"
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nueva factura
        </Link>
      </div>

      {/* Barra de progreso del perfil */}
      {perfil && <ProgresoConfiguracion perfil={perfil} />}

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <TarjetaStat
          titulo="Ingresos este mes"
          valor={formatCurrency(totalMes)}
          descripcion={ahora.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          color="blue"
        />
        <TarjetaStat
          titulo="Ingresos este trimestre"
          valor={formatCurrency(totalTrim)}
          descripcion={`T${Math.floor(ahora.getMonth() / 3) + 1} ${ahora.getFullYear()} · facturas cobradas`}
          color="violet"
        />
        <TarjetaStat
          titulo="Pendientes de cobro"
          valor={formatCurrency(totalPendiente)}
          descripcion={`${numPendientes} factura${numPendientes !== 1 ? 's' : ''} emitida${numPendientes !== 1 ? 's' : ''}`}
          color="orange"
        />
        <TarjetaStat
          titulo="Facturas vencidas"
          valor={formatCurrency(totalVencido)}
          descripcion={`${numVencidas} factura${numVencidas !== 1 ? 's' : ''} sin cobrar`}
          color="red"
        />
      </div>

      {/* Gráfico de ingresos */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-sm font-semibold text-gray-900">
          Ingresos cobrados — últimos 6 meses
        </h2>
        <GraficoIngresos datos={datoGrafico} />
      </div>

      {/* Últimas facturas */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Últimas facturas</h2>
          <Link href="/facturas" className="text-xs font-medium text-blue-600 hover:underline">
            Ver todas
          </Link>
        </div>

        {recientes.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm text-gray-400">Aún no tienes facturas.</p>
            <Link
              href="/facturas/nueva"
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              Crea tu primera factura →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {recientes.map((factura) => {
              const estado = ETIQUETAS_ESTADO[factura.estado] ?? ETIQUETAS_ESTADO.borrador
              return (
                <li key={factura.id}>
                  <Link
                    href={`/facturas/${factura.id}`}
                    className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{factura.numero}</p>
                      <p className="text-xs text-gray-400">
                        {factura.clientes?.nombre ?? '—'} · {formatDate(factura.fecha_emision)}
                      </p>
                    </div>
                    <div className="ml-4 flex flex-shrink-0 items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}>
                        {estado.texto}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(factura.total)}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function TarjetaStat({
  titulo,
  valor,
  descripcion,
  color,
}: {
  titulo: string
  valor: string
  descripcion?: string
  color: 'blue' | 'violet' | 'orange' | 'red'
}) {
  const estilos = {
    blue: 'border-blue-100',
    violet: 'border-violet-100',
    orange: 'border-orange-100',
    red: 'border-red-200 bg-red-50',
  }
  const valorEstilo = {
    blue: 'text-gray-900',
    violet: 'text-gray-900',
    orange: 'text-gray-900',
    red: 'text-red-700',
  }

  return (
    <div className={`rounded-xl border bg-white p-5 ${estilos[color]}`}>
      <p className="text-xs font-medium text-gray-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${valorEstilo[color]}`}>{valor}</p>
      {descripcion && <p className="mt-1 text-xs text-gray-400">{descripcion}</p>}
    </div>
  )
}
