export type TradeTimeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export type MentalState =
  | 'focused'
  | 'anxious'
  | 'greedy'
  | 'revenge'
  | 'fomo'
  | 'tired';

export type AccountType = 'challenge' | 'funded' | 'personal' | 'demo';

import type { MarketType } from '../utils/positionSizing';
export type { MarketType };

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
  /**
   * Trading costs, as positive magnitudes. Optional at the type level because
   * a database that has not run the latest schema simply will not return them,
   * and every consumer must treat that as "unknown", never as zero-by-accident.
   *
   * `pnl` is the NET result and always has been: these fields explain it, they
   * are never subtracted from it a second time.
   */
  commission?: number | null;
  swap?: number | null;
  /**
   * Worst / best PRICE reached while the trade was open. Optional because a
   * database that has not run the latest schema.sql does not return them, and
   * null because "not recorded" must stay distinct from any real price.
   */
  mae_price?: number | null;
  mfe_price?: number | null;
  /**
   * Free-form tags. Optional because an unmigrated database omits the column;
   * kept separate from setup_structures so tagging never pollutes the playbook
   * setup statistics.
   */
  tags?: string[] | null;
  /**
   * Human fields promote_sync_trades had to invent because the broker feed
   * cannot carry them. Empty on a hand-written trade.
   *
   * Without this, a seeded mental_state of 'focused' is indistinguishable
   * from one the trader chose, and behavioural statistics quietly count
   * imports that were never assessed.
   */
  seeded_fields?: string[] | null;
  /**
   * Staging row this trade was promoted from, when it came via the broker
   * bridge. Null for a hand-written trade. `on delete set null` in the
   * schema: purging staging never touches the journal.
   */
  sync_source_id?: string | null;
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
  /** CLOSED = closed by the broker outside TP/SL/BE (manual, margin, session). */
  result: 'TP' | 'SL' | 'BE' | 'CLOSED' | 'OPEN';
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
  /** Market the account trades. Drives the size unit: lots / contracts / units. */
  instrument_type?: MarketType;
  /** IANA timezone used server-side to bucket trades into trading days. */
  timezone?: string;
  challenge_end_date?: string | null;
  /**
   * Personal discipline rules, applicable to any account type. Null means the
   * rule is not set — distinct from a limit of zero, which would lock the
   * session permanently.
   */
  max_trades_per_day?: number | null;
  max_risk_per_trade_pct?: number | null;
  max_consecutive_losses?: number | null;
  /**
   * How the account is fed: 'manual' (typed by hand, default) or 'auto'
   * (fed by a sync connector — balance is then derived, not entered).
   * Optional at the type level: an unmigrated database omits the column.
   */
  feed_mode?: 'manual' | 'auto';
  created_at: string;
}

/**
 * One partial exit of a trade.
 *
 * Additive detail: `trades.pnl` stays the authoritative net total, these rows
 * explain how it was reached. A trade with no exits behaves as it always did.
 */
export interface TradeExit {
  id: string;
  user_id: string;
  trade_id: string;
  /** Quantity closed, in the same unit as trades.size. */
  size: number;
  price: number;
  exit_time: string;
  /** Net result of this slice. Null when the trader logged levels only. */
  pnl?: number | null;
  note?: string | null;
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
  /** Machine-readable reason set by the Postgres rule engine. */
  lock_code?: string | null;
  /** Interpolation values for the localized lock message. */
  lock_params?: {
    account?: string;
    loss?: number;
    limit?: number;
    /** Trades taken / losses in a row, for the personal-rule lock codes. */
    count?: number;
  } | null;
}


