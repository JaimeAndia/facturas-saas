import { Wallet, type Payment } from 'xrpl'
import { getXrplClient, getAppWallet } from './xrpl'
import { decryptSeed } from './crypto'
import { computeInvoiceHash, type InvoiceProofData } from './invoice-proof'
import { createAdminClient } from '@/lib/supabase/server'
import { getResend } from '@/lib/resend/client'

/** Tipos de eventos blockchain registrables */
export type BlockchainEventType =
  | 'emision'
  | 'pago'
  | 'cancelacion'
  | 'vencimiento'
  | 'generacion_recurrente'

const MAX_ATTEMPTS = 3

/** Convierte UTF-8 a hex en mayúsculas (requerido por XRPL Memos) */
function toHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase()
}

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

// ─── Tipos internos ────────────────────────────────────────────────────────────

interface PerfilXrpl {
  plan: string | null
  xrpl_addon: boolean | null
  xrpl_address: string | null
  xrpl_seed_encrypted: string | null
  nif: string | null
  email: string | null
}

interface FacturaXrpl {
  numero: string
  fecha_emision: string
  total: number
  user_id: string
  base_imponible: number
  iva_porcentaje: number
  iva_importe: number
  irpf_porcentaje: number
  irpf_importe: number
  clientes: { nombre: string; nif: string | null } | null
  lineas_factura: {
    descripcion: string
    cantidad: number
    precio_unitario: number
    subtotal: number
    orden: number
  }[]
}

// ─── Carga de datos compartida ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _cargarPerfil(userId: string, supabase: any): Promise<PerfilXrpl | null> {
  const { data } = await supabase
    .from('profiles')
    .select('plan, xrpl_addon, xrpl_address, xrpl_seed_encrypted, nif, email')
    .eq('id', userId)
    .single() as { data: PerfilXrpl | null }
  return data
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _cargarFactura(invoiceId: string, supabase: any): Promise<FacturaXrpl | null> {
  const { data } = await supabase
    .from('facturas')
    .select(`
      numero, fecha_emision, total, user_id,
      base_imponible, iva_porcentaje, iva_importe,
      irpf_porcentaje, irpf_importe,
      clientes(nombre, nif),
      lineas_factura(descripcion, cantidad, precio_unitario, subtotal, orden)
    `)
    .eq('id', invoiceId)
    .single() as { data: FacturaXrpl | null }
  return data
}

// ─── Ejecución de una única transacción XRPL ──────────────────────────────────

async function _enviarTxXrpl(
  invoiceId: string,
  eventType: BlockchainEventType,
  invoiceHash: string,
  seed: string,
): Promise<{ txHash: string; ledger: number }> {
  const userWallet = Wallet.fromSeed(seed)
  const appWallet = getAppWallet()
  const client = await getXrplClient()

  const paymentTx: Payment = {
    TransactionType: 'Payment',
    Account: userWallet.address,
    Destination: appWallet.address,
    Amount: '1',
    Memos: [
      { Memo: { MemoType: toHex('invoice_id'),   MemoData: toHex(invoiceId) } },
      { Memo: { MemoType: toHex('event_type'),   MemoData: toHex(eventType) } },
      { Memo: { MemoType: toHex('invoice_hash'), MemoData: toHex(invoiceHash) } },
      { Memo: { MemoType: toHex('registered_at'), MemoData: toHex(new Date().toISOString()) } },
    ],
  }

  const prepared = await client.autofill(paymentTx)
  const signed   = userWallet.sign(prepared)
  const result   = await client.submitAndWait(signed.tx_blob)

  const meta = result.result.meta
  if (
    typeof meta !== 'object' || meta === null ||
    !('TransactionResult' in meta) ||
    meta.TransactionResult !== 'tesSUCCESS'
  ) {
    throw new Error(
      `XRPL tx no exitosa: ${(meta as Record<string, unknown>)?.TransactionResult ?? 'unknown'}`
    )
  }

  return {
    txHash: result.result.hash,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ledger: (result.result as any).ledger_index ?? 0,
  }
}

// ─── Email de alerta cuando se agotan los reintentos ──────────────────────────

async function _enviarEmailAlertaFallo(
  email: string,
  facturaNumero: string,
  eventType: BlockchainEventType,
  errorMessage: string,
) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://facturx.es'
  getResend().emails.send({
    from:    process.env.RESEND_FROM ?? 'FacturX <noreply@facturx.es>',
    to:      email,
    subject: `⚠️ Error en registro blockchain — Factura ${facturaNumero}`,
    html: `<p>Hola,</p>
<p>El registro blockchain del evento <strong>${eventType}</strong> de la factura <strong>${facturaNumero}</strong> ha fallado tras ${MAX_ATTEMPTS} intentos.</p>
<p><strong>Último error:</strong> ${errorMessage}</p>
<p>Puedes reintentarlo manualmente desde tu <a href="${appUrl}/blockchain">panel de blockchain</a>.</p>
<p>Si el problema persiste, contacta con soporte.</p>`,
  }).catch(err => console.error('[BlockchainEvent] Error enviando email de alerta:', err))
}

