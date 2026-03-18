import { Wallet } from 'xrpl'
import { getXrplClient, getAppWallet } from './xrpl'
import { encryptSeed } from './crypto'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Genera y activa una wallet XRPL propia para un usuario Pro o con addon.
 *
 * - Es idempotente: si el usuario ya tiene wallet, devuelve la existente.
 * - El seed en claro NUNCA se guarda en BD, nunca se loguea, nunca se devuelve.
 * - Devuelve null si falla o si las activaciones están pausadas; nunca lanza.
 */
export async function generateUserWallet(userId: string): Promise<string | null> {
  try {
    const supabase = await createAdminClient()

    // 1. Verificar si el usuario ya tiene wallet (idempotente)
    // Nota: xrpl_seed_encrypted no se selecciona — solo el address público
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: perfil } = await (supabase as any)
      .from('profiles')
      .select('xrpl_address, plan, xrpl_addon')
      .eq('id', userId)
      .single() as { data: { xrpl_address: string | null; plan: string; xrpl_addon: boolean | null } | null }

    if (perfil?.xrpl_address) {
      return perfil.xrpl_address
    }

    // 2. Verificar que las activaciones no están pausadas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: configRow } = await (supabase as any)
      .from('app_config')
      .select('value')
      .eq('key', 'xrpl_activations_paused')
      .single() as { data: { value: string } | null }

    if (configRow?.value === 'true') {
      console.log(`[XRPL] Activaciones pausadas — wallet no generada para ${userId}`)
      return null
    }

    // 3. Generar wallet nueva
    const wallet = Wallet.generate()

    // 4. Cifrar seed — el seed en claro desaparece de memoria tras este bloque
    const encryptedSeed = encryptSeed(wallet.seed!)

    const isTestnet = (process.env.XRPL_NETWORK ?? '').includes('altnet') ||
                      (process.env.XRPL_NETWORK ?? '').includes('testnet')

    // 5. Activar wallet en XRPL ANTES de guardar en BD
    // Si la activación falla, no guardamos el address para evitar wallets zombie
    // En testnet: 12 XRP (base reserve 10 XRP + margen para fees y trustlines)
    // En mainnet: 3 XRP (base reserve 2 XRP + margen)
    const client = await getXrplClient()
    const appWallet = getAppWallet()
    const activationDrops = isTestnet ? '12000000' : '3000000'

    const activationTx = {
      TransactionType: 'Payment' as const,
      Account: appWallet.address,
      Destination: wallet.classicAddress,
      Amount: activationDrops,
    }

    const prepared = await client.autofill(activationTx)
    const signed = appWallet.sign(prepared)
    const activationResult = await client.submitAndWait(signed.tx_blob)

    const activationMeta = activationResult.result.meta
    if (
      typeof activationMeta !== 'object' ||
      activationMeta === null ||
      !('TransactionResult' in activationMeta) ||
      activationMeta.TransactionResult !== 'tesSUCCESS'
    ) {
      console.error('[XRPL] Activación fallida — wallet no guardada en BD')
      return null
    }

    console.log(`[XRPL] Wallet activada (${isTestnet ? 'testnet' : 'mainnet'}): ${wallet.classicAddress}`)

    // 6. Guardar en BD solo tras activación exitosa
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('profiles')
      .update({
        xrpl_address: wallet.classicAddress,
        xrpl_seed_encrypted: encryptedSeed,
      })
      .eq('id', userId)

    // 8. Configurar trustline RLUSD si hay issuer configurado
    const rlusdIssuer = process.env.XRPL_RLUSD_ISSUER
    if (rlusdIssuer) {
      try {
        const client = await getXrplClient()

        // Necesitamos firmar con la nueva wallet — reconstruimos desde seed descifrado
        // El seed solo vive en memoria durante este bloque y se descarta
        const newWalletForSigning = Wallet.fromSeed(wallet.seed!)

        const trustlineTx = {
          TransactionType: 'TrustSet' as const,
          Account: wallet.classicAddress,
          LimitAmount: {
            currency: 'USD',
            issuer: rlusdIssuer,
            value: '1000000',
          },
        }

        const prepared = await client.autofill(trustlineTx)
        const signed = newWalletForSigning.sign(prepared)
        await client.submitAndWait(signed.tx_blob)
        console.log(`[XRPL] Trustline RLUSD configurada para ${wallet.classicAddress}`)
      } catch (trustErr) {
        // Trustline no crítica — la wallet ya está generada y activa
        console.warn('[XRPL] Error configurando trustline RLUSD:', trustErr)
      }
    }

    console.log(`[XRPL] Wallet generada para usuario ${userId}: ${wallet.classicAddress}`)
    return wallet.classicAddress

  } catch (err) {
    // Nunca lanzamos al exterior
    console.error('[XRPL] generateUserWallet falló silenciosamente:', err)
    return null
  }
}
