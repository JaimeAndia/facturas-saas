import { Client, Wallet } from 'xrpl'

// Cliente singleton — se reutiliza entre invocaciones en el mismo proceso
let _client: Client | null = null

/**
 * Devuelve un cliente XRPL conectado.
 * Crea uno nuevo si no existe o si la conexión se ha perdido.
 */
export async function getXrplClient(): Promise<Client> {
  const network = process.env.XRPL_NETWORK
  if (!network) throw new Error('XRPL_NETWORK no está configurado')

  if (_client && _client.isConnected()) return _client

  _client = new Client(network)
  await _client.connect()
  return _client
}

/**
 * Wallet maestra de la app.
 * Se inicializa de forma lazy para no romper el build si el env var no está.
 */
let _appWallet: Wallet | null = null
export function getAppWallet(): Wallet {
  if (_appWallet) return _appWallet
  const seed = process.env.XRPL_WALLET_SEED
  if (!seed) throw new Error('XRPL_WALLET_SEED no está configurado')
  _appWallet = Wallet.fromSeed(seed)
  return _appWallet
}

// Alias exportado para compatibilidad con xrpl-settlement.ts
export const appWallet = { get wallet() { return getAppWallet() } }
