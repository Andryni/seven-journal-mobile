import type { Trade } from '../types/domain';

/**
 * MAE / MFE — how far a trade went against you, and how far in your favour,
 * before it closed.
 *
 * Why this is worth a module: the journal records where a trade started and
 * where it ended, and nothing about the path between. That path is where the
 * two most expensive habits hide.
 *
 *   - A winner that first ran 0.9R against you was nearly a loser. It is
 *     recorded as a clean win, so the entry timing never gets questioned.
 *   - A winner that ran +3R before closing at +1R left 2R on the table. The
 *     journal calls that a success, so the target never gets questioned.
 *
 * Neither shows up anywhere in a P&L-based statistic. Both are visible the
 * moment excursions are recorded.
 *
 * CONVENTIONS, deliberately narrow so nothing downstream has to guess:
 *   - Storage is PRICE, because that is what the user reads off a chart and
 *     because every derived figure can be recomputed from it.
 *   - MAE is the worst price against the position, MFE the best in favour.
 *     "Worst" flips meaning with direction, which is handled here once.
 *   - Excursions are expressed in R against the trade's ORIGINAL risk
 *     (|entry - stop|), so they stay comparable across instruments.
 *   - Every function returns null rather than a plausible-looking 0 when the
 *     inputs are missing or incoherent. A fabricated 0 would read as "this
 *     trade never went against me", which is the opposite of unknown.
 */

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Risk per unit: distance from entry to stop. Null when there is no real stop. */
export function riskPerUnit(
  trade: Pick<Trade, 'entry_price' | 'stop_loss'>
): number | null {
  if (!isNum(trade.entry_price) || !isNum(trade.stop_loss)) return null;
  const risk = Math.abs(trade.entry_price - trade.stop_loss);
  // stop_loss defaults to 0 in the schema, which means "no stop set" rather
  // than "stop at price zero". Treating that as risk would produce enormous
  // fake R values, so it is rejected.
  if (risk === 0 || trade.stop_loss === 0) return null;
  return risk;
}

/** True when the trade carries any recorded excursion. */
export function hasExcursions(
  trade: Pick<Trade, 'mae_price' | 'mfe_price'>
): boolean {
  return isNum(trade.mae_price) || isNum(trade.mfe_price);
}

/**
 * Adverse excursion in R: how deep the trade went underwater, as a positive
 * number. 0.9 means it came within a whisker of the stop.
 */
export function maeR(trade: Trade): number | null {
  const risk = riskPerUnit(trade);
  if (risk === null || !isNum(trade.mae_price)) return null;

  // Distance from entry in the losing direction.
  const adverse =
    trade.direction === 'BUY'
      ? trade.entry_price - trade.mae_price
      : trade.mae_price - trade.entry_price;

  // A "worst price" better than entry means the trade never went underwater.
  // That is legitimate (a runner that never pulled back), so it clamps to 0
  // rather than returning a negative excursion.
  return round2(Math.max(0, adverse) / risk);
}

/** Favourable excursion in R: the best unrealised gain the trade ever showed. */
export function mfeR(trade: Trade): number | null {
  const risk = riskPerUnit(trade);
  if (risk === null || !isNum(trade.mfe_price)) return null;

  const favourable =
    trade.direction === 'BUY'
      ? trade.mfe_price - trade.entry_price
      : trade.entry_price - trade.mfe_price;

  return round2(Math.max(0, favourable) / risk);
}

/** Realised result in R, derived from prices rather than the stored r_multiple. */
export function realisedR(trade: Trade): number | null {
  const risk = riskPerUnit(trade);
  if (risk === null || !isNum(trade.exit_price)) return null;

  const moved =
    trade.direction === 'BUY'
      ? trade.exit_price - trade.entry_price
      : trade.entry_price - trade.exit_price;

  return round2(moved / risk);
}

/**
 * Capture ratio: the share of the maximum available move that was actually
 * taken, 0..1. 0.35 means two thirds of the move was handed back.
 *
 * Null when the trade never went favourable — there was nothing to capture,
 * and dividing by that would invent a ratio.
 */
export function captureRatio(trade: Trade): number | null {
  const mfe = mfeR(trade);
  const realised = realisedR(trade);
  if (mfe === null || realised === null) return null;
  if (mfe <= 0) return null;
  // Clamped: a realised result above MFE means the recorded excursion is
  // inconsistent, and a ratio above 1 would be nonsense to display.
  return round2(Math.min(1, Math.max(0, realised / mfe)));
}

/**
 * How much of the planned risk a trade actually consumed, 0..1+.
 * "Heat" in the risk-management sense.
 */
export function heat(trade: Trade): number | null {
  const mae = maeR(trade);
  return mae === null ? null : mae;
}

/** A winner that first came within `threshold` R of the stop. */
export function isNearMiss(trade: Trade, threshold = 0.8): boolean {
  const mae = maeR(trade);
  if (mae === null) return false;
  const won = (trade.pnl ?? 0) > 0;
  return won && mae >= threshold;
}

