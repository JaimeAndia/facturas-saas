import { gocardless as GoCardless, Environments } from 'gocardless-nodejs'

// Cliente lazy: se instancia al usarlo, no en build time
let _gocardless: ReturnType<typeof GoCardless> | null = null

export function getGoCardless() {
  if (!_gocardless) {
    const token = process.env.GOCARDLESS_ACCESS_TOKEN
    if (!token) throw new Error('GOCARDLESS_ACCESS_TOKEN no configurado')

    const env = process.env.GOCARDLESS_ENVIRONMENT === 'live'
      ? Environments.Live
      : Environments.Sandbox

    _gocardless = GoCardless(token, env)
  }
  return _gocardless
}
