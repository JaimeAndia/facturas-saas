-- ============================================================
-- MIGRACIÓN v2_factura_recurrente_id
-- Enlaza las facturas generadas por el cron con su recurrente origen
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- Columna que conecta cada factura generada automáticamente con su plantilla
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS factura_recurrente_id UUID
    REFERENCES facturas_recurrentes(id) ON DELETE SET NULL;

-- Índice para buscar todas las facturas de una recurrencia concreta
CREATE INDEX IF NOT EXISTS idx_facturas_recurrente_id
  ON facturas(factura_recurrente_id)
  WHERE factura_recurrente_id IS NOT NULL;
