import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const BUCKET = 'invoice-proofs'

export interface InvoiceProofData {
  invoiceId: string
  userId: string
  numero: string
  fecha_emision: string
  base_imponible: number
  iva_porcentaje: number
  iva_importe: number
  irpf_porcentaje: number
  irpf_importe: number
  total: number
  emisorNif: string | null
  clienteNif: string | null
  lineas: {
    descripcion: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    orden: number
  }[]
}

/**
 * Construye el objeto canónico de la factura.
 * IMPORTANTE: este objeto es exactamente lo que se hashea.
 * Cualquier cambio aquí rompe la verificación de facturas antiguas.
 */
function buildCanonical(data: InvoiceProofData) {
  return {
    numero: data.numero,
    fecha_emision: data.fecha_emision,
    emisor_nif: data.emisorNif ?? '',
    cliente_nif: data.clienteNif ?? '',
    base_imponible: Number(data.base_imponible.toFixed(2)),
    iva_porcentaje: data.iva_porcentaje,
    iva_importe: Number(data.iva_importe.toFixed(2)),
    irpf_porcentaje: data.irpf_porcentaje,
    irpf_importe: Number(data.irpf_importe.toFixed(2)),
    total: Number(data.total.toFixed(2)),
    lineas: [...data.lineas]
      .sort((a, b) => a.orden - b.orden)
      .map(l => ({
        descripcion: l.descripcion,
        cantidad: l.cantidad,
        precio_unitario: Number(l.precio_unitario.toFixed(6)),
        subtotal: Number(l.subtotal.toFixed(2)),
      })),
  }
}

/** Computa SHA-256 del contenido canónico de la factura */
export function computeInvoiceHash(data: InvoiceProofData): string {
  const canonical = JSON.stringify(buildCanonical(data))
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')
}

/**
 * Sube la prueba de la factura a Supabase Storage y devuelve la URL pública.
 *
 * El archivo JSON almacenado contiene:
 * - El contenido canónico de la factura (verificable)
 * - El hash SHA-256 (para comparar sin recalcular)
 * - Metadatos de contexto (red XRPL, timestamp de generación)
 *
 * El archivo es inmutable: una vez subido nunca se sobreescribe ni elimina.
 * La URL pública permite a cualquiera verificar la factura sin acceso al sistema.
 *
 * @returns URL pública o null si falla (el settlement XRPL continúa sin ella)
 */
export async function storeInvoiceProof(data: InvoiceProofData): Promise<{ url: string; hash: string } | null> {
  try {
    // Cliente con service role para escribir en Storage sin restricciones de sesión
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const hash = computeInvoiceHash(data)
    const canonical = buildCanonical(data)

    const proofJson = JSON.stringify({
      version: '1',
      hash,
      invoice: canonical,
      meta: {
        invoice_id: data.invoiceId,
        xrpl_network: process.env.XRPL_NETWORK ?? 'unknown',
        generated_at: new Date().toISOString(),
      },
    }, null, 2)

    const filePath = `${data.userId}/${data.invoiceId}.json`

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, proofJson, {
        contentType: 'application/json',
        upsert: false, // nunca sobreescribir — la prueba es inmutable
      })

    if (error) {
      // Si ya existe (upsert: false), considerarlo éxito — la prueba ya está guardada
      if ((error as { statusCode?: string }).statusCode === '409' || error.message?.includes('already exists')) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
        return { url: urlData.publicUrl, hash }
      }
      console.error('[InvoiceProof] Error subiendo a Storage:', error.message)
      return null
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath)
    return { url: urlData.publicUrl, hash }

  } catch (err) {
    console.error('[InvoiceProof] Error inesperado:', err)
    return null
  }
}
