import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'

export interface SuscripcionActiva {
  id: string
  cliente_nombre: string
  plan_name: string
  amount: number
  currency: string
  interval: string
  next_billing_date: string | null
}

interface Props {
  suscripciones: SuscripcionActiva[]
}

const INTERVALO: Record<string, string> = {
  mensual: '/mes',
  trimestral: '/trim.',
  anual: '/año',
}

export function SeccionSuscripciones({ suscripciones }: Props) {
  if (suscripciones.length === 0) return null

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-gray-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Suscripciones activas</h2>
        <Link href="/facturas/recurrentes" className="text-xs font-medium text-blue-600 hover:underline">
          Ver todas →
        </Link>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {suscripciones.map((s) => (
          <li key={s.id} className="flex items-center justify-between px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">{s.cliente_nombre}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">{s.plan_name}</p>
            </div>
            <div className="ml-4 flex shrink-0 flex-col items-end">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(s.amount)}{INTERVALO[s.interval] ?? ''}
              </p>
              {s.next_billing_date && (
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Próximo: {formatDate(s.next_billing_date)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