// ─── Función principal ─────────────────────────────────────────────────────────

/**
 * Registra un evento de ciclo de vida de una factura en el XRP Ledger.
 *
 * - Reintenta hasta MAX_ATTEMPTS veces con backoff exponencial (1s, 2s).
 * - Guarda `attempts`, `error_message` y `last_attempt_at` en BD.
 * - Envía email de alerta al usuario si se agotan los intentos.
 * - Nunca lanza al exterior; cualquier fallo devuelve null.
 */
export async function registrarEventoBlockchain(
  invoiceId: string,
  userId: string,
  eventType: BlockchainEventType,
): Promise<{ txHash: string; ledger: number } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createAdminClient() as any
  let eventoId: string | undefined

  try {
    // 1. Verificar acceso XRPL
    const perfil = await _cargarPerfil(userId, supabase)
    if (!perfil) {
      console.warn('[BlockchainEvent] Perfil no encontrado:', userId)
      return null
    }

    const tieneAcceso = perfil.plan === 'pro' || !!perfil.xrpl_addon
    if (!tieneAcceso) {
      console.warn('[BlockchainEvent] Sin acceso XRPL:', userId)
      return null
    }

    if (!perfil.xrpl_address || !perfil.xrpl_seed_encrypted) {
      console.warn('[BlockchainEvent] Sin wallet XRPL:', userId)
      return null
    }

    // 2. Cargar factura
    const factura = await _cargarFactura(invoiceId, supabase)
    if (!factura) {
      console.warn('[BlockchainEvent] Factura no encontrada:', invoiceId)
      return null
    }
    if (factura.user_id !== userId) {
      console.warn('[BlockchainEvent] Factura ajena — rechazado')
      return null
    }

    // 3. Insertar evento en BD con estado pending
    const { data: eventoRow } = await supabase
      .from('blockchain_events')
      .insert({
        user_id:        userId,
        factura_id:     invoiceId,
        event_type:     eventType,
        tx_status:      'pending',
        attempts:       0,
        factura_numero: factura.numero,
        factura_total:  factura.total,
        cliente_nombre: factura.clientes?.nombre ?? null,
      })
      .select('id')
      .single() as { data: { id: string } | null }

    eventoId = eventoRow?.id

    // 4. Calcular hash canónico
    const proofData: InvoiceProofData = {
      invoiceId,
      userId,
      numero:          factura.numero,
      fecha_emision:   factura.fecha_emision,
      base_imponible:  factura.base_imponible,
      iva_porcentaje:  factura.iva_porcentaje,
      iva_importe:     factura.iva_importe,
      irpf_porcentaje: factura.irpf_porcentaje,
      irpf_importe:    factura.irpf_importe,
      total:           factura.total,
      emisorNif:       perfil.nif ?? null,
      clienteNif:      factura.clientes?.nif ?? null,
      lineas:          factura.lineas_factura,
    }
    const invoiceHash = computeInvoiceHash(proofData)
    const seed = decryptSeed(perfil.xrpl_seed_encrypted)

    // 5. Intentar XRPL con reintentos y backoff exponencial
    let lastError = 'Error desconocido'

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (attempt > 1) {
        await sleep(1000 * Math.pow(2, attempt - 2)) // 1s, 2s entre intentos 2 y 3
      }

      try {
        const { txHash, ledger } = await _enviarTxXrpl(invoiceId, eventType, invoiceHash, seed)

        // ─ Éxito ─
        if (eventoId) {
          await supabase
            .from('blockchain_events')
            .update({
              tx_hash:         txHash,
              ledger,
              invoice_hash:    invoiceHash,
              tx_status:       'confirmed',
              attempts:        attempt,
              error_message:   null,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', eventoId)
        }

        // Para 'pago': actualizar campos blockchain en la factura
        if (eventType === 'pago') {
          await supabase
            .from('facturas')
            .update({
              blockchain_hash:            invoiceHash,
              blockchain_tx:              txHash,
              blockchain_ledger:          ledger,
              blockchain_registered_at:   new Date().toISOString(),
            })
            .eq('id', invoiceId)
        }

        console.log(`[BlockchainEvent] ${invoiceId} — '${eventType}' confirmado en intento ${attempt}: ${txHash}`)
        return { txHash, ledger }

      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
        console.warn(`[BlockchainEvent] Intento ${attempt}/${MAX_ATTEMPTS} fallido para ${invoiceId}:`, lastError)

        if (eventoId) {
          await supabase
            .from('blockchain_events')
            .update({
              attempts:        attempt,
              error_message:   lastError,
              last_attempt_at: new Date().toISOString(),
            })
            .eq('id', eventoId)
        }
      }
    }

    // 6. Todos los intentos agotados → marcar failed + email de alerta
    if (eventoId) {
      await supabase
        .from('blockchain_events')
        .update({ tx_status: 'failed' })
        .eq('id', eventoId)
    }

    console.error(`[BlockchainEvent] ${invoiceId} — '${eventType}' fallido tras ${MAX_ATTEMPTS} intentos. Último error: ${lastError}`)

    if (perfil.email) {
      await _enviarEmailAlertaFallo(perfil.email, factura.numero, eventType, lastError)
    }

    return null

  } catch (err) {
    console.error('[BlockchainEvent] Error inesperado en registrarEventoBlockchain:', err)
    if (eventoId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (await createAdminClient() as any)
        .from('blockchain_events')
        .update({ tx_status: 'failed', error_message: String(err) })
        .eq('id', eventoId)
    }
    return null
  }
}

