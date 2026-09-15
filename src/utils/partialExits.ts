import type { Trade, TradeExit } from '../types/domain';

/**
 * Partial exits (scaling out).
 *
 * DESIGN DECISION, and it is the load-bearing one: exits are ADDITIVE detail,
 * not a replacement for `trades.pnl`.
 *
 * The alternative was to turn a trade into a series of executions and derive
 * the P&L. That would have changed the meaning of `trades.pnl` -- read by every
 * statistic, every chart, and the server-side daily-loss trigger -- across live
 * data, for a feature most traders use on a minority of trades. Instead:
 *
 *   - `trades.pnl` remains the authoritative net total for the position.
 *   - Exit rows explain HOW that total was reached.
 *   - A trade with no exits behaves exactly as it always did.
 *
 * The cost of that choice is that the two can disagree, so this module makes
 * the disagreement visible (`reconcile`) rather than silently preferring one.
 * Showing a trader a number that quietly contradicts their broker statement is
 * worse than telling them the two do not match.
 */

const EPSILON = 0.01;

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Exits sorted chronologically. Safe on undefined. */
export function sortedExits(exits: TradeExit[] | null | undefined): TradeExit[] {
  return [...(exits ?? [])].sort(
    (a, b) => new Date(a.exit_time).getTime() - new Date(b.exit_time).getTime()
  );
}

/** Total quantity closed through partial exits. */
export function closedSize(exits: TradeExit[] | null | undefined): number {
  return round2(
    (exits ?? []).reduce((sum, e) => sum + (isNum(e.size) ? Math.abs(e.size) : 0), 0)
  );
}

/**
 * Quantity still open on the position.
 * Never negative: over-closing is a data error reported by `reconcile`, not
 * something to express as a negative remainder.
 */
export function remainingSize(trade: Trade, exits: TradeExit[] | null | undefined): number {
  const total = isNum(trade?.size) ? Math.abs(trade.size) : 0;
  return round2(Math.max(0, total - closedSize(exits)));
}

/** True when every unit of the position has been closed through exits. */
export function isFullyScaledOut(
  trade: Trade,
  exits: TradeExit[] | null | undefined
): boolean {
  const total = isNum(trade?.size) ? Math.abs(trade.size) : 0;
  if (total <= 0 || (exits ?? []).length === 0) return false;
  return closedSize(exits) >= total - EPSILON;
}

/** Sum of the P&L recorded on exits. Null when no exit carries one. */
export function exitsPnl(exits: TradeExit[] | null | undefined): number | null {
  const withPnl = (exits ?? []).filter(e => isNum(e.pnl));
  if (withPnl.length === 0) return null;
  return round2(withPnl.reduce((sum, e) => sum + (e.pnl as number), 0));
}

/**
 * Average exit price, weighted by the size closed at each level.
 *
 * This is the number that tells a trader whether scaling out helped: comparing
 * it to the final price shows whether the early exits were leaving money
 * behind. A plain mean would let a 0.01-lot scratch outweigh a 5-lot exit.
 */
export function averageExitPrice(exits: TradeExit[] | null | undefined): number | null {
  const usable = (exits ?? []).filter(e => isNum(e.price) && isNum(e.size) && e.size > 0);
  if (usable.length === 0) return null;
  const totalSize = usable.reduce((s, e) => s + Math.abs(e.size), 0);
  if (totalSize <= 0) return null;
  const weighted = usable.reduce((s, e) => s + e.price * Math.abs(e.size), 0);
  return round2(weighted / totalSize);
}

export type ReconcileStatus =
  | 'no-exits'
  | 'consistent'
  | 'pnl-mismatch'
  | 'oversized'
  | 'partial';

export interface Reconciliation {
  status: ReconcileStatus;
  /** Quantity closed through exits. */
  closed: number;
  /** Quantity still open. */
  remaining: number;
  /** Sum of exit P&L, when recorded. */
  exitsTotal: number | null;
  /** The trade's authoritative net P&L. */
  tradeTotal: number | null;
  /** exitsTotal - tradeTotal, when both are known. */
  difference: number | null;
}

