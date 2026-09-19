import type { Trade, TradingAccount } from '../../types/domain';

/**
 * Comparing the journal's balance with the broker's.
 *
 * The journal derives a balance by summing P&L onto the starting capital.
 * The broker simply knows it. They drift, and the drift is information:
 * uncaptured fees, a trade the bridge missed, a deposit or withdrawal never
 * recorded.
 *
 * Today nothing says any of that. If the bridge drops a trade, the statistics
 * describe an incomplete history and look entirely healthy doing it. A journal
 * that KNOWS it is incomplete is worth considerably more than one that assumes
 * it is not.
 *
 * Pure and dependency-free: the arithmetic and, more importantly, the silence
 * rules are what deserve tests.
 */

export type ReconcileVerdict =
  /** No broker state yet — an old EA, or a connector that never beat. */
  | 'unknown'
  /** Within tolerance. */
  | 'match'
  /** Outside tolerance, journal below broker: something is missing. */
  | 'journal_low'
  /** Outside tolerance, journal above broker: costs not captured. */
  | 'journal_high';

export interface ReconcileResult {
  verdict: ReconcileVerdict;
  /** Balance the journal computes, or null when there is no capital set. */
  journalBalance: number | null;
  /** Balance the broker last reported, or null. */
  brokerBalance: number | null;
  /** broker - journal, rounded. Null when either side is unknown. */
  difference: number | null;
  /** Absolute difference as a fraction of the broker balance, 0..1. */
  driftPct: number | null;
  /** When the broker state was last received. */
  brokerAt: string | null;
  /** Plain-language cause, most likely first. Empty when matched. */
  hints: ReconcileHint[];
}

export type ReconcileHint =
  | 'missing_trades'
  | 'uncaptured_costs'
  | 'cash_movement'
  | 'open_positions';

/**
 * Tolerance before a gap is worth reporting.
 *
 * Absolute floor AND a percentage: on a 200 USD account a 5 USD gap matters,
 * on a 100k account it is noise. Reporting either as a problem is how an
 * alert becomes something the trader learns to ignore.
 */
export const TOLERANCE_ABS = 1;
export const TOLERANCE_PCT = 0.005; // 0.5%

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ReconcileInput {
  account: TradingAccount | null;
  /** Trades already scoped to that account. */
  trades: Trade[];
  brokerBalance?: number | null;
  brokerAt?: string | null;
  /** Cash in and out the trader has declared, net. */
  netCashFlow?: number;
}

/**
 * Balance the journal believes in: starting capital plus realised P&L.
 *
 * Open positions are excluded because their P&L is unrealised — the broker's
 * BALANCE excludes it too (that is what equity is for), so including it here
 * would manufacture a gap on every open position.
 */
export function journalBalance(
  account: TradingAccount | null,
  trades: Trade[],
  netCashFlow = 0
): number | null {
  if (!account) return null;
  const start = account.initial_balance;
  if (typeof start !== 'number' || !Number.isFinite(start)) return null;

  const realised = (trades ?? [])
    .filter(t => t.pnl !== null && t.pnl !== undefined)
    .reduce((sum, t) => sum + (t.pnl as number), 0);

  return round2(start + realised + netCashFlow);
}

/** Whether any position is still open, which explains an equity gap. */
function hasOpenPositions(trades: Trade[]): boolean {
  return (trades ?? []).some(t => t.pnl === null || t.pnl === undefined);
}

/**
 * Likely causes, ordered by how actionable they are.
 *
 * Deliberately phrased as hypotheses, not findings. The app cannot know why
 * the numbers differ; naming a cause it cannot prove would be exactly the
 * kind of confident wrongness the rest of this journal avoids.
 */
function explain(difference: number, trades: Trade[]): ReconcileHint[] {
  const hints: ReconcileHint[] = [];

  if (difference > 0) {
    // Broker richer than the journal: the journal has not recorded something.
    hints.push('missing_trades');
    hints.push('cash_movement');
  } else {
    // Journal richer: it has been too optimistic, usually on costs.
    hints.push('uncaptured_costs');
    hints.push('cash_movement');
  }

  if (hasOpenPositions(trades)) hints.push('open_positions');
  return hints;
}

export function reconcileBalance(input: ReconcileInput): ReconcileResult {
  const { account, trades, brokerBalance = null, brokerAt = null, netCashFlow = 0 } = input;

  const journal = journalBalance(account, trades, netCashFlow);

  const base: ReconcileResult = {
    verdict: 'unknown',
    journalBalance: journal,
    brokerBalance: null,
    difference: null,
    driftPct: null,
    brokerAt,
    hints: [],
  };

  // "Unknown" and "matches" must never be conflated: a card claiming
  // agreement on data it does not have is worse than no card.
  if (
    journal === null ||
    typeof brokerBalance !== 'number' ||
    !Number.isFinite(brokerBalance)
  ) {
    return base;
  }

  const difference = round2(brokerBalance - journal);
  const magnitude = Math.abs(difference);
  const scale = Math.abs(brokerBalance) > 0 ? Math.abs(brokerBalance) : 1;
  const driftPct = magnitude / scale;

  const withinTolerance = magnitude <= TOLERANCE_ABS || driftPct <= TOLERANCE_PCT;

  return {
    verdict: withinTolerance ? 'match' : difference > 0 ? 'journal_low' : 'journal_high',
    journalBalance: journal,
    brokerBalance: round2(brokerBalance),
    difference,
    driftPct: Math.round(driftPct * 10000) / 10000,
    brokerAt,
    hints: withinTolerance ? [] : explain(difference, trades),
  };
}
