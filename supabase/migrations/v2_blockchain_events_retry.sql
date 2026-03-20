-- ============================================================
-- MIGRACIÓN: Reintentos y estado en blockchain_events
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- tx_hash puede ser NULL mientras el evento está en pending/failed
ALTER TABLE blockchain_events ALTER COLUMN tx_hash DROP NOT NULL;

-- Columnas de seguimiento de estado (pueden ya existir en BD live)
ALTER TABLE blockchain_events ADD COLUMN IF NOT EXISTS tx_status      TEXT DEFAULT 'pending';
ALTER TABLE blockchain_events ADD COLUMN IF NOT EXISTS invoice_hash   TEXT;
ALTER TABLE blockchain_events ADD COLUMN IF NOT EXISTS attempts       INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE blockchain_events ADD COLUMN IF NOT EXISTS error_message  TEXT;
ALTER TABLE blockchain_events ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ;

-- Índice para buscar eventos fallidos rápidamente
CREATE INDEX IF NOT EXISTS idx_blockchain_events_status
  ON blockchain_events (user_id, tx_status)
  WHERE tx_status IN ('pending', 'failed');
