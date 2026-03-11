import type { Database } from './database'

// Tipos derivados de las tablas de Supabase
export type Profile = Database['public']['Tables']['profiles']['Row']
export type FacturaRecurrente = Database['public']['Tables']['facturas_recurrentes']['Row']
export type Cliente = Database['public']['Tables']['clientes']['Row']
export type Factura = Database['public']['Tables']['facturas']['Row']
export type LineaFactura = Database['public']['Tables']['lineas_factura']['Row']

// Factura con sus líneas y datos del cliente
export type FacturaCompleta = Factura & {
  lineas: LineaFactura[]
  cliente: Cliente
}

// Planes de suscripción disponibles
export type Plan = 'free' | 'basico' | 'pro'

export interface PlanConfig {
  nombre: string
  precio: number
  precioAnual: number // precio mensual equivalente pagando anual
  facturasMes: number | 'ilimitadas'
  clientes: number | 'ilimitados'
  features: string[]
  priceId: string | null       // mensual
  priceIdAnual: string | null  // anual
}

export const PLANES: Record<Plan, PlanConfig> = {
  free: {
    nombre: 'Gratis',
    precio: 0,
    precioAnual: 0,
    facturasMes: 3,
    clientes: 5,
    features: ['3 facturas al mes', '5 clientes', 'PDF básico'],
    priceId: null,
    priceIdAnual: null,
  },
  basico: {
    nombre: 'Básico',
    precio: 12,
    precioAnual: parseFloat((12 * 0.85).toFixed(2)), // 15% dto = 10.20€/mes
    facturasMes: 20,
    clientes: 50,
    features: [
      '20 facturas al mes',
      '50 clientes',
      'PDF personalizado',
      'Envío por email',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC ?? null,
    priceIdAnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC_ANUAL ?? null,
  },
  pro: {
    nombre: 'Pro',
    precio: 22,
    precioAnual: parseFloat((22 * 0.85).toFixed(2)), // 15% dto = 18.70€/mes
    facturasMes: 'ilimitadas',
    clientes: 'ilimitados',
    features: [
      'Facturas ilimitadas',
      'Clientes ilimitados',
      'PDF con logo',
      'Envío por email',
      'Informes y estadísticas',
      'Soporte prioritario',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? null,
    priceIdAnual: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANUAL ?? null,
  },
}
