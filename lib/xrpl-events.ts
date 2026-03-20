import { Wallet, type Payment } from 'xrpl'
import { getXrplClient, getAppWallet } from './xrpl'
import { decryptSeed } from './crypto'
import { createAdminClient } from '@/lib/supabase/server'

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type XrplEventType =
  | 'invoice_created'
  | 'invoice_sent'
  | 'invoice_paid'
  | 'invoice_overdue'
  | 'invoice_cancelled'
  | 'invoice_seal'
  | 'subscription_created'
  | 'subscription_payment'
  | 'subscription_failed'
  | 'subscription_cancelled'
  | 'dispute_opened'
  | 'dispute_resolved'

export interface XrplEventParams {
  userId:         string
  eventType:      XrplEventType
  payload:        object
  invoiceId?:     string
  subscriptionId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase()
}

// Columna de referencia rápida en `facturas` para cada tipo de evento
const FACTURA_TX_COLUMN: Partial<Record<XrplEventType, string>> = {
  invoice_created: 'xrpl_created_tx',
  invoice_paid:    'xrpl_paid_tx',
  invoice_overdue: 'xrpl_overdue_tx',
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Registra un evento de negocio en el XRP Ledger y en la tabla `xrpl_events`.
 *
 * Reglas de seguridad:
 * - xrpl_seed_encrypted NUNCA se loguea, nunca se devuelve, nunca se expone.
 * - Solo registra si el usuario tiene plan='pro' o xrpl_addon=true.
 * - NUNCA lanza al exterior — siempre devuelve txHash o null.
 *
 * Diseñada para uso fire-and-forget:
 *   recordXrplEvent({...}).catch(() => {})
 *
 * Modos de firma:
 * - Usuario con wallet propia (xrpl_seed_encrypted): user wallet → app wallet
 * - Usuario con address pero sin seed:               app wallet → user address
 * - Sin wallet en absoluto:                          solo registro DB con status='failed'
 */
export async function recordXrplEvent(
  params: XrplEventParams
): Promise<string | null> {
  const supabase = await createAdminClient()
  let eventoId: string | undefined = undefined

  try {

    // ── 1. Verificar acceso XRPL y obtener datos de wallet ────────────────────
    const { data: perfil } = await (supabase as any)
      .from('profiles')
      .select('plan, xrpl_addon, xrpl_address, xrpl_seed_encrypted')
      .eq('id', params.userId)
      .single() as {
        data: {
          plan: string | null
          xrpl_addon: boolean | null
          xrpl_address: string | null
          xrpl_seed_encrypted: string | null   // NUNCA loguear
        } | null
      }

    if (!perfil) return null

    const tieneAcceso = perfil.plan === 'pro' || !!perfil.xrpl_addon
    if (!tieneAcceso) return null

    // ── 2. Insertar en xrpl_events con status='pending' ───────────────────────
    const { data: eventoRow, error: insertErr } = await (supabase as any)
      .from('xrpl_events')
      .insert({
        user_id:         params.userId,
        invoice_id:      params.invoiceId      ?? null,
        subscription_id: params.subscriptionId ?? null,
        event_type:      params.eventType,
        xrpl_status:     'pending',
        payload:         params.payload,
      })
      .select('id')
      .single() as { data: { id: string } | null; error: unknown }

    if (insertErr || !eventoRow) {
      console.error('[XrplEvent] Error insertando en BD:', insertErr)
      return null
    }

    eventoId = eventoRow.id

    // ── 3. Determinar wallet firmante y destino ───────────────────────────────
    let signingWallet: Wallet
    let destination: string

    if (perfil.xrpl_address && perfil.xrpl_seed_encrypted) {
      // Modo usuario: el usuario firma — prueba criptográfica de autoría
      const seed = decryptSeed(perfil.xrpl_seed_encrypted)
      signingWallet = Wallet.fromSeed(seed)
      destination   = getAppWallet().address
    } else if (perfil.xrpl_address) {
      // Modo app: FacturX firma en nombre del usuario → su address como destino
      signingWallet = getAppWallet()
      destination   = perfil.xrpl_address
    } else {
      // Sin wallet → solo BD
      await (supabase as any)
        .from('xrpl_events')
        .update({ xrpl_status: 'failed', error_message: 'Sin wallet XRPL configurada' })
        .eq('id', eventoId)
      return null
    }

    // ── 4. Construir memo compacto (IDs truncados por privacidad) ─────────────
    const memoData = JSON.stringify({
      t:   params.eventType,
      uid: params.userId.slice(0, 8),
      ...(params.invoiceId      && { iid: params.invoiceId.slice(0, 8)      }),
      ...(params.subscriptionId && { sid: params.subscriptionId.slice(0, 8) }),
      ts:  Date.now(),
    })

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account:     signingWallet.address,
      Destination: destination,
      Amount:      '1', // 1 drop simbólico
      Memos: [
        {
          Memo: {
            MemoType: toHex('facturx_event'),
            MemoData: toHex(memoData),
          },
        },
      ],
    }

    // ── 5. Enviar transacción XRPL ────────────────────────────────────────────
    const client  = await getXrplClient()
    const prepared = await client.autofill(paymentTx)
    const signed   = signingWallet.sign(prepared)
    const result   = await client.submitAndWait(signed.tx_blob)

    const meta    = result.result.meta
    const success =
      typeof meta === 'object' &&
      meta !== null &&
      'TransactionResult' in meta &&
      meta.TransactionResult === 'tesSUCCESS'

    if (!success) {
      const txResult = (meta as unknown as Record<string, unknown>)?.TransactionResult ?? 'desconocido'
      console.warn(`[XrplEvent] Tx fallida (${params.eventType}): ${String(txResult)}`)
      await (supabase as any)
        .from('xrpl_events')
        .update({ xrpl_status: 'failed', error_message: `XRPL: ${String(txResult)}` })
        .eq('id', eventoId)
      return null
    }

    const txHash = result.result.hash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ledger = (result.result as any).ledger_index ?? 0

    // ── 6. Confirmar registro en BD ───────────────────────────────────────────
    await (supabase as any)
      .from('xrpl_events')
      .update({
        xrpl_tx:      txHash,
        xrpl_ledger:  ledger,
        xrpl_status:  'confirmed',
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', eventoId)

    // ── 7. Actualizar columna de referencia rápida en facturas (si aplica) ────
    const txColumn = params.invoiceId && FACTURA_TX_COLUMN[params.eventType]
    if (txColumn) {
      await (supabase as any)
        .from('facturas')
        .update({ [txColumn]: txHash })
        .eq('id', params.invoiceId)
    }

    console.log(`[XrplEvent] ${params.eventType} (uid:${params.userId.slice(0, 8)}): ${txHash}`)
    return txHash

  } catch (err) {
    // Nunca propagar — el flujo principal no debe bloquearse
    console.error('[XrplEvent] recordXrplEvent falló silenciosamente:', err)
    // Marcar el evento como fallido para que no quede en 'pending' para siempre
    if (eventoId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('xrpl_events')
        .update({ xrpl_status: 'failed', error_message: String(err) })
        .eq('id', eventoId)
    }
    return null
  }
}
