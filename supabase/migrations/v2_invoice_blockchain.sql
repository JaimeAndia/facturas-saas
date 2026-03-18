-- Columnas de registro blockchain en facturas
-- Distintas del settlement XRPL de pago (en payment_logs.xrpl_settlement_tx)
-- Estas columnas registran la factura en XRPL como prueba de existencia e integridad

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS blockchain_hash TEXT,
  ADD COLUMN IF NOT EXISTS blockchain_tx TEXT,
  ADD COLUMN IF NOT EXISTS blockchain_ledger INTEGER,
  ADD COLUMN IF NOT EXISTS blockchain_registered_at TIMESTAMPTZ;

-- Índice para buscar facturas registradas rápidamente
CREATE INDEX IF NOT EXISTS idx_facturas_blockchain_tx ON facturas(blockchain_tx) WHERE blockchain_tx IS NOT NULL;
