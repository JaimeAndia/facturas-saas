-- Seguimiento de recordatorios de pago por factura
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS reminders_sent INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ;
