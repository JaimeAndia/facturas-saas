import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Utilidad para combinar clases de Tailwind sin conflictos
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatea un número como moneda EUR
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount)
}

// Formatea una fecha en formato español
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

// Genera el número de factura: FAC-YYYY-NNNN
export function generateInvoiceNumber(year: number, sequence: number): string {
  return `FAC-${year}-${String(sequence).padStart(4, '0')}`
}

// Calcula el IVA (21% por defecto en España)
export function calculateIVA(base: number, rate = 21): number {
  return parseFloat(((base * rate) / 100).toFixed(2))
}

// Calcula la retención de IRPF (15% por defecto para profesionales)
export function calculateIRPF(base: number, rate = 15): number {
  return parseFloat(((base * rate) / 100).toFixed(2))
}

// Calcula la próxima fecha de facturación según la frecuencia.
// Frecuencias estándar: 'mensual' | 'trimestral' | 'anual'
// Frecuencias personalizadas: 'personalizado_N_dias' | 'personalizado_N_semanas' | 'personalizado_N_meses'
export function calcularProximaFecha(desde: Date, frecuencia: string): string {
  const d = new Date(desde)
  if (frecuencia === 'mensual') {
    d.setMonth(d.getMonth() + 1)
  } else if (frecuencia === 'trimestral') {
    d.setMonth(d.getMonth() + 3)
  } else if (frecuencia === 'anual') {
    d.setFullYear(d.getFullYear() + 1)
  } else {
    // personalizado_N_dias / personalizado_N_semanas / personalizado_N_meses
    const match = frecuencia.match(/^personalizado_(\d+)_(dias|semanas|meses)$/)
    if (match) {
      const n = parseInt(match[1], 10)
      if (match[2] === 'dias') d.setDate(d.getDate() + n)
      else if (match[2] === 'semanas') d.setDate(d.getDate() + n * 7)
      else d.setMonth(d.getMonth() + n)
    }
  }
  return d.toISOString().split('T')[0]
}

// Devuelve el MRR (importe mensual equivalente) para una frecuencia dada
export function mrrEquivalente(total: number, frecuencia: string): number {
  if (frecuencia === 'trimestral') return total / 3
  if (frecuencia === 'anual') return total / 12
  if (frecuencia === 'mensual') return total
  const match = frecuencia.match(/^personalizado_(\d+)_(dias|semanas|meses)$/)
  if (match) {
    const n = parseInt(match[1], 10)
    if (match[2] === 'dias') return (total * 30) / n
    if (match[2] === 'semanas') return (total * 4.33) / n
    return total / n
  }
  return total
}

// Etiqueta legible para cualquier frecuencia
export function etiquetaFrecuencia(frecuencia: string): string {
  if (frecuencia === 'mensual') return 'Mensual'
  if (frecuencia === 'trimestral') return 'Trimestral'
  if (frecuencia === 'anual') return 'Anual'
  const match = frecuencia.match(/^personalizado_(\d+)_(dias|semanas|meses)$/)
  if (match) {
    const n = match[1]
    const unidad = match[2] === 'dias' ? (n === '1' ? 'día' : 'días')
      : match[2] === 'semanas' ? (n === '1' ? 'semana' : 'semanas')
      : n === '1' ? 'mes' : 'meses'
    return `Cada ${n} ${unidad}`
  }
  return frecuencia
}
