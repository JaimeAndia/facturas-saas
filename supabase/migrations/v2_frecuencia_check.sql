-- Migración: ampliar el CHECK de frecuencia en facturas_recurrentes
-- para admitir el formato "personalizado_N_(dias|semanas|meses)"
-- además de los valores fijos mensual / trimestral / anual.

ALTER TABLE facturas_recurrentes
  DROP CONSTRAINT IF EXISTS facturas_recurrentes_frecuencia_check;

ALTER TABLE facturas_recurrentes
  ADD CONSTRAINT facturas_recurrentes_frecuencia_check
  CHECK (
    frecuencia IN ('mensual', 'trimestral', 'anual')
    OR frecuencia ~ '^personalizado_[1-9][0-9]*_(dias|semanas|meses)$'
  );
