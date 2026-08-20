-- Add instrument_type column to trading_accounts
-- Exécute ce SQL dans le Dashboard Supabase > SQL Editor

ALTER TABLE trading_accounts
ADD COLUMN IF NOT EXISTS instrument_type TEXT DEFAULT 'CFD';

-- Vérifier la colonne ajoutée
COMMENT ON COLUMN trading_accounts.instrument_type IS 'Type d instrument: CFD ou Futures';