/** A trade that showed a real gain and still closed at a loss. */
export function isGiveBack(trade: Trade, minMfe = 1): boolean {
  const mfe = mfeR(trade);
  if (mfe === null) return false;
  const lost = (trade.pnl ?? 0) < 0;
  return lost && mfe >= minMfe;
}

export interface ExcursionSummary {
  /** Closed trades examined. */
  trades: number;
  /** How many carry usable excursion data. */
  tradesWithData: number;
  /** Mean MAE in R across trades that have it. Null when none do. */
  avgMae: number | null;
  /** Mean MFE in R. */
  avgMfe: number | null;
  /** Mean MAE of winning trades — how much heat a win typically survives. */
  avgMaeWinners: number | null;
  /** Mean MFE of losing trades — how much was on the table before it turned. */
  avgMfeLosers: number | null;
  /** Mean share of the available move actually captured, 0..1. */
  avgCapture: number | null;
  /** Winners that came within 0.8R of the stop. */
  nearMisses: number;
  /** Losers that were up 1R or more at some point. */
  giveBacks: number;
  /**
   * The MAE beyond which trades essentially stopped recovering, in R.
   * Actionable as a tighter stop: trades that went past it rarely came back.
   * Null when there is not enough data to claim it.
   */
  suggestedStopR: number | null;
  /** True when winners routinely give back most of their move. */
  targetsTooTight: boolean;
}

const EMPTY: ExcursionSummary = {
  trades: 0,
  tradesWithData: 0,
  avgMae: null,
  avgMfe: null,
  avgMaeWinners: null,
  avgMfeLosers: null,
  avgCapture: null,
  nearMisses: 0,
  giveBacks: 0,
  suggestedStopR: null,
  targetsTooTight: false,
};

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return round2(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Finds the smallest stop, in R, that would still have preserved (almost) every
 * winner. Trades whose MAE exceeded it were overwhelmingly losers, so cutting
 * there would have saved capital without costing wins.
 *
 * Returns null unless there is enough evidence, because advising a stop change
 * off three trades would be worse than saying nothing.
 */
function computeSuggestedStop(
  winnersMae: number[],
  losersMae: number[]
): number | null {
  if (winnersMae.length < 5 || losersMae.length < 5) return null;

  // The level that contains 95% of winners: tightening to it risks almost no
  // win. Rounded up to a readable 0.1R step.
  const sorted = [...winnersMae].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  const level = Math.ceil(sorted[idx] * 10) / 10;

  // Only worth suggesting if it is meaningfully tighter than the stop in use.
  if (level >= 0.95) return null;

  // And only if losers actually run past it, otherwise nothing is saved.
  const losersBeyond = losersMae.filter(m => m > level).length;
  if (losersBeyond / losersMae.length < 0.5) return null;

  return level;
}

/**
 * Aggregate excursion behaviour across a set of trades.
 * Open trades are ignored: their excursions are still moving.
 */
export function summarizeExcursions(trades: Trade[]): ExcursionSummary {
  const closed = (trades ?? []).filter(
    t => t && t.pnl !== null && t.pnl !== undefined && Number.isFinite(t.pnl)
  );
  if (closed.length === 0) return { ...EMPTY };

  const maes: number[] = [];
  const mfes: number[] = [];
  const maeWinners: number[] = [];
  const maeLosers: number[] = [];
  const mfeLosers: number[] = [];
  const captures: number[] = [];
  let tradesWithData = 0;
  let nearMisses = 0;
  let giveBacks = 0;

  for (const t of closed) {
    const mae = maeR(t);
    const mfe = mfeR(t);
    if (mae === null && mfe === null) continue;
    tradesWithData += 1;

    const won = (t.pnl ?? 0) > 0;
    if (mae !== null) {
      maes.push(mae);
      if (won) maeWinners.push(mae);
      else if ((t.pnl ?? 0) < 0) maeLosers.push(mae);
    }
    if (mfe !== null) {
      mfes.push(mfe);
      if ((t.pnl ?? 0) < 0) mfeLosers.push(mfe);
    }

    const cap = captureRatio(t);
    if (cap !== null && won) captures.push(cap);

    if (isNearMiss(t)) nearMisses += 1;
    if (isGiveBack(t)) giveBacks += 1;
  }

  const avgCapture = mean(captures);

  return {
    trades: closed.length,
    tradesWithData,
    avgMae: mean(maes),
    avgMfe: mean(mfes),
    avgMaeWinners: mean(maeWinners),
    avgMfeLosers: mean(mfeLosers),
    avgCapture,
    nearMisses,
    giveBacks,
    suggestedStopR: computeSuggestedStop(maeWinners, maeLosers),
    // Only claimed on a real sample: capturing under half the available move
    // across at least 5 winners is a target problem, not variance.
    targetsTooTight: avgCapture !== null && avgCapture < 0.5 && captures.length >= 5,
  };
}
