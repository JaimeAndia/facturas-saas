-- ============================================================
-- MIGRACIÓN v2_subscriptions: Suscripciones de clientes
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ─── Extensiones a la tabla subscriptions ─────────────────────────────────

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id            TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id         TEXT;
-- Nota: este stripe_customer_id es el del CLIENTE del usuario en la cuenta
-- Stripe principal de FacturX. Distinto del stripe_customer_id de profiles,
-- que es el del usuario para sus propios planes de la app.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS gocardless_subscription_id TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method             TEXT DEFAULT 'stripe';
-- payment_method: 'stripe' | 'gocardless'
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cancelled_at               TIMESTAMPTZ;

-- ─── Extensión a la tabla clientes ────────────────────────────────────────

-- stripe_customer_id del cliente en la cuenta principal de FacturX
-- (para suscripciones de cobro, distinto del stripe_customer_id de profiles)
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
