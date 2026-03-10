-- =============================================================
-- ESQUEMA DE BASE DE DATOS — FacturApp
-- Ejecutar en el SQL Editor de Supabase
-- =============================================================


-- =============================================================
-- 1. TABLAS
-- =============================================================

-- Perfil del autónomo (uno por cada usuario de auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id                      UUID        REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  email                   TEXT        NOT NULL,
  nombre                  TEXT,
  apellidos               TEXT,
  nif                     TEXT,
  direccion               TEXT,
  ciudad                  TEXT,
  codigo_postal           TEXT,
  provincia               TEXT,
  telefono                TEXT,
  logo_url                TEXT,
  -- Stripe (gestionado por webhook)
  stripe_customer_id      TEXT        UNIQUE,
  stripe_subscription_id  TEXT        UNIQUE,
  plan                    TEXT        NOT NULL DEFAULT 'free'
                            CHECK (plan IN ('free', 'basico', 'pro')),
  plan_status             TEXT
                            CHECK (plan_status IN ('active', 'canceled', 'past_due', 'trialing'))
);

-- Clientes del autónomo
CREATE TABLE IF NOT EXISTS public.clientes (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nombre        TEXT        NOT NULL,
  nif           TEXT,
  email         TEXT,
  telefono      TEXT,
  direccion     TEXT,
  ciudad        TEXT,
  codigo_postal TEXT,
  provincia     TEXT,
  pais          TEXT        NOT NULL DEFAULT 'España',
  notas         TEXT
);

-- Facturas emitidas
CREATE TABLE IF NOT EXISTS public.facturas (
  id                  UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  user_id             UUID          NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cliente_id          UUID          NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  numero              TEXT          NOT NULL,
  fecha_emision       DATE          NOT NULL,
  fecha_vencimiento   DATE,
  estado              TEXT          NOT NULL DEFAULT 'borrador'
                        CHECK (estado IN ('borrador', 'emitida', 'pagada', 'vencida', 'cancelada')),
  base_imponible      DECIMAL(10,2) NOT NULL,
  iva_porcentaje      DECIMAL(5,2)  NOT NULL DEFAULT 21,
  iva_importe         DECIMAL(10,2) NOT NULL,
  irpf_porcentaje     DECIMAL(5,2)  NOT NULL DEFAULT 15,
  irpf_importe        DECIMAL(10,2) NOT NULL,
  total               DECIMAL(10,2) NOT NULL,
  notas               TEXT,
  pdf_url             TEXT,
  -- Número único por usuario y año
  UNIQUE (user_id, numero)
);

-- Líneas de cada factura
CREATE TABLE IF NOT EXISTS public.lineas_factura (
  id               UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  factura_id       UUID          NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,
  descripcion      TEXT          NOT NULL,
  cantidad         DECIMAL(10,2) NOT NULL DEFAULT 1,
  precio_unitario  DECIMAL(10,2) NOT NULL,
  subtotal         DECIMAL(10,2) NOT NULL,
  orden            INTEGER       NOT NULL DEFAULT 0
);


-- =============================================================
-- 2. ÍNDICES
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_clientes_user_id        ON public.clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_facturas_user_id         ON public.facturas(user_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cliente_id      ON public.facturas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado          ON public.facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_emision   ON public.facturas(fecha_emision DESC);
CREATE INDEX IF NOT EXISTS idx_lineas_factura_id        ON public.lineas_factura(factura_id);


-- =============================================================
-- 3. FUNCIÓN updated_at — actualiza el campo antes de cada UPDATE
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE OR REPLACE TRIGGER trg_facturas_updated_at
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();


-- =============================================================
-- 4. TRIGGER — crea el perfil automáticamente al registrarse
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre)
  VALUES (
    NEW.id,
    NEW.email,
    -- Toma el nombre del metadata si se pasó durante el registro
    COALESCE(NEW.raw_user_meta_data->>'nombre', NULL)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Elimina el trigger si ya existía para poder recrearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.fn_handle_new_user();


-- =============================================================
-- 5. FUNCIÓN — genera el número de factura correlativo
--    Formato: FAC-YYYY-NNNN  (ej: FAC-2026-0001)
--    Reinicia el contador cada año por usuario
-- =============================================================

CREATE OR REPLACE FUNCTION public.fn_generar_numero_factura(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_año       INTEGER;
  v_siguiente INTEGER;
  v_prefijo   TEXT;
BEGIN
  v_año     := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  v_prefijo := 'FAC-' || v_año || '-';

  -- Obtiene el mayor número secuencial del año en curso para este usuario
  -- y le suma 1. Si no hay facturas previas devuelve 1.
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(numero FROM LENGTH(v_prefijo) + 1)
        AS INTEGER
      )
    ), 0
  ) + 1
  INTO v_siguiente
  FROM public.facturas
  WHERE user_id = p_user_id
    AND numero LIKE v_prefijo || '%';

  RETURN v_prefijo || LPAD(v_siguiente::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================================

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lineas_factura  ENABLE ROW LEVEL SECURITY;

-- ---- profiles -----------------------------------------------
-- El trigger usa SECURITY DEFINER así que puede insertar sin política.
-- El usuario puede leer y actualizar solo su propio perfil.

CREATE POLICY "profiles: leer propio"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: actualizar propio"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- clientes -----------------------------------------------

CREATE POLICY "clientes: leer propios"
  ON public.clientes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "clientes: insertar propios"
  ON public.clientes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clientes: actualizar propios"
  ON public.clientes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "clientes: eliminar propios"
  ON public.clientes FOR DELETE
  USING (auth.uid() = user_id);

-- ---- facturas -----------------------------------------------

CREATE POLICY "facturas: leer propias"
  ON public.facturas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "facturas: insertar propias"
  ON public.facturas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "facturas: actualizar propias"
  ON public.facturas FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "facturas: eliminar propias"
  ON public.facturas FOR DELETE
  USING (auth.uid() = user_id);

-- ---- lineas_factura -----------------------------------------
-- Acceso derivado: el usuario accede a las líneas de sus facturas

CREATE POLICY "lineas_factura: leer propias"
  ON public.lineas_factura FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas
      WHERE facturas.id = lineas_factura.factura_id
        AND facturas.user_id = auth.uid()
    )
  );

CREATE POLICY "lineas_factura: insertar en propias"
  ON public.lineas_factura FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.facturas
      WHERE facturas.id = lineas_factura.factura_id
        AND facturas.user_id = auth.uid()
    )
  );

CREATE POLICY "lineas_factura: actualizar en propias"
  ON public.lineas_factura FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas
      WHERE facturas.id = lineas_factura.factura_id
        AND facturas.user_id = auth.uid()
    )
  );

CREATE POLICY "lineas_factura: eliminar en propias"
  ON public.lineas_factura FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.facturas
      WHERE facturas.id = lineas_factura.factura_id
        AND facturas.user_id = auth.uid()
    )
  );


-- =============================================================
-- FIN DEL ESQUEMA
-- =============================================================
