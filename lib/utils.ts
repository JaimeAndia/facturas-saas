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
