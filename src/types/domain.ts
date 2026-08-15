export type TradePair = 'XAUUSD' | 'NAS100' | 'EURUSD' | 'GBPUSD' | 'BTCUSD';

export type TradeDirection = 'BUY' | 'SELL';

export type TradeTimeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export type SmcStructure = 'BOS' | 'CHoCH';

export type BookmapVwapPosition = 'above' | 'below' | 'at';

export type MentalState =
  | 'focused'
  | 'anxious'
  | 'greedy'
  | 'revenge'
  | 'fomo'
  | 'tired';

export type AccountType = 'challenge' | 'funded' | 'personal' | 'demo';

export const MENTAL_STATE_LABELS: Record<MentalState, string> = {
  focused: 'FOCUSED — Concentré, calme',
  anxious: 'ANXIOUS — Stressé, peur de perdre',
  greedy: 'GREEDY — Envie de forcer la taille',
  revenge: 'REVENGE — Veut se refaire',
  fomo: 'FOMO — Peur de rater le move',
  tired: 'TIRED — Fatigue physique / visuelle',
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  challenge: 'CHALLENGE PROP',
  funded: 'FUNDED PROP',
  personal: 'COMPTE PERSONNEL',
  demo: 'COMPTE DEMO',
};

export const TRADE_PAIRS: TradePair[] = [
  'XAUUSD',
  'NAS100',
  'EURUSD',
  'GBPUSD',
  'BTCUSD',
];

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

export interface DailyDebrief {
  id: string;
  user_id: string;
  date: string; // YYYY-MM-DD
  market_sentiment?: string;
  htf_analysis?: string;
  htf_image_url?: string | null;
  lessons_learned?: string;
  objective_tomorrow?: string;
  mental_score?: number;
  day_rating?: number | null;
  emotion_before?: string;
  mistakes_committed?: string[];
  rules_followed?: string[];
  created_at?: string;
}
