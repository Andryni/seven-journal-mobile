import type { Trade } from '../types/domain';
import { tagsOf } from './tradeTags';

/**
 * The twin trade.
 *
 * At entry time — not in a weekly retrospective — show what happened the last
 * times the trader took (nearly) this same trade. The journal stops being an
 * archive and becomes a guard rail at the moment of decision: "your last 7
 * XAUUSD revenge trades on Fridays: -4.2R".
 *
 * Similarity is a graded score, not a binary match, because exact context
 * repeats are rare. Dimensions, by weight:
 *   pair (locked, never scored: a twin of another instrument is not a twin)
 *   direction + session + timeframe + mental state: 1 point each
 *   shared free tags: 1 point per tag, capped at 2
 *   setup_structures intersection: 1 point per shared structure, capped at 2
 *
 * `minScore` keeps "3 half-matching trades" from presenting noise as a
 * pattern; the aggregation drops below-sample groups entirely.
 */

export interface TwinCriteria {
  pair: string;
  direction?: 'BUY' | 'SELL' | null;
  session?: string | null;
  timeframe?: string | null;
  mentalState?: string | null;
  tags?: string[];
  setupStructures?: string[];
}

export interface TwinAggregate {
  /** Trades considered similar enough to aggregate. */
  count: number;
  /** Closed among those; the others have no result yet. */
  closed: number;
  wins: number;
  losses: number;
  /** Net P&L of the closed twins. */
  totalPnl: number;
  /** Sum of R over the closed twins that have an R multiple. */
  totalR: number;
  rCount: number;
  winRate: number | null;
  /** Mean R, null when no twin carries one. */
  avgR: number | null;
  /** The closed twins themselves, most recent first. */
  trades: Trade[];
}

/** A candidate must reach this fraction of the score its criteria allow. */
const MATCH_THRESHOLD = 0.5;

/**
 * The highest score these criteria could possibly award.
 *
 * This has to be derived, not fixed. The old code compared against a constant
 * `DIMENSIONS = 5` while the real ceiling is 8 (direction, session, timeframe
 * and mental state at 1 each, plus 2 for tags and 2 for setups), which broke
 * the rule at both ends:
 *
 *   - Fully specified criteria: the bar sat at 3/8, so a trade sharing three
 *     tags and nothing else -- different direction, different session --
 *     was presented as a twin at the moment of decision.
 *   - Sparse criteria: a form with only a pair and a direction tops out at 1,
 *     so a fixed bar of 3 could never be cleared and the panel stayed empty
 *     however much history existed.
 *
 * Scoring against what was actually asked for keeps "half a match" meaning
 * the same thing whether the trader filled in two fields or all of them.
 */
export function maxTwinScore(criteria: TwinCriteria): number {
  let max = 0;
  if (criteria.direction) max += 1;
  if (criteria.session) max += 1;
  if (criteria.timeframe) max += 1;
  if (criteria.mentalState) max += 1;
  max += Math.min(criteria.tags?.length ?? 0, 2);
  max += Math.min(criteria.setupStructures?.length ?? 0, 2);
  return max;
}

export function twinScore(trade: Trade, criteria: TwinCriteria): number {
  if ((trade.pair ?? '').toUpperCase() !== (criteria.pair ?? '').toUpperCase()) {
    return 0;
  }
  let score = 0;
  if (criteria.direction && trade.direction === criteria.direction) score += 1;
  if (criteria.session && (trade.session ?? '') === criteria.session) score += 1;
  if (criteria.timeframe && (trade.timeframe ?? '') === criteria.timeframe) score += 1;
  if (criteria.mentalState && (trade.mental_state ?? '') === criteria.mentalState) score += 1;

  const sharedTags = criteria.tags?.filter(tag => tagsOf(trade).includes(tag)).length ?? 0;
  score += Math.min(sharedTags, 2);

  const own = new Set((trade.setup_structures ?? []).map(s => String(s)));
  const sharedStructures =
    criteria.setupStructures?.filter(s => own.has(String(s))).length ?? 0;
  score += Math.min(sharedStructures, 2);

  return score;
}

/**
 * Closest past twins for a set of criteria, most similar first.
 * Only CLOSED trades are returned — an open position has nothing to teach
 * yet — and the trade currently being edited is excluded by the caller.
 */
export function findTwinTrades(
  history: Trade[],
  criteria: TwinCriteria,
  minScore?: number
): Trade[] {
  if (!criteria.pair) return [];

  /**
   * With nothing but a pair to go on there is no context to match, so every
   * past trade on the instrument would score 0 and qualify. That is a
   * "trades on XAUUSD" list, not a twin: say nothing instead.
   */
  const max = maxTwinScore(criteria);
  if (max === 0) return [];

  const bar = minScore ?? Math.max(1, Math.ceil(max * MATCH_THRESHOLD));
  return history
    .map(t => ({ t, score: twinScore(t, criteria) }))
    .filter(({ t, score }) => score >= bar && t.pnl !== null && t.pnl !== undefined)
    .sort((a, b) => b.score - a.score || (a.t.entry_time < b.t.entry_time ? 1 : -1))
    .map(({ t }) => t);
}

/** Aggregate the twins into the three numbers the form can say in one line. */
export function aggregateTwins(twins: Trade[]): TwinAggregate {
  const closed = twins.length;
  const wins = twins.filter(t => (t.pnl ?? 0) > 0).length;
  const losses = twins.filter(t => (t.pnl ?? 0) < 0).length;
  const totalPnl = twins.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const rs = twins
    .map(t => t.r_multiple)
    .filter((r): r is number => r !== null && r !== undefined && Number.isFinite(r));
  const totalR = rs.reduce((a, b) => a + b, 0);

  return {
    count: twins.length,
    closed,
    wins,
    losses,
    totalPnl,
    totalR,
    rCount: rs.length,
    winRate: closed > 0 ? Math.round((wins / closed) * 100) : null,
    avgR: rs.length > 0 ? Math.round((totalR / rs.length) * 100) / 100 : null,
    trades: twins,
  };
}

/** True when the aggregate says something worth reading (≥ MIN sample). */
export const MIN_TWIN_SAMPLE = 3;

export function isTwinSignificant(a: TwinAggregate): boolean {
  return a.closed >= MIN_TWIN_SAMPLE;
}
