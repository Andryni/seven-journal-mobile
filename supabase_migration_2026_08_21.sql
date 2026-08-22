-- ============================================
-- Migration: 2026-08-21
-- ============================================

-- 1. Nouvelles colonnes sur trading_accounts
ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS futures_type TEXT,
  ADD COLUMN IF NOT EXISTS leverage INTEGER DEFAULT 100;

-- 2. Vérifier que exit_time existe sur trades
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'trades' AND column_name = 'exit_time'
  ) THEN
    ALTER TABLE trades ADD COLUMN exit_time TIMESTAMPTZ;
  END IF;
END $$;

-- 3. Index pour performances
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades (entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON trades (account_id);
CREATE INDEX IF NOT EXISTS idx_trades_result ON trades (result);
CREATE INDEX IF NOT EXISTS idx_trades_pnl ON trades (pnl);
CREATE INDEX IF NOT EXISTS idx_trades_session ON trades (session);
