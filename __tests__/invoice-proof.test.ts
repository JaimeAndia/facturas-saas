import { describe, it, expect } from 'vitest'
import { computeInvoiceHash } from '../lib/invoice-proof'
import type { InvoiceProofData } from '../lib/invoice-proof'

const facturaBase: InvoiceProofData = {
  invoiceId: 'uuid-test-001',
  userId: 'user-001',
  numero: 'FAC-2026-0001',
  fecha_emision: '2026-03-16',
  base_imponible: 1000,
  iva_porcentaje: 21,
  iva_importe: 210,
  irpf_porcentaje: 15,
  irpf_importe: 150,
  total: 1060,
  emisorNif: 'B12345678',
  clienteNif: '12345678A',
  lineas: [
    { descripcion: 'Servicio de consultoría', cantidad: 1, precio_unitario: 1000, subtotal: 1000, orden: 0 },
  ],
}

describe('computeInvoiceHash', () => {
  it('genera un hash SHA-256 de 64 caracteres hex', () => {
    const hash = computeInvoiceHash(facturaBase)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]+$/)
  })

  it('es determinista — mismos datos producen el mismo hash', () => {
    const hash1 = computeInvoiceHash(facturaBase)
    const hash2 = computeInvoiceHash({ ...facturaBase })
    expect(hash1).toBe(hash2)
  })

  it('cambia si se modifica el importe total', () => {
    const hashOriginal = computeInvoiceHash(facturaBase)
    const hashModificado = computeInvoiceHash({ ...facturaBase, total: 999 })
    expect(hashOriginal).not.toBe(hashModificado)
  })

  it('cambia si se modifica el número de factura', () => {
    const hashOriginal = computeInvoiceHash(facturaBase)
    const hashModificado = computeInvoiceHash({ ...facturaBase, numero: 'FAC-2026-0002' })
    expect(hashOriginal).not.toBe(hashModificado)
  })

  it('cambia si se añade una línea', () => {
    const hashOriginal = computeInvoiceHash(facturaBase)
    const hashModificado = computeInvoiceHash({
      ...facturaBase,
      lineas: [
        ...facturaBase.lineas,
        { descripcion: 'Extra', cantidad: 1, precio_unitario: 100, subtotal: 100, orden: 1 },
      ],
    })
    expect(hashOriginal).not.toBe(hashModificado)
  })

  it('es independiente del orden de las líneas (se ordenan por orden)', () => {
    const hash1 = computeInvoiceHash({
      ...facturaBase,
      lineas: [
        { descripcion: 'Línea A', cantidad: 1, precio_unitario: 500, subtotal: 500, orden: 0 },
        { descripcion: 'Línea B', cantidad: 2, precio_unitario: 250, subtotal: 500, orden: 1 },
      ],
    })
    const hash2 = computeInvoiceHash({
      ...facturaBase,
      lineas: [
        { descripcion: 'Línea B', cantidad: 2, precio_unitario: 250, subtotal: 500, orden: 1 },
        { descripcion: 'Línea A', cantidad: 1, precio_unitario: 500, subtotal: 500, orden: 0 },
      ],
    })
    expect(hash1).toBe(hash2)
  })

  it('trata clienteNif null y string vacío de forma canónica', () => {
    const hashNull = computeInvoiceHash({ ...facturaBase, clienteNif: null })
    const hashVacio = computeInvoiceHash({ ...facturaBase, clienteNif: '' })
    // null → '' en el canónico, deben ser iguales
    expect(hashNull).toBe(hashVacio)
  })
})