// ─── Reintento manual de un evento fallido ────────────────────────────────────

/**
 * Reintenta registrar un evento `failed` existente en el XRP Ledger.
 * Actualiza la fila existente en lugar de crear una nueva.
 * No reintenta automáticamente — es un único intento manual.
 */
export async function retryEventoBlockchain(
  eventoId: string,
  userId: string,
): Promise<{ txHash: string; ledger: number } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createAdminClient() as any

  // Cargar el evento original
  const { data: evento } = await supabase
    .from('blockchain_events')
    .select('id, factura_id, event_type, tx_status, attempts')
    .eq('id', eventoId)
    .eq('user_id', userId)
    .single() as {
      data: {
        id: string
        factura_id: string | null
        event_type: BlockchainEventType
        tx_status: string | null
        attempts: number
      } | null
    }

  if (!evento) return null
  if (evento.tx_status === 'confirmed') return null // ya confirmado
  if (!evento.factura_id) return null

  const perfil = await _cargarPerfil(userId, supabase)
  if (!perfil?.xrpl_seed_encrypted) return null

  const factura = await _cargarFactura(evento.factura_id, supabase)
  if (!factura || factura.user_id !== userId) return null

  const proofData: InvoiceProofData = {
    invoiceId:       evento.factura_id,
    userId,
    numero:          factura.numero,
    fecha_emision:   factura.fecha_emision,
    base_imponible:  factura.base_imponible,
    iva_porcentaje:  factura.iva_porcentaje,
    iva_importe:     factura.iva_importe,
    irpf_porcentaje: factura.irpf_porcentaje,
    irpf_importe:    factura.irpf_importe,
    total:           factura.total,
    emisorNif:       perfil.nif ?? null,
    clienteNif:      factura.clientes?.nif ?? null,
    lineas:          factura.lineas_factura,
  }
  const invoiceHash = computeInvoiceHash(proofData)
  const seed = decryptSeed(perfil.xrpl_seed_encrypted)
  const newAttempts = (evento.attempts ?? 0) + 1

  try {
    const { txHash, ledger } = await _enviarTxXrpl(
      evento.factura_id,
      evento.event_type,
      invoiceHash,
      seed,
    )

    await supabase
      .from('blockchain_events')
      .update({
        tx_hash:         txHash,
        ledger,
        invoice_hash:    invoiceHash,
        tx_status:       'confirmed',
        attempts:        newAttempts,
        error_message:   null,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', eventoId)

    if (evento.event_type === 'pago') {
      await supabase
        .from('facturas')
        .update({
          blockchain_hash:          invoiceHash,
          blockchain_tx:            txHash,
          blockchain_ledger:        ledger,
          blockchain_registered_at: new Date().toISOString(),
        })
        .eq('id', evento.factura_id)
    }

    console.log(`[BlockchainEvent] Reintento exitoso para evento ${eventoId}: ${txHash}`)
    return { txHash, ledger }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error(`[BlockchainEvent] Reintento fallido para evento ${eventoId}:`, errorMessage)

    await supabase
      .from('blockchain_events')
      .update({
        attempts:        newAttempts,
        error_message:   errorMessage,
        last_attempt_at: new Date().toISOString(),
      })
      .eq('id', eventoId)

    return null
  }
}
