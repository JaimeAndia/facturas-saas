'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

interface DatoMes {
  mes: string
  ingresos: number
}

interface Props {
  datos: DatoMes[]
}

function TooltipPersonalizado({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="text-sm font-bold text-gray-900">
        {new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(payload[0].value)}
      </p>
    </div>
  )
}

export function GraficoIngresos({ datos }: Props) {
  const maximo = Math.max(...datos.map((d) => d.ingresos), 1)

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={datos} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          domain={[0, maximo * 1.2]}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`
          }
          width={40}
        />
        <Tooltip content={<TooltipPersonalizado />} cursor={{ fill: '#f3f4f6' }} />
        <Bar dataKey="ingresos" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
