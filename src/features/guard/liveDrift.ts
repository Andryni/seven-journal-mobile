import type { Trade, TradingAccount } from '../../types/domain';
import type { SyncTradeRow } from '../sync/normalize';
import { isSameLocalDay } from '../../utils/formatDate';

/**
 * Personal rules checked DURING the session, not when journaling it.
 *
 * usePreTradeGuard already evaluates the same rules, but it only runs inside
 * the two entry forms -- so it fires when the trader writes the trade down,
 * which is after the position is open and often after the day is lost. The
 * bridge changed that: sync_trades carries live positions with is_open, so
 * the app now knows a fourth position exists the moment MT5 reports it.
 *
 * This module answers one question: given what the broker says is open right
 * now, is a personal rule already broken?
 *
 * Pure and dependency-free. What deserves tests is the counting and the
 * silence rules, not the notification plumbing.
 */

export type DriftCode =
  | 'MAX_TRADES_PER_DAY'
  | 'MAX_CONSECUTIVE_LOSSES'
  | 'MAX_OPEN_POSITIONS';

export interface DriftAlert {
  code: DriftCode;
  /** What is actually happening right now. */
  count: number;
  /** The rule's own threshold. */
  limit: number;
  /**
   * Stable per day and per breach, so a notification is sent once rather
   * than on every poll. Includes the count: crossing 4 then 5 are two
   * distinct facts worth saying, 4 reported twice is noise.
   */
  key: string;
}

export interface LiveDriftInput {
  /** Journal trades, for today's realised history. */
  trades: Trade[];
  /** Staging rows from the bridge; only is_open ones are live positions. */
  staging: SyncTradeRow[];
  account: TradingAccount | null;
  /**
   * Reference instant. Injectable for tests, but it also has to be threaded
   * through every day comparison below: a helper that quietly calls
   * new Date() ignores it, which makes the module both untestable and wrong
   * for the few seconds around local midnight.
   */
  now?: Date;
}

const positiveOrNull = (v: number | null | undefined): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

/** Positions the broker currently reports as open. */
export function openPositions(staging: SyncTradeRow[]): SyncTradeRow[] {
  return (staging ?? []).filter(r => r?.is_open === true);
}

/**
 * Positions opened today, by the broker's own open_time.
 *
 * Deliberately not created_at: a row can be ingested late (the EA reconnects,
 * a re-import replays history) and counting it as "opened today" would warn
 * about a position from last week.
 */
export function openedToday(staging: SyncTradeRow[], now: Date): SyncTradeRow[] {
  const day = localDayKey(now);
  return openPositions(staging).filter(r => {
    if (!r.open_time) return false;
    const d = new Date(r.open_time);
    if (Number.isNaN(d.getTime())) return false;
    return localDayKey(d) === day;
  });
}

/**
 * Consecutive losing trades at the end of today, from the journal.
 *
 * Only closed trades can lose, so this reads the journal rather than the
 * staging rows. A breakeven neither extends nor breaks the streak, matching
 * personalRules.
 */
export function losingStreakToday(
  trades: Trade[],
  accountId: string | null,
  now: Date = new Date()
): number {
  const today = (trades ?? [])
    .filter(t => (accountId ? t.account_id === accountId : true))
    .filter(t => t.pnl !== null && t.pnl !== undefined)
    .filter(t => isSameLocalDay(t.entry_time, now))
    .sort(
      (a, b) =>
        new Date(a.exit_time || a.entry_time || 0).getTime() -
        new Date(b.exit_time || b.entry_time || 0).getTime()
    );

  let streak = 0;
  for (let i = today.length - 1; i >= 0; i--) {
    const pnl = today[i].pnl ?? 0;
    if (pnl < 0) streak += 1;
    else if (pnl > 0) break;
    // A scratch is skipped: it is neither a loss nor a recovery.
  }
  return streak;
}

/**
 * The single alert worth raising now, or null.
 *
 * One at a time, on purpose. Three simultaneous warnings are three things to
 * dismiss, and a trader who dismisses a warning once stops reading the next.
 * Ordered by how far past the line the behaviour already is.
 */
export function evaluateLiveDrift(input: LiveDriftInput): DriftAlert | null {
  const { trades, staging, account, now = new Date() } = input;
  if (!account) return null;

  const day = localDayKey(now);
  const live = openedToday(staging, now);

  // Trades taken today = closed ones in the journal + still-open ones from
  // the broker. Counting only the journal is how the old guard missed the
  // fourth position: it was open, not yet written down.
  const closedToday = (trades ?? [])
    .filter(t => t.account_id === account.id)
    .filter(t => t.pnl !== null && t.pnl !== undefined)
    .filter(t => isSameLocalDay(t.entry_time, now)).length;

  const takenToday = closedToday + live.length;

  const maxTrades = positiveOrNull(account.max_trades_per_day);
  if (maxTrades !== null && takenToday > maxTrades) {
    return {
      code: 'MAX_TRADES_PER_DAY',
      count: takenToday,
      limit: maxTrades,
      key: `${day}:MAX_TRADES_PER_DAY:${takenToday}`,
    };
  }

  const maxLosses = positiveOrNull(account.max_consecutive_losses);
  const streak = losingStreakToday(trades, account.id, now);
  if (maxLosses !== null && streak >= maxLosses && live.length > 0) {
    /**
     * Only while something is open.
     *
     * After the streak the trader has already stopped, or has not started
     * again; telling them about it then is a debrief, and the debrief screen
     * already does that. This alert exists to interrupt a position that is
     * running against a rule.
     */
    return {
      code: 'MAX_CONSECUTIVE_LOSSES',
      count: streak,
      limit: maxLosses,
      key: `${day}:MAX_CONSECUTIVE_LOSSES:${streak}`,
    };
  }

  return null;
}
