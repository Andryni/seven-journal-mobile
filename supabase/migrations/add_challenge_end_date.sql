ALTER TABLE trading_accounts
ADD COLUMN IF NOT EXISTS challenge_end_date TEXT DEFAULT NULL;
