import { Resend } from 'resend'

// Cliente lazy: se instancia al usarlo, no en build time
let _resend: Resend | null = null

export function getResend(): Resend {
  if (!_resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY no configurado')
    _resend = new Resend(key)
  }
  return _resend
}
