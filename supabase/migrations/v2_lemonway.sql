-- ============================================================
-- Migración v2: Reemplazar Stripe Connect por Lemonway
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Eliminar columnas de Stripe Connect (si aún existen)
ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_account_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS stripe_account_status;

-- 2. Eliminar columnas de Mangopay (si se ejecutó la migración anterior)
ALTER TABLE profiles DROP COLUMN IF EXISTS mangopay_user_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS mangopay_wallet_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS mangopay_kyc_status;

-- 3. Añadir columnas de Lemonway en profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lemonway_wallet_id TEXT;
-- lemonway_wallet_id: ID único del wallet del usuario en Lemonway
-- Formato: 'facturx_<primeros 20 chars del userId sin guiones>'

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS lemonway_kyc_status TEXT DEFAULT 'not_registered';
-- lemonway_kyc_status: 'not_registered' | 'light' | 'verified'
-- 'light'    = registrado sin documentos (hasta 2.500 € acumulados)
-- 'verified' = KYC completo con DNI

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS iban_last4 TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS iban_bic TEXT;

-- 4. Añadir columnas de Lemonway en payment_logs
ALTER TABLE payment_logs DROP COLUMN IF EXISTS mangopay_payout_id;
ALTER TABLE payment_logs DROP COLUMN IF EXISTS mangopay_payout_status;
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS lemonway_payout_id TEXT;
ALTER TABLE payment_logs ADD COLUMN IF NOT EXISTS lemonway_payout_status TEXT;
-- lemonway_payout_status: 'created' | 'succeeded' | 'failed' | 'mock_pending'
