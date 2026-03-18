-- ============================================================
-- MIGRACIÓN v2_recurrentes_cobro_auto: Cobro automático en facturas recurrentes
-- Ejecutar en: Supabase → SQL Editor
-- MOSTRAR AL USUARIO ANTES DE EJECUTAR (regla CLAUDE.md #8)
-- ============================================================

-- ─── Extensiones a facturas_recurrentes ───────────────────────────────────────

-- Modo de cobro: false = cron manual, true = Stripe Subscription en Express
ALTER TABLE facturas_recurrentes
  ADD COLUMN IF NOT EXISTS cobro_automatico BOOLEAN NOT NULL DEFAULT false;

-- Estado de la suscripción Stripe del cliente
-- 'manual' | 'pending_setup' | 'active' | 'past_due' | 'canceled'
ALTER TABLE facturas_recurrentes
  ADD COLUMN IF NOT EXISTS cobro_status TEXT NOT NULL DEFAULT 'manual';

-- ID de la Stripe Subscription en la cuenta Express del autónomo
-- ÚNICO: cada recurrente tiene como máximo una suscripción activa
ALTER TABLE facturas_recurrentes
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE;

-- ID del Stripe Customer en la cuenta Express (el cliente, no el autónomo)
ALTER TABLE facturas_recurrentes
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- ID del Stripe Price en la cuenta Express (precio creado para esta recurrente)
ALTER TABLE facturas_recurrentes
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- URL de checkout de Stripe para que el cliente introduzca su tarjeta
-- Se genera al activar cobro automático y se comparte con el cliente
ALTER TABLE facturas_recurrentes
  ADD COLUMN IF NOT EXISTS setup_url TEXT;

-- ─── Extensión a facturas ─────────────────────────────────────────────────────

-- Referencia a la Stripe Invoice (para dunning y trazabilidad)
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS stripe_invoice_id TEXT;

-- ─── Índices ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_facturas_recurrentes_stripe_subscription_id
  ON facturas_recurrentes(stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_facturas_recurrentes_cobro_automatico
  ON facturas_recurrentes(cobro_automatico)
  WHERE cobro_automatico = true;

-- ─── Constraint en cobro_status ───────────────────────────────────────────────

ALTER TABLE facturas_recurrentes
  ADD CONSTRAINT facturas_recurrentes_cobro_status_check
  CHECK (cobro_status IN ('manual', 'pending_setup', 'active', 'past_due', 'canceled'));
