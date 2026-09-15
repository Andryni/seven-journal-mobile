import type { Trade, TradingAccount } from '../../types/domain';
import { isSameLocalDay } from '../../utils/formatDate';

/**
 * Personal discipline rules.
 *
 * The Lock Guard already enforced a daily LOSS limit for every account type.
 * What was missing is that money is a lagging indicator of tilt: by the time
 * the loss limit trips, the overtrading and the revenge entries have already
 * happened. These rules stop the session on the behaviour instead.
 *
 * This mirrors `enforce_daily_loss_limit` in schema.sql. The server remains the
 * authority -- it is what actually writes the lock -- but the client evaluates
 * the same rules so the trader is warned BEFORE placing the trade rather than
 * being told afterwards that the door is now shut.
 *
 * Priority matches the SQL exactly: trade count, then losing streak, then the
 * loss limit. A rule set to null is not configured and never fires; a limit of
 * zero is rejected at the schema level because it would lock the day forever.
 */

export type PersonalRuleCode =
  | 'MAX_TRADES_PER_DAY'
  | 'MAX_CONSECUTIVE_LOSSES'
  | 'MAX_RISK_PER_TRADE';

export interface RuleBreach {
  code: PersonalRuleCode;
  /** Current value that triggered the breach. */
  count: number;
  /** The configured limit. */
  limit: number;
}

export interface PersonalRuleState {
  /** Trades taken today on this account. */
  tradesToday: number;
  /** Losses in a row, counted back from the most recent closed trade. */
  losingStreak: number;
  /** Configured caps, null when not set. */
  maxTradesPerDay: number | null;
  maxConsecutiveLosses: number | null;
  maxRiskPerTradePct: number | null;
  /** The breach that should stop the session, or null. */
  breach: RuleBreach | null;
  /** True when at least one personal rule is configured. */
  hasRules: boolean;
}

function positiveOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  if (!Number.isFinite(v) || v <= 0) return null;
  return v;
}

/** Trades of a given account that belong to today, in device-local time. */
export function todaysTrades(trades: Trade[], accountId: string | null): Trade[] {
  const list = trades ?? [];
  const scoped = accountId ? list.filter(t => t.account_id === accountId) : list;
  return scoped.filter(t => isSameLocalDay(t.entry_time));
}

/**
 * Losses in a row, counted backwards from the most recent closed trade.
 * Open trades are skipped rather than treated as wins: an unresolved position
 * should not quietly reset a streak that is still running.
 */
export function losingStreak(trades: Trade[]): number {
  const closed = (trades ?? [])
    .filter(t => t.pnl !== null && t.pnl !== undefined && Number.isFinite(t.pnl))
    .slice()
    .sort((a, b) => {
      const d = new Date(b.entry_time).getTime() - new Date(a.entry_time).getTime();
      if (d !== 0) return d;
      // Same timestamp: fall back to creation order so the walk is stable.
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  let streak = 0;
  for (const t of closed) {
    if ((t.pnl as number) < 0) streak += 1;
    else break;
  }
  return streak;
}

/**
 * Evaluate every personal rule for today.
 *
 * `plannedRiskPct` is the risk of a candidate trade, as a percentage of the
 * account balance. It is only used for the per-trade risk rule, which is the
 * one rule that cannot be judged from history alone.
 */
export function evaluatePersonalRules(
  trades: Trade[],
  account: TradingAccount | null,
  plannedRiskPct: number | null = null
): PersonalRuleState {
  const maxTradesPerDay = positiveOrNull(account?.max_trades_per_day);
  const maxConsecutiveLosses = positiveOrNull(account?.max_consecutive_losses);
  const maxRiskPerTradePct = positiveOrNull(account?.max_risk_per_trade_pct);

  const today = todaysTrades(trades ?? [], account?.id ?? null);
  const tradesToday = today.length;
  const streak = losingStreak(today);

  let breach: RuleBreach | null = null;
  if (maxTradesPerDay !== null && tradesToday >= maxTradesPerDay) {
    breach = { code: 'MAX_TRADES_PER_DAY', count: tradesToday, limit: maxTradesPerDay };
  } else if (maxConsecutiveLosses !== null && streak >= maxConsecutiveLosses) {
    breach = {
      code: 'MAX_CONSECUTIVE_LOSSES',
      count: streak,
      limit: maxConsecutiveLosses,
    };
  } else if (
    maxRiskPerTradePct !== null &&
    plannedRiskPct !== null &&
    Number.isFinite(plannedRiskPct) &&
    plannedRiskPct > maxRiskPerTradePct
  ) {
    breach = {
      code: 'MAX_RISK_PER_TRADE',
      count: Math.round(plannedRiskPct * 100) / 100,
      limit: maxRiskPerTradePct,
    };
  }

  return {
    tradesToday,
    losingStreak: streak,
    maxTradesPerDay,
    maxConsecutiveLosses,
    maxRiskPerTradePct,
    breach,
    hasRules:
      maxTradesPerDay !== null ||
      maxConsecutiveLosses !== null ||
      maxRiskPerTradePct !== null,
  };
}
