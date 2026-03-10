import { Resend } from 'resend'

// Cliente de Resend para envío de emails transaccionales
export const resend = new Resend(process.env.RESEND_API_KEY!)
