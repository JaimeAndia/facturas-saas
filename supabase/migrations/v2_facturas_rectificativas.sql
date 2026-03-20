-- ============================================================
-- MIGRACIÓN: Facturas rectificativas (abonos)
-- Ejecutar en: Supabase → SQL Editor
-- ============================================================

-- ─── Nuevas columnas en facturas ─────────────────────────────────────────────

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'normal'
    CHECK (tipo IN ('normal', 'rectificativa'));

ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS factura_rectificada_id UUID
    REFERENCES facturas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS facturas_rectificada_id_idx
  ON facturas (factura_rectificada_id);

-- ─── RPC: fn_generar_numero_abono ────────────────────────────────────────────
-- Genera números con formato ABO-YYYY-XXXX, independiente del contador de FAC-

CREATE OR REPLACE FUNCTION fn_generar_numero_abono(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year  TEXT    := to_char(now(), 'YYYY');
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) + 1
    INTO v_count
    FROM facturas
   WHERE user_id = p_user_id
     AND tipo = 'rectificativa'
     AND date_part('year', created_at) = date_part('year', now());

  RETURN 'ABO-' || v_year || '-' || lpad(v_count::TEXT, 4, '0');
END;
$$;
