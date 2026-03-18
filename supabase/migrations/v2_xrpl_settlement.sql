-- Migración: capa de liquidación XRPL asíncrona
-- Ejecutar en Supabase SQL Editor

-- Columnas de liquidación en payment_logs
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS xrpl_settlement_tx     TEXT;
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS xrpl_settlement_status TEXT DEFAULT 'not_applicable';
-- xrpl_settlement_status: 'not_applicable' | 'pending' | 'settled' | 'failed'
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS xrpl_settled_at        TIMESTAMPTZ;

-- Campos XRPL en profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xrpl_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xrpl_addon   BOOLEAN DEFAULT FALSE;

-- Tabla de configuración global de la app
CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO app_config (key, value) VALUES ('xrp_price_eur',          '2.00')  ON CONFLICT DO NOTHING;
INSERT INTO app_config (key, value) VALUES ('xrpl_activations_paused','false') ON CONFLICT DO NOTHING;

-- RLS: app_config es solo accesible por service_role (el admin client del servidor)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;
-- Ninguna policy pública → solo service_role puede leer/escribir
