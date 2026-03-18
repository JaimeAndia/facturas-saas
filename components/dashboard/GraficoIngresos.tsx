'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

export interface DatoMesGrafico {
  mes: string
  cobrado: number
  pendiente: number
}

interface Props {
  datos: DatoMesGrafico[]
}

function TooltipPersonalizado({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value: number; name: string; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const fmt = (v: number) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(v)
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-md">
      <p className="mb-1.5 text-xs font-medium text-gray-500">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name === 'cobrado' ? 'Cobrado' : 'Pendiente'}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export function GraficoIngresos({ datos }: Props) {
  const maximo = Math.max(...datos.flatMap((d) => [d.cobrado, d.pendiente]), 1)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={datos} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
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
          tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k€` : `${v}€`}
          width={40}
        />
        <Tooltip content={<TooltipPersonalizado />} cursor={{ fill: '#f9fafb' }} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => (
            <span className="text-xs text-gray-500">
              {value === 'cobrado' ? 'Cobrado' : 'Pendiente / Vencido'}
            </span>
          )}
        />
        <Bar dataKey="cobrado" fill="#16a34a" radius={[3, 3, 0, 0]} maxBarSize={32} />
        <Bar dataKey="pendiente" fill="#f97316" radius={[3, 3, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer>
  )
}
