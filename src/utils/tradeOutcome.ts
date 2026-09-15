import type { Trade } from '../types/domain';

/**
 * Trade outcome: how a position was exited, kept separate from what it earned.
 *
 * The app conflated the two. `result` is an EXIT REASON -- price reached the
 * take profit, price reached the stop, the position was closed at entry -- but
 * it was being derived from the P&L sign:
 *
 *     if (pnl > 0) result = 'TP';        // importParsers.ts
 *
 * So a trade moved to breakeven that still banked +0.5R (partials taken, or a
 * stop trailed above entry) was filed as "TP", claiming the target was hit
 * when it never was. The reverse happened too: a manual exit for a small gain
 * became "TP", inflating the apparent hit rate of every setup.
 *
 * Worse, the form FORCED `r = 0` whenever the user picked BE, silently
 * overwriting a real, positive R the user had just earned.
 *
 * The two concepts are now distinct:
 *   - `result`  — why the position closed (exit reason). User-owned.
 *   - `pnl`     — what it earned. Drives every statistic.
 *
 * Statistics already classify by `pnl` sign everywhere, which is correct and
 * unchanged. This module exists so the UI stops mislabelling the exit reason,
 * and so a "BE" exit can honestly carry a non-zero result.
 */

export type ExitReason = 'TP' | 'SL' | 'BE' | 'MANUAL' | 'OPEN';

/**
 * Suggests an exit reason from prices, for imports where the broker report
 * only gives us numbers. Deliberately conservative: it only claims TP or SL
 * when the exit price actually reached that level.
 *
 * `tolerance` is a fraction of the stop distance (default 2%), absorbing
 * slippage and spread so a fill one tick past the target still counts.
 */
export function inferExitReason(params: {
  direction: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  closed: boolean;
  tolerance?: number;
}): ExitReason {
  const {
    direction,
    entryPrice,
    exitPrice,
    stopLoss,
    takeProfit,
    closed,
    tolerance = 0.02,
  } = params;

  if (!closed || exitPrice === null || !Number.isFinite(exitPrice)) return 'OPEN';

  const hasSl = stopLoss !== null && Number.isFinite(stopLoss) && stopLoss > 0;
  const slDist = hasSl ? Math.abs(entryPrice - (stopLoss as number)) : 0;
  // Without a stop we have no natural scale for "close enough"; fall back to a
  // small fraction of price rather than inventing a risk distance.
  const tol = (slDist > 0 ? slDist : Math.abs(entryPrice) * 0.001) * tolerance;

  const hasTp = takeProfit !== null && Number.isFinite(takeProfit) && takeProfit > 0;

  if (hasTp) {
    const reached =
      direction === 'BUY'
        ? exitPrice >= (takeProfit as number) - tol
        : exitPrice <= (takeProfit as number) + tol;
    if (reached) return 'TP';
  }

  if (hasSl) {
    const reached =
      direction === 'BUY'
        ? exitPrice <= (stopLoss as number) + tol
        : exitPrice >= (stopLoss as number) - tol;
    if (reached) return 'SL';
  }

  // Exited at (or within a hair of) the entry price: a genuine breakeven exit,
  // whatever the resulting P&L after partials and fees.
  if (Math.abs(exitPrice - entryPrice) <= tol) return 'BE';

  return 'MANUAL';
}

/**
 * Financial classification, which is what every statistic uses. Independent of
 * the exit reason on purpose: a BE exit can be a small win or a small loss.
 */
export type PnlClass = 'win' | 'loss' | 'flat' | 'open';

export function classifyPnl(pnl: number | null | undefined): PnlClass {
  if (pnl === null || pnl === undefined || !Number.isFinite(pnl)) return 'open';
  if (pnl > 0) return 'win';
  if (pnl < 0) return 'loss';
  return 'flat';
}

/**
 * True when the stated exit reason contradicts the money.
 *
 * Surfacing this rather than silently "fixing" it matters: a BE exit that
 * earned +0.5R is perfectly legitimate (partials, trailed stop) and must not
 * be rewritten to TP. But "TP" on a losing trade is a data-entry error worth
 * flagging back to the user.
 */
export function isOutcomeInconsistent(result: string, pnl: number | null): boolean {
  if (pnl === null) return result !== 'OPEN';
  if (result === 'TP') return pnl < 0;
  if (result === 'SL') return pnl > 0;
  return false;
}

/** Colour intent for a result badge — driven by money, not by the label. */
export function outcomeVariant(trade: Pick<Trade, 'result' | 'pnl'>): 'green' | 'red' | 'neutral' {
  const klass = classifyPnl(trade.pnl);
  if (klass === 'win') return 'green';
  if (klass === 'loss') return 'red';
  return 'neutral';
}
