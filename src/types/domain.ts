export type TradeTimeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export type MentalState =
  | 'focused'
  | 'anxious'
  | 'greedy'
  | 'revenge'
  | 'fomo'
  | 'tired';

export type AccountType = 'challenge' | 'funded' | 'personal' | 'demo';

export type ExecutionGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export type MistakeTag =
  | 'early_exit'
  | 'moved_sl'
  | 'fomo_entry'
  | 'overleveraged'
  | 'counter_trend'
  | 'impatience'
  | 'revenge_trade';

export interface Trade {
  id: string;
  user_id: string;
  account_id: string;
  pair: string;
  direction: 'BUY' | 'SELL';
  entry_price: number;
  exit_price: number | null;
  stop_loss: number;
  take_profit: number;
  size: number;
  entry_time: string;
  exit_time: string | null;
  pnl: number | null;
  r_multiple: number | null;
  timeframe: 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';
  setup_structures: string[];
  setup_fvg: boolean;
  setup_ob: boolean;
  setup_liquidity_sweep: boolean;
  bookmap_absorption: string | null;
  bookmap_passive_orders: string | null;
  bookmap_aggressive_orders: string | null;
  bookmap_vwap_position: 'above' | 'below' | 'at' | null;
  mental_state: 'focused' | 'anxious' | 'greedy' | 'revenge' | 'fomo' | 'tired';
  cookie_jar_ref: boolean;
  rule_40_percent: boolean;
  plan_respected?: boolean;
  execution_grade?: ExecutionGrade | null;
  mistakes?: MistakeTag[];
  screenshot_before_url: string | null;
  screenshot_after_url: string | null;
  notes: string | null;
  result: 'TP' | 'SL' | 'BE' | 'OPEN';
  session: 'Asia' | 'London' | 'New York' | 'Over Session' | null;
  created_at: string;
}

export interface TradingAccount {
  id: string;
  user_id: string;
  name: string;
  type: 'challenge' | 'funded' | 'personal' | 'demo';
  balance: number;
  initial_balance: number;
  currency: string;
  is_active: boolean;
  max_daily_loss_limit: number | null;
  max_drawdown_limit?: number | null;
  drawdown_type?: 'static' | 'trailing';
  profit_target?: number | null;
  consistency_rule_percent?: number | null;
  instrument_type?: 'CFD' | 'Futures';
  futures_type?: 'mini' | 'micro';
  leverage?: number;
  challenge_end_date?: string | null;
  created_at: string;
}

export interface DailySessionLock {
  id: string;
  user_id: string;
  date: string;
  sl_count: number;
  is_locked: boolean;
  locked_at: string | null;
  unlock_at: string | null;
  lock_reason: string | null;
}