/**
 * Compare the exit rows against the trade they belong to.
 *
 * Statuses, in the order they are checked:
 *   - 'no-exits'      : nothing recorded, the trade is a plain single exit
 *   - 'oversized'     : exits close more than the position ever held — a data
 *                       entry error that would corrupt any derived average
 *   - 'pnl-mismatch'  : the slices do not add up to the trade's net result
 *   - 'partial'       : consistent, but part of the position is still open
 *   - 'consistent'    : everything adds up
 *
 * 'oversized' is checked before the P&L comparison: when the sizes are wrong,
 * the money is not the finding worth reporting.
 */
export function reconcile(
  trade: Trade,
  exits: TradeExit[] | null | undefined
): Reconciliation {
  const list = exits ?? [];
  const closed = closedSize(list);
  const remaining = remainingSize(trade, list);
  const exitsTotal = exitsPnl(list);
  const tradeTotal = isNum(trade?.pnl) ? trade.pnl : null;
  const difference =
    exitsTotal !== null && tradeTotal !== null ? round2(exitsTotal - tradeTotal) : null;

  const base = { closed, remaining, exitsTotal, tradeTotal, difference };

  if (list.length === 0) return { ...base, status: 'no-exits' };

  const total = isNum(trade?.size) ? Math.abs(trade.size) : 0;
  if (total > 0 && closed > total + EPSILON) {
    return { ...base, status: 'oversized' };
  }

  if (difference !== null && Math.abs(difference) > EPSILON) {
    return { ...base, status: 'pnl-mismatch' };
  }

  if (remaining > EPSILON) return { ...base, status: 'partial' };

  return { ...base, status: 'consistent' };
}

export interface ScaleOutAnalysis {
  exits: number;
  averagePrice: number | null;
  /**
   * What the position would have made had the whole size been held to the
   * final exit price, when that can be computed. Null otherwise.
   */
  heldToLastPnl: number | null;
  /** Realised total (the trade's own figure). */
  realisedPnl: number | null;
  /**
   * heldToLastPnl - realisedPnl. Positive means scaling out cost money;
   * negative means it protected profit. Null when not computable.
   */
  scaleOutEdge: number | null;
}

/**
 * Did scaling out help or hurt on this trade?
 *
 * Compares what was actually realised against holding the full size to the
 * last exit. Requires per-slice P&L to be absent from the estimate, so it is
 * derived from prices and sizes only -- the one basis that cannot double-count.
 *
 * Returns nulls rather than guesses whenever the inputs are incomplete: an
 * invented verdict on whether to scale out is worse than no verdict.
 */
export function analyseScaleOut(
  trade: Trade,
  exits: TradeExit[] | null | undefined
): ScaleOutAnalysis {
  const list = sortedExits(exits).filter(
    e => isNum(e.price) && isNum(e.size) && e.size > 0
  );
  const empty: ScaleOutAnalysis = {
    exits: list.length,
    averagePrice: null,
    heldToLastPnl: null,
    realisedPnl: isNum(trade?.pnl) ? trade.pnl : null,
    scaleOutEdge: null,
  };
  if (list.length < 2) return empty;

  const avg = averageExitPrice(list);
  const last = list[list.length - 1].price;
  const entry = trade?.entry_price;
  const size = isNum(trade?.size) ? Math.abs(trade.size) : 0;
  if (avg === null || !isNum(entry) || !isNum(last) || size <= 0) return empty;

  // Per-unit moves. The unit value cancels out of the comparison, so this is
  // expressed in price terms scaled by size -- directly comparable to itself,
  // which is all the verdict needs.
  const dir = trade.direction === 'BUY' ? 1 : -1;
  const realisedPerUnit = (avg - entry) * dir;
  const heldPerUnit = (last - entry) * dir;

  const realised = isNum(trade.pnl) ? trade.pnl : null;
  // Scale the hypothetical by the ratio between the two per-unit moves so the
  // comparison stays in the trade's own currency rather than raw price points.
  const heldToLast =
    realised !== null && Math.abs(realisedPerUnit) > 1e-9
      ? round2(realised * (heldPerUnit / realisedPerUnit))
      : null;

  return {
    exits: list.length,
    averagePrice: avg,
    heldToLastPnl: heldToLast,
    realisedPnl: realised,
    scaleOutEdge: heldToLast !== null && realised !== null ? round2(heldToLast - realised) : null,
  };
}
