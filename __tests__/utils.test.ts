import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatDate,
  generateInvoiceNumber,
  calculateIVA,
  calculateIRPF,
  calcularProximaFecha,
  mrrEquivalente,
  etiquetaFrecuencia,
} from '../lib/utils'

describe('formatCurrency', () => {
  it('formatea euros correctamente', () => {
    // El separador de miles varía según el entorno ICU; verificamos el símbolo y el número
    const result = formatCurrency(1000)
    expect(result).toContain('€')
    expect(result).toMatch(/1[.,\s]?000/)
  })
  it('formatea con decimales', () => {
    const result = formatCurrency(99.5)
    expect(result).toContain('99')
    expect(result).toContain('50')
  })
  it('formatea cero', () => {
    expect(formatCurrency(0)).toContain('0')
    expect(formatCurrency(0)).toContain('€')
  })
})

describe('formatDate', () => {
  it('formatea fecha en formato español dd/mm/yyyy', () => {
    expect(formatDate('2026-03-16')).toBe('16/03/2026')
  })
  it('acepta objetos Date', () => {
    expect(formatDate(new Date('2026-01-01'))).toContain('2026')
  })
})

describe('generateInvoiceNumber', () => {
  it('genera formato FAC-YYYY-NNNN', () => {
    expect(generateInvoiceNumber(2026, 1)).toBe('FAC-2026-0001')
    expect(generateInvoiceNumber(2026, 42)).toBe('FAC-2026-0042')
    expect(generateInvoiceNumber(2026, 9999)).toBe('FAC-2026-9999')
  })
  it('rellena con ceros a la izquierda', () => {
    expect(generateInvoiceNumber(2026, 5)).toBe('FAC-2026-0005')
  })
})

describe('calculateIVA', () => {
  it('calcula IVA al 21% por defecto', () => {
    expect(calculateIVA(1000)).toBe(210)
    expect(calculateIVA(100)).toBe(21)
  })
  it('calcula IVA al 10%', () => {
    expect(calculateIVA(200, 10)).toBe(20)
  })
  it('calcula IVA al 0%', () => {
    expect(calculateIVA(500, 0)).toBe(0)
  })
  it('redondea a 2 decimales', () => {
    // 333.33 * 21 / 100 = 69.9993 → redondea a 70.00
    expect(calculateIVA(333.33, 21)).toBe(70)
  })
})

describe('calculateIRPF', () => {
  it('calcula IRPF al 15% por defecto', () => {
    expect(calculateIRPF(1000)).toBe(150)
  })
  it('calcula IRPF al 7%', () => {
    expect(calculateIRPF(1000, 7)).toBe(70)
  })
  it('redondea a 2 decimales', () => {
    expect(calculateIRPF(333.33, 15)).toBe(50)
  })
})

describe('calcularProximaFecha', () => {
  // Usar mediodía UTC para evitar desfases de zona horaria
  const base = new Date('2026-01-15T12:00:00Z')

  it('mensual suma 1 mes', () => {
    expect(calcularProximaFecha(base, 'mensual')).toBe('2026-02-15')
  })
  it('trimestral suma 3 meses', () => {
    expect(calcularProximaFecha(base, 'trimestral')).toBe('2026-04-15')
  })
  it('anual suma 1 año', () => {
    expect(calcularProximaFecha(base, 'anual')).toBe('2027-01-15')
  })
  it('personalizado dias', () => {
    expect(calcularProximaFecha(base, 'personalizado_10_dias')).toBe('2026-01-25')
  })
  it('personalizado semanas', () => {
    expect(calcularProximaFecha(base, 'personalizado_2_semanas')).toBe('2026-01-29')
  })
  it('personalizado meses', () => {
    expect(calcularProximaFecha(base, 'personalizado_2_meses')).toBe('2026-03-15')
  })
})

describe('mrrEquivalente', () => {
  it('mensual = total', () => {
    expect(mrrEquivalente(100, 'mensual')).toBe(100)
  })
  it('trimestral / 3', () => {
    expect(mrrEquivalente(300, 'trimestral')).toBeCloseTo(100)
  })
  it('anual / 12', () => {
    expect(mrrEquivalente(1200, 'anual')).toBeCloseTo(100)
  })
})

describe('etiquetaFrecuencia', () => {
  it('devuelve etiquetas estándar', () => {
    expect(etiquetaFrecuencia('mensual')).toBe('Mensual')
    expect(etiquetaFrecuencia('trimestral')).toBe('Trimestral')
    expect(etiquetaFrecuencia('anual')).toBe('Anual')
  })
  it('formatea frecuencias personalizadas', () => {
    expect(etiquetaFrecuencia('personalizado_1_dias')).toBe('Cada 1 día')
    expect(etiquetaFrecuencia('personalizado_2_dias')).toBe('Cada 2 días')
    expect(etiquetaFrecuencia('personalizado_1_semanas')).toBe('Cada 1 semana')
    expect(etiquetaFrecuencia('personalizado_3_meses')).toBe('Cada 3 meses')
  })
})
