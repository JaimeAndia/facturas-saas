import { type Payment } from 'xrpl'
import { getXrplClient, getAppWallet } from './xrpl'

interface SettlePaymentParams {
  paymentLogId: string
  invoiceId: string
  amountEur: number
  userId: string
  userXrplAddress?: string
  invoiceHash?: string    // SHA-256 del contenido canónico de la factura
  invoiceProofUrl?: string // URL pública al JSON de prueba en Supabase Storage
}

/** Convierte una cadena UTF-8 a hex en mayúsculas (requerido por XRPL Memos) */
function toHex(str: string): string {
  return Buffer.from(str, 'utf8').toString('hex').toUpperCase()
}

/**
 * Registra un pago como transacción on-chain en XRPL.
 *
 * Usa XRP nativo (1 drop = 0.000001 XRP) como importe de la transacción.
 * El importe real en EUR y el resto de datos van codificados en los Memos.
 * Esto funciona directamente con cualquier wallet fondeada en testnet o mainnet,
 * sin necesidad de trustlines ni saldo RLUSD.
 *
 * Cuando en producción se disponga del issuer RLUSD real, se puede cambiar
 * Amount a RLUSD simplemente actualizando este archivo.
 *
 * - Nunca lanza errores al exterior: cualquier fallo devuelve null.
 * - No usar con await en el flujo principal (fire-and-forget).
 *
 * @returns txHash si la transacción se validó, null si hubo error
 */
export async function settlePayment(params: SettlePaymentParams): Promise<string | null> {
  const { invoiceId, amountEur, userXrplAddress, invoiceHash, invoiceProofUrl } = params

  try {
    const client = await getXrplClient()
    const wallet = getAppWallet()

    // Destino: wallet del usuario si existe, si no el issuer RLUSD como sink.
    // Si no hay issuer configurado, no hay destino válido — abortamos silenciosamente
    // para evitar un self-payment que XRPL rechazaría con temREDUNDANT.
    const sink = process.env.XRPL_RLUSD_ISSUER ?? null
    const destination = userXrplAddress ?? sink
    if (!destination || destination === wallet.address) {
      console.warn('[XRPL] Sin destino válido para el settlement — omitiendo transacción')
      return null
    }

    // 1 drop de XRP como importe simbólico — el valor real va en los Memos
    const ONE_DROP = '1'

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: destination,
      Amount: ONE_DROP,
      Memos: [
        {
          Memo: {
            MemoType: toHex('invoice_id'),
            MemoData: toHex(invoiceId),
          },
        },
        {
          Memo: {
            MemoType: toHex('amount_eur'),
            MemoData: toHex(amountEur.toFixed(2)),
          },
        },
        {
          Memo: {
            MemoType: toHex('timestamp'),
            MemoData: toHex(Date.now().toString()),
          },
        },
        // SHA-256 del contenido canónico — prueba de integridad
        ...(invoiceHash ? [{
          Memo: {
            MemoType: toHex('invoice_hash'),
            MemoData: toHex(invoiceHash),
          },
        }] : []),
        // URL al JSON de prueba en Supabase Storage — permite recuperar el contenido
        ...(invoiceProofUrl ? [{
          Memo: {
            MemoType: toHex('invoice_proof_url'),
            MemoData: toHex(invoiceProofUrl),
          },
        }] : []),
      ],
    }

    const prepared = await client.autofill(paymentTx)
    const signed = wallet.sign(prepared)
    const result = await client.submitAndWait(signed.tx_blob)

    const meta = result.result.meta
    if (typeof meta === 'object' && meta !== null && 'TransactionResult' in meta) {
      if (meta.TransactionResult === 'tesSUCCESS') {
        return result.result.hash
      }
      console.warn('[XRPL] Transacción no exitosa:', meta.TransactionResult)
    }

    return null
  } catch (err) {
    // XRPL nunca debe romper el flujo principal
    console.error('[XRPL] settlePayment falló silenciosamente:', err)
    return null
  }
}
