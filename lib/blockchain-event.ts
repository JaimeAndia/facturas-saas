import { Wallet, type Payment } from 'xrpl'
import { getXrplClient, getAppWallet } from './xrpl'
import { decryptSeed } from './crypto'
import { computeInvoiceHash, type InvoiceProofData } from './invoice-proof'
import { createAdminClient } from '@/lib/supabase/server'

/** Tipos de eventos blockchain registrables */
export type BlockchainEventType =
  | 'emision'
  | 'pago'
  | 'cancelacion'
  | 'vencimiento'
  | 'generacion_recurrente'

/** Convierte UTF-8 a hex en mayúsculas (requerido por XRPL Memos) */
function toHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase()
}

/**
 * Registra un evento de ciclo de vida de una factura en el XRP Ledger.
 *
 * - Generaliza el patrón de register-invoice-blockchain.ts para cualquier event_type.
 * - Usa la wallet del usuario como firmante (atribuible criptográficamente a él).
 * - Destino: app wallet (evita temREDUNDANT en self-payments).
 * - Memos: invoice_id, event_type, invoice_hash, registered_at.
 * - Para eventType='pago': también actualiza blockchain_tx/ledger/hash en la factura.
 * - Inserta siempre en la tabla blockchain_events.
 * - Nunca lanza al exterior; cualquier fallo devuelve null.
 */
