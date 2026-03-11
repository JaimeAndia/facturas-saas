-- ============================================================
-- MIGRACIÓN v2: Pagos, blockchain y recordatorios
-- Ejecutar en: Supabase → SQL Editor
-- Tablas adaptadas al proyecto real (facturas, profiles, clientes)
-- ============================================================

-- ─── Extensiones a la tabla facturas ─────────────────────────────────────────

ALTER TABLE facturas ADD COLUMN IF NOT EXISTS payment_link_url    TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS payment_token       UUID DEFAULT gen_random_uuid();
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS paid_at             TIMESTAMPTZ;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS blockchain_tx       TEXT;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS blockchain_ledger   INTEGER;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS reminders_sent      INTEGER DEFAULT 0;
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS last_reminder_at    TIMESTAMPTZ;

-- Índice para búsqueda rápida por payment_token (usado en el webhook)
CREATE UNIQUE INDEX IF NOT EXISTS facturas_payment_token_idx ON facturas (payment_token);

-- ─── Tabla: subscriptions (suscripciones de clientes al autónomo) ─────────────

CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  cliente_id               UUID REFERENCES clientes(id) ON DELETE CASCADE,
  stripe_subscription_id   TEXT UNIQUE,
  stripe_product_id        TEXT,
  plan_name                TEXT NOT NULL,
  amount                   DECIMAL(10,2) NOT NULL,
  currency                 TEXT DEFAULT 'eur',
  interval                 TEXT NOT NULL,
  status                   TEXT DEFAULT 'active',
  next_billing_date        DATE,
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- ─── Tabla: payment_logs (registro de eventos de pago) ────────────────────────

CREATE TABLE IF NOT EXISTS payment_logs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID REFERENCES facturas(id) ON DELETE SET NULL,
  event_type        TEXT NOT NULL,
  provider          TEXT NOT NULL,       -- 'stripe' | 'gocardless' | 'xrpl'
  provider_event_id TEXT,
  amount            DECIMAL(10,2),
  status            TEXT,
  raw_payload       JSONB,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs  ENABLE ROW LEVEL SECURITY;

-- Los usuarios solo ven sus propias subscriptions
CREATE POLICY "Users see own subscriptions"
  ON subscriptions FOR ALL
  USING (auth.uid() = user_id);

-- Los usuarios solo ven payment_logs de sus propias facturas
CREATE POLICY "Users see own payment logs"
  ON payment_logs FOR ALL
  USING (
    invoice_id IS NULL
    OR invoice_id IN (SELECT id FROM facturas WHERE user_id = auth.uid())
  );
