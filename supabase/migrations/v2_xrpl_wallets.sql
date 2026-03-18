-- Migración: wallets XRPL por usuario
-- El seed cifrado NUNCA se devuelve en ninguna API response ni se loguea

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xrpl_address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xrpl_seed_encrypted TEXT;

-- Índice para la query del endpoint de migración masiva
CREATE INDEX IF NOT EXISTS idx_profiles_xrpl_address ON profiles (xrpl_address)
  WHERE xrpl_address IS NULL;
