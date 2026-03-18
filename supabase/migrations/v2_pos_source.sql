-- Migración: Añadir columna source a facturas para identificar el canal de creación
-- source: 'web' | 'pos' | null (null = web, retrocompatible)
ALTER TABLE facturas ADD COLUMN IF NOT EXISTS source TEXT;
