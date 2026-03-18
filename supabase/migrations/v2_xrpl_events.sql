-- ============================================================
-- MIGRACIÓN v2_xrpl_events: Registro centralizado de todos los
-- eventos de negocio registrados en el XRP Ledger.
--
-- DIFERENCIA con blockchain_events (v2):
--   blockchain_events  → eventos de ciclo de vida de facturas (emision/pago/etc.)
--   xrpl_events        → eventos de negocio amplios (facturas + suscripciones + disputas)
--                        con tipos en inglés y payload JSONB estructurado
-- ============================================================

CREATE TABLE IF NOT EXISTS xrpl_events (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ DEFAULT now() NOT NULL,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invoice_id      UUID        REFERENCES facturas(id) ON DELETE SET NULL,
  subscription_id UUID        REFERENCES subscriptions(id) ON DELETE SET NULL,

  event_type      TEXT        NOT NULL,
  -- Valores permitidos:
  -- 'invoice_created'        → factura creada por el autónomo
  -- 'invoice_sent'           → factura enviada al cliente por email
  -- 'invoice_paid'           → factura cobrada (Stripe o transferencia)
  -- 'invoice_overdue'        → factura marcada como incobrable (>30 días vencida)
  -- 'invoice_cancelled'      → factura cancelada manualmente
  -- 'invoice_seal'           → sello de autenticidad registrado (blockchain/register-invoice)
  -- 'subscription_created'   → suscripción recurrente creada
  -- 'subscription_payment'   → cobro recurrente exitoso
  -- 'subscription_failed'    → cobro recurrente fallido
  -- 'subscription_cancelled' → suscripción cancelada
  -- 'dispute_opened'         → disputa/contracargo abierta
  -- 'dispute_resolved'       → disputa resuelta

  xrpl_tx         TEXT,                           -- hash de la transacción XRPL
  xrpl_ledger     INTEGER,                         -- número de ledger confirmado
  xrpl_status     TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'confirmed' | 'failed'
  payload         JSONB,                           -- datos del evento (amount, clientName, etc.)
  error_message   TEXT,                            -- si xrpl_status = 'failed'
  confirmed_at    TIMESTAMPTZ,

  CONSTRAINT xrpl_events_event_type_check CHECK (event_type IN (
    'invoice_created', 'invoice_sent', 'invoice_paid',
    'invoice_overdue', 'invoice_cancelled', 'invoice_seal',
    'subscription_created', 'subscription_payment',
    'subscription_failed', 'subscription_cancelled',
    'dispute_opened', 'dispute_resolved'
  )),
  CONSTRAINT xrpl_events_status_check CHECK (xrpl_status IN ('pending', 'confirmed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_xrpl_events_user     ON xrpl_events(user_id);
CREATE INDEX IF NOT EXISTS idx_xrpl_events_invoice  ON xrpl_events(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_xrpl_events_type     ON xrpl_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_xrpl_events_status   ON xrpl_events(xrpl_status) WHERE xrpl_status != 'confirmed';

ALTER TABLE xrpl_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own xrpl_events" ON xrpl_events
  FOR ALL USING (auth.uid() = user_id);

-- ─── Columnas de referencia rápida en facturas ────────────────────────────────
-- Guardan el txHash del primer evento de cada tipo para acceso rápido desde la factura.
-- xrpl_events sigue siendo la fuente de verdad completa.

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS xrpl_created_tx TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS xrpl_paid_tx    TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS xrpl_overdue_tx TEXT;
