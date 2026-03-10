import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import type { Database } from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Inicio — FacturApp',
}

type FacturaResumen = Pick<
  Database['public']['Tables']['facturas']['Row'],
  'id' | 'numero' | 'total' | 'estado' | 'fecha_emision'
>

// Tarjeta de estadística reutilizable
function TarjetaStat({
  titulo,
  valor,
  descripcion,
}: {
  titulo: string
  valor: string
  descripcion?: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
      {descripcion && <p className="mt-1 text-xs text-gray-400">{descripcion}</p>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Cargar estadísticas básicas en paralelo
  const [{ count: totalFacturas }, { count: totalClientes }, { data: rawFacturas }] =
    await Promise.all([
      supabase
        .from('facturas')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id),
      supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id),
      supabase
        .from('facturas')
        .select('id, numero, total, estado, fecha_emision')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

  const facturasRecientes = rawFacturas as FacturaResumen[] | null

  // Calcular total facturado este mes
  const ahora = new Date()
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1).toISOString()
  const { data: rawMes } = await supabase
    .from('facturas')
    .select('total')
    .eq('user_id', user!.id)
    .gte('fecha_emision', inicioMes)

  const facturasEsteMes = rawMes as Array<{ total: number }> | null
  const totalMes = facturasEsteMes?.reduce((acc, f) => acc + f.total, 0) ?? 0

  const etiquetasEstado: Record<string, { texto: string; clase: string }> = {
    borrador: { texto: 'Borrador', clase: 'bg-gray-100 text-gray-600' },
    emitida: { texto: 'Emitida', clase: 'bg-blue-100 text-blue-700' },
    pagada: { texto: 'Pagada', clase: 'bg-green-100 text-green-700' },
    vencida: { texto: 'Vencida', clase: 'bg-red-100 text-red-700' },
    cancelada: { texto: 'Cancelada', clase: 'bg-gray-100 text-gray-500' },
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Panel de control</h1>

      {/* Estadísticas */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <TarjetaStat
          titulo="Facturado este mes"
          valor={formatCurrency(totalMes)}
          descripcion={ahora.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
        />
        <TarjetaStat
          titulo="Total facturas"
          valor={String(totalFacturas ?? 0)}
          descripcion="Todas las facturas"
        />
        <TarjetaStat
          titulo="Clientes"
          valor={String(totalClientes ?? 0)}
          descripcion="Clientes activos"
        />
      </div>

      {/* Facturas recientes */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-900">Facturas recientes</h2>
        </div>
        {!facturasRecientes || facturasRecientes.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-gray-400">
            Aún no tienes facturas. ¡Crea tu primera factura!
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {facturasRecientes.map((factura) => {
              const estado = etiquetasEstado[factura.estado] ?? etiquetasEstado.borrador
              return (
                <li key={factura.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{factura.numero}</p>
                    <p className="text-xs text-gray-400">{factura.fecha_emision}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${estado.clase}`}>
                      {estado.texto}
                    </span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatCurrency(factura.total)}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
