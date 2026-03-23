-- Migración: añadir 'canceling' al CHECK constraint de cobro_status
-- Contexto: desactivar-cobro/route.ts usa cobro_status='canceling' como estado
-- intermedio mientras Stripe procesa la cancelación (cancel_at_period_end=true).
-- Sin este fix el update falla silenciosamente (Supabase no lanza excepción).
-- Requiere confirmación explícita antes de aplicar.

ALTER TABLE facturas_recurrentes
  DROP CONSTRAINT IF EXISTS facturas_recurrentes_cobro_status_check;

ALTER TABLE facturas_recurrentes
  ADD CONSTRAINT facturas_recurrentes_cobro_status_check
  CHECK (cobro_status IN ('manual', 'pending_setup', 'active', 'past_due', 'canceled', 'canceling'));
