-- ============================================================
-- Migración: Eliminar Lemonway y restaurar Stripe Connect
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Eliminar columnas de Lemonway de la tabla profiles
ALTER TABLE profiles DROP COLUMN IF EXISTS lemonway_wallet_id;
ALTER TABLE profiles DROP COLUMN IF EXISTS lemonway_kyc_status;
ALTER TABLE profiles DROP COLUMN IF EXISTS iban_last4;
ALTER TABLE profiles DROP COLUMN IF EXISTS iban_bic;

-- 2. Restaurar columnas de Stripe Connect en profiles
--    (la migración v2_lemonway.sql las eliminó — las devolvemos)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_account_status TEXT DEFAULT 'not_connected';
-- stripe_account_status: 'not_connected' | 'pending' | 'active' | 'restricted'

-- 3. Eliminar columnas de Lemonway de payment_logs
ALTER TABLE payment_logs DROP COLUMN IF EXISTS lemonway_payout_id;
ALTER TABLE payment_logs DROP COLUMN IF EXISTS lemonway_payout_status;
