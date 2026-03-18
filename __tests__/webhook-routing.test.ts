import { describe, it, expect } from 'vitest'

// Tests de la lógica pura extraída del webhook (sin dependencias externas)

function obtenerPlanDesdePriceId(priceId: string): 'free' | 'basico' | 'pro' {
  const basicoIds = ['price_basic_monthly', 'price_basic_annual']
  const proIds = ['price_pro_monthly', 'price_pro_annual']
  if (basicoIds.includes(priceId)) return 'basico'
  if (proIds.includes(priceId)) return 'pro'
  return 'free'
}

function calcularProximaFechaWebhook(interval: string, desde: Date = new Date()): string {
  const d = new Date(desde)
  if (interval === 'anual') d.setFullYear(d.getFullYear() + 1)
  else if (interval === 'trimestral') d.setMonth(d.getMonth() + 3)
  else d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

function resolverStripeAccountStatus(charges_enabled: boolean, details_submitted: boolean) {
  return charges_enabled ? 'active' : details_submitted ? 'pending' : 'not_connected'
}

describe('obtenerPlanDesdePriceId', () => {
  it('identifica plan básico mensual', () => {
    expect(obtenerPlanDesdePriceId('price_basic_monthly')).toBe('basico')
  })
  it('identifica plan básico anual', () => {
    expect(obtenerPlanDesdePriceId('price_basic_annual')).toBe('basico')
  })
  it('identifica plan pro mensual', () => {
    expect(obtenerPlanDesdePriceId('price_pro_monthly')).toBe('pro')
  })
  it('identifica plan pro anual', () => {
    expect(obtenerPlanDesdePriceId('price_pro_annual')).toBe('pro')
  })
  it('devuelve free para priceId desconocido', () => {
    expect(obtenerPlanDesdePriceId('price_unknown')).toBe('free')
    expect(obtenerPlanDesdePriceId('')).toBe('free')
  })
})

describe('calcularProximaFechaWebhook', () => {
  // Usar mediodía UTC para evitar desfases de zona horaria
  const d = (s: string) => new Date(`${s}T12:00:00Z`)

  it('mensual suma 1 mes', () => {
    expect(calcularProximaFechaWebhook('mensual', d('2026-01-15'))).toBe('2026-02-15')
  })
  it('trimestral suma 3 meses', () => {
    expect(calcularProximaFechaWebhook('trimestral', d('2026-01-15'))).toBe('2026-04-15')
  })
  it('anual suma 1 año', () => {
    expect(calcularProximaFechaWebhook('anual', d('2026-01-15'))).toBe('2027-01-15')
  })
  it('cualquier otro valor suma 1 mes (por defecto)', () => {
    expect(calcularProximaFechaWebhook('desconocido', d('2026-01-15'))).toBe('2026-02-15')
  })
})

describe('resolverStripeAccountStatus', () => {
  it('active cuando charges_enabled es true', () => {
    expect(resolverStripeAccountStatus(true, true)).toBe('active')
    expect(resolverStripeAccountStatus(true, false)).toBe('active')
  })
  it('pending cuando details_submitted pero no charges_enabled', () => {
    expect(resolverStripeAccountStatus(false, true)).toBe('pending')
  })
  it('not_connected cuando nada está habilitado', () => {
    expect(resolverStripeAccountStatus(false, false)).toBe('not_connected')
  })
})
