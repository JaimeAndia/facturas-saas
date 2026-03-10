import type { Database } from './database'

// Tipos derivados de las tablas de Supabase
export type Profile = Database['public']['Tables']['profiles']['Row']
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
  facturasMes: number | 'ilimitadas'
  clientes: number | 'ilimitados'
  features: string[]
  priceId: string | null
}

export const PLANES: Record<Plan, PlanConfig> = {
  free: {
    nombre: 'Gratis',
    precio: 0,
    facturasMes: 3,
    clientes: 5,
    features: ['3 facturas al mes', '5 clientes', 'PDF básico'],
    priceId: null,
  },
  basico: {
    nombre: 'Básico',
    precio: 9,
    facturasMes: 30,
    clientes: 50,
    features: [
      '30 facturas al mes',
      '50 clientes',
      'PDF personalizado',
      'Envío por email',
    ],
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC ?? null,
  },
  pro: {
    nombre: 'Pro',
    precio: 19,
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
  },
}