export async function registrarEventoBlockchain(
  invoiceId: string,
  userId: string,
  eventType: BlockchainEventType,
): Promise<{ txHash: string; ledger: number } | null> {
  // Hoisted para poder marcar 'failed' desde el catch externo
  const supabase = await createAdminClient()
  let eventoId: string | undefined = undefined

  try {

    // 1. Verificar acceso XRPL: plan pro o xrpl_addon, y wallet generada
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: perfil } = await (supabase as any)
      .from('profiles')
      .select('plan, xrpl_addon, xrpl_address, xrpl_seed_encrypted, nif')
      .eq('id', userId)
      .single() as {
        data: {
          plan: string | null
          xrpl_addon: boolean | null
          xrpl_address: string | null
          xrpl_seed_encrypted: string | null
          nif: string | null
        } | null
      }

    if (!perfil) {
      console.warn('[BlockchainEvent] Perfil de usuario no encontrado:', userId)
      return null
    }

    const tieneAcceso = perfil.plan === 'pro' || !!perfil.xrpl_addon
    if (!tieneAcceso) {
      console.warn('[BlockchainEvent] Usuario sin acceso XRPL (plan ni addon):', userId)
      return null
    }

    if (!perfil.xrpl_address || !perfil.xrpl_seed_encrypted) {
      console.warn('[BlockchainEvent] Usuario sin wallet XRPL generada:', userId)
      return null
    }

    // 2. Obtener datos completos de la factura con líneas y cliente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: factura } = await (supabase as any)
      .from('facturas')
      .select(`
        numero, fecha_emision, total, user_id,
        base_imponible, iva_porcentaje, iva_importe,
        irpf_porcentaje, irpf_importe,
        clientes(nombre, nif),
        lineas_factura(descripcion, cantidad, precio_unitario, subtotal, orden)
      `)
      .eq('id', invoiceId)
      .single() as {
        data: {
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
        } | null
      }

    if (!factura) {
      console.warn('[BlockchainEvent] Factura no encontrada:', invoiceId)
      return null
    }

    // Verificar que la factura pertenece al usuario
    if (factura.user_id !== userId) {
      console.warn('[BlockchainEvent] Intento de registrar factura ajena — rechazado')
      return null
    }

    // 3. Insertar evento en BD con tx_status='pending' — siempre, antes de intentar la tx
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: eventoRow } = await (supabase as any)
      .from('blockchain_events')
      .insert({
        user_id:        userId,
        factura_id:     invoiceId,
        event_type:     eventType,
        tx_status:      'pending',
        factura_numero: factura.numero,
        factura_total:  factura.total,
        cliente_nombre: factura.clientes?.nombre ?? null,
      })
      .select('id')
      .single() as { data: { id: string } | null }

    // Hoistear el ID para poder marcarlo 'failed' en el catch externo
    eventoId = eventoRow?.id

    // 4. Calcular hash canónico de la factura
    const proofData: InvoiceProofData = {
      invoiceId,
      userId,
      numero: factura.numero,
      fecha_emision: factura.fecha_emision,
      base_imponible: factura.base_imponible,
      iva_porcentaje: factura.iva_porcentaje,
      iva_importe: factura.iva_importe,
      irpf_porcentaje: factura.irpf_porcentaje,
      irpf_importe: factura.irpf_importe,
      total: factura.total,
      emisorNif: perfil.nif ?? null,
      clienteNif: factura.clientes?.nif ?? null,
      lineas: factura.lineas_factura,
    }

    const invoiceHash = computeInvoiceHash(proofData)

    // 4. Reconstruir wallet del usuario desde seed cifrado
    const seed = decryptSeed(perfil.xrpl_seed_encrypted)
    const userWallet = Wallet.fromSeed(seed)

    const appWallet = getAppWallet()
    const client = await getXrplClient()

    // 5. Construir transacción: user wallet → app wallet, 1 drop + memos
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: userWallet.address,
      Destination: appWallet.address,
      Amount: '1', // 1 drop simbólico
      Memos: [
        {
          Memo: {
            MemoType: toHex('invoice_id'),
            MemoData: toHex(invoiceId),
          },
        },
        {
          Memo: {
            MemoType: toHex('event_type'),
            MemoData: toHex(eventType),
          },
        },
        {
          Memo: {
            MemoType: toHex('invoice_hash'),
            MemoData: toHex(invoiceHash),
          },
        },
        {
          Memo: {
            MemoType: toHex('registered_at'),
            MemoData: toHex(new Date().toISOString()),
          },
        },
      ],
    }

    const prepared = await client.autofill(paymentTx)
    const signed = userWallet.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)

    const meta = result.result.meta
    if (
      typeof meta !== 'object' ||
      meta === null ||
      !('TransactionResult' in meta) ||
      meta.TransactionResult !== 'tesSUCCESS'
    ) {
      console.warn(
        '[BlockchainEvent] Transacción no exitosa:',
        (meta as unknown as Record<string, unknown>)?.TransactionResult
      )
      // Marcar el evento como fallido en BD — el registro ya existe
      if (eventoRow?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('blockchain_events')
          .update({ tx_status: 'failed', invoice_hash: invoiceHash })
          .eq('id', eventoRow.id)
      }
      return null
    }

    const txHash = result.result.hash
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ledger = (result.result as any).ledger_index ?? 0

    // 6. Actualizar el evento con el hash y ledger confirmados
    if (eventoRow?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('blockchain_events')
        .update({ tx_hash: txHash, ledger, invoice_hash: invoiceHash, tx_status: 'confirmed' })
        .eq('id', eventoRow.id)
    }

    // 7. Para eventType='pago': también actualizar campos blockchain en la factura
    if (eventType === 'pago') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('facturas')
        .update({
          blockchain_hash: invoiceHash,
          blockchain_tx: txHash,
          blockchain_ledger: ledger,
          blockchain_registered_at: new Date().toISOString(),
        })
        .eq('id', invoiceId)
    }

    console.log(`[BlockchainEvent] Factura ${invoiceId} — evento '${eventType}' registrado: ${txHash}`)
    return { txHash, ledger }

  } catch (err) {
    console.error('[BlockchainEvent] registrarEventoBlockchain falló silenciosamente:', err)
    // Marcar el evento como fallido para que el dashboard no muestre 'Registrando…' para siempre
    if (eventoId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from('blockchain_events')
        .update({ tx_status: 'failed' })
        .eq('id', eventoId)
    }
    return null
  }
}
