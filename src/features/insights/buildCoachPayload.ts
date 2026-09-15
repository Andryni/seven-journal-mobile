import { computeInsights, MIN_TRADES_FOR_INSIGHTS } from './computeInsights';
import type { Insight } from './computeInsights';
import type { Trade } from '../../types/domain';

/**
 * Builds the payload sent to the AI coach Edge Function.
 *
 * This is the privacy boundary of the feature, so it is a pure function with
 * tests rather than an object literal built inline at the call site: what
 * leaves the device must be reviewable in one place.
 *
 * What is sent: the findings the local engine already computed, plus coarse
 * aggregates. What is never sent: individual trades, prices, timestamps,
 * account balances, account names, instruments, or the user's notes -- notes
 * in particular are free text and routinely contain personal information.
 *
 * Money is normalized to R-multiples and percentages before leaving. The
 * coach can say "your losses on fast re-entries cost 2.4R" without ever
 * learning whether the account holds 500 or 500,000.
 */

export interface CoachFinding {
  id: string;
  severity: Insight['severity'];
  /**
   * The finding's cost or gain as a percentage of the book's total P&L
   * volume. Deliberately relative: the engine's own impact field is a raw
   * currency amount, and forwarding it would disclose account size.
   */
  impactPct: number | null;
  sampleSize: number;
}

export interface CoachPayload {
  /** Schema version, so the Edge Function can reject payloads it cannot read. */
  v: 1;
  locale: string;
  tradesAnalysed: number;
  winRate: number;
  /** Average R per trade. Null when too few trades carry a stop loss. */
  avgR: number | null;
  /** Share of trades that respected the plan, as a percentage. */
  planAdherence: number;
  profitFactor: number | null;
  findings: CoachFinding[];
}

/** Rounds to two decimals, keeping payloads small and non-identifying. */
const r2 = (n: number) => Math.round(n * 100) / 100;

export function buildCoachPayload(
  trades: Trade[],
  locale: string,
  playbookTitles: string[] = []
): CoachPayload | null {
  const closed = trades.filter(t => t.pnl !== null);
  // Below the local engine's threshold there is nothing worth asking about,
  // and we do not send data just to receive a hedge.
  if (closed.length < MIN_TRADES_FOR_INSIGHTS) return null;

  const { insights, tradesAnalysed } = computeInsights(trades, playbookTitles);

  const wins = closed.filter(t => (t.pnl as number) > 0);
  const grossWin = wins.reduce((s, t) => s + (t.pnl as number), 0);
  const grossLoss = closed
    .filter(t => (t.pnl as number) < 0)
    .reduce((s, t) => s + Math.abs(t.pnl as number), 0);

  // Total P&L volume, used to express every impact as a share rather than in
  // the account's currency.
  const pnlVolume = grossWin + grossLoss;

  const withR = closed.filter(t => t.r_multiple !== null);
  const onPlan = closed.filter(t => t.rule_40_percent !== true);

  return {
    v: 1,
    locale,
    tradesAnalysed,
    winRate: r2((wins.length / closed.length) * 100),
    avgR:
      withR.length >= 5
        ? r2(withR.reduce((s, t) => s + (t.r_multiple as number), 0) / withR.length)
        : null,
    planAdherence: r2((onPlan.length / closed.length) * 100),
    profitFactor: grossLoss > 0 ? r2(grossWin / grossLoss) : null,
    findings: insights.map(i => ({
      id: i.id,
      severity: i.severity,
      impactPct:
        i.impact !== null && pnlVolume > 0 ? r2((i.impact / pnlVolume) * 100) : null,
      sampleSize: i.sampleSize,
    })),
  };
}
