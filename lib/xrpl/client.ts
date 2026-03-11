import { Client, Wallet } from 'xrpl'

// Wallet de la app (usada para firmar transacciones de verificación)
export function getXrplWallet(): Wallet {
  const seed = process.env.XRPL_WALLET_SEED
  if (!seed) throw new Error('XRPL_WALLET_SEED no configurado')
  return Wallet.fromSeed(seed)
}

// Cliente conectado a la red XRPL
export async function getXrplClient(): Promise<Client> {
  const network = process.env.XRPL_NETWORK
  if (!network) throw new Error('XRPL_NETWORK no configurado')

  const client = new Client(network)
  try {
    await client.connect()
  } catch (err) {
    throw new Error(`No se pudo conectar a XRPL (${network}): ${err}`)
  }
  return client
}
