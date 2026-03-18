-- ============================================================
-- MIGRACIÓN v2_blockchain_events
-- Registro centralizado de eventos blockchain por factura
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS blockchain_events (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  factura_id    UUID        REFERENCES facturas(id) ON DELETE SET NULL,
  event_type    TEXT        NOT NULL
                  CHECK (event_type IN ('emision','pago','cancelacion','vencimiento','generacion_recurrente')),
  tx_hash       TEXT        NOT NULL,
  ledger        INTEGER,
  invoice_hash  TEXT,
  -- Campos denormalizados para mostrar aunque se borre la factura
  factura_numero TEXT,
  factura_total  DECIMAL(10,2),
  cliente_nombre TEXT
);

CREATE INDEX IF NOT EXISTS idx_blockchain_events_user_id     ON blockchain_events(user_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_factura_id  ON blockchain_events(factura_id) WHERE factura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blockchain_events_created_at  ON blockchain_events(created_at DESC);
