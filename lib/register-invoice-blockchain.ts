// Alias de compatibilidad — delega en registrarEventoBlockchain internamente.
// Todos los consumidores existentes que llaman registerInvoiceBlockchain(id, userId)
// deben actualizar el call site para pasar eventType explícito.
// Este archivo se mantiene solo para no romper imports no migrados aún.
export { registrarEventoBlockchain as registerInvoiceBlockchain } from './blockchain-event'
