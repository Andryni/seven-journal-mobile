-- ==========================================================
-- SEVEN JOURNAL - MIGRATION GLOBALE SUPABASE (2026)
-- Exécutez ce script dans l'éditeur SQL de votre dashboard Supabase
-- ==========================================================

-- 1. Table des verrous de session journalière (Anti-Revenge Lock Guard)
CREATE TABLE IF NOT EXISTS daily_session_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sl_count INTEGER DEFAULT 0,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMPTZ,
  unlock_at TIMESTAMPTZ,
  lock_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_daily_lock UNIQUE (user_id, date)
);

-- Activation RLS sur daily_session_locks
ALTER TABLE daily_session_locks ENABLE ROW LEVEL SECURITY;

DO 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'daily_session_locks' AND policyname = 'Users can manage their own daily locks'
  ) THEN
    CREATE POLICY "Users can manage their own daily locks"
      ON daily_session_locks
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END ;

-- 2. Colonnes nécessaires sur la table 	rading_accounts
ALTER TABLE trading_accounts
  ADD COLUMN IF NOT EXISTS instrument_type TEXT DEFAULT 'CFD',
  ADD COLUMN IF NOT EXISTS futures_type TEXT DEFAULT 'mini',
  ADD COLUMN IF NOT EXISTS leverage INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS challenge_end_date DATE;

-- 3. Colonnes et types nécessaires sur la table trades
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS exit_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS mental_state TEXT DEFAULT 'focused',
  ADD COLUMN IF NOT EXISTS session TEXT,
  ADD COLUMN IF NOT EXISTS plan_respected BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS execution_grade TEXT DEFAULT 'A',
  ADD COLUMN IF NOT EXISTS mistakes JSONB DEFAULT '[]'::jsonb;

-- 4. Colonnes nécessaires sur daily_debriefs
ALTER TABLE daily_debriefs
  ADD COLUMN IF NOT EXISTS rules_followed JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS mistakes_committed JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS day_rating NUMERIC,
  ADD COLUMN IF NOT EXISTS mental_score NUMERIC;

-- 5. Index d'optimisation des performances pour les requêtes d'Analytics
CREATE INDEX IF NOT EXISTS idx_trades_account_user ON trades (account_id, user_id);
CREATE INDEX IF NOT EXISTS idx_trades_entry_time ON trades (entry_time DESC);
CREATE INDEX IF NOT EXISTS idx_trades_result_pnl ON trades (result, pnl);
CREATE INDEX IF NOT EXISTS idx_daily_locks_user_date ON daily_session_locks (user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_debriefs_date ON daily_debriefs (user_id, date DESC);
