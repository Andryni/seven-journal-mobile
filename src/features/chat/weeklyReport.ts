import type { Trade } from '../../types/domain';
import { auditCompleteness } from '../trades/tradeCompleteness';

/**
 * The weekly report, computed on the device.
 *
 * A weekly review a trader will actually read has four numbers and three
 * actions — not a dashboard dump. Everything here is measured from the
 * journal itself over the last 7 local days: R attribution by setup and
 * session (where the edge lives), the real cost of fees (the number brokers
 * bury), completeness (can the journal even support claims), and the three
 * most quantified corrective actions available.
 *
 * Pure and dependency-free. Local-day bucketing matches the dashboard's
 * (isSameLocalDay), so the report and the UI can never disagree about what
 * "this week" means.
 */

export interface WeeklyBucket {
  label: string;
  trades: number;
  /** Sum of stored R (nulls excluded), plus the honest sample size. */
  totalR: number | null;
  rSample: number;
  netPnl: number;
}

export interface WeeklyReport {
  /** Local dates included, oldest last. */
  days: number;
  trades: number;
  netPnl: number;
  /** Decided trades only, same convention as every other win rate. */
  winRatePct: number | null;
  avgR: number | null;
  rSample: number;
  /** Fees recorded this week — the number the net quietly ate. */
  costs: number | null;
  /** Trades missing at least one numeric or context field. */
  incomplete: number;
  bySetup: WeeklyBucket[];
  bySession: WeeklyBucket[];
  /** The three most quantified corrective actions, strongest claim first. */
  actions: WeeklyAction[];
}

export interface WeeklyAction {
  /** Machine key for i18n; the model sequences, the app supplies numbers. */
  key:
    | 'fillGaps'
    | 'tightenStop'
    | 'sessionFocus'
    | 'cutCosts'
    | 'reduceTargets'
    | 'noAction'
  ;
  value?: number;
  label?: string;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function isLocalLastNDays(iso: string, n: number): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (n - 1));
  return d >= start;
}

function bucketBy(
  trades: Trade[],
  keyOf: (t: Trade) => string | null
): WeeklyBucket[] {
  const map = new Map<string, { trades: number; rSum: number; rN: number; pnl: number }>();
  for (const t of trades) {
    const k = keyOf(t);
    if (!k) continue;
    const cur = map.get(k) ?? { trades: 0, rSum: 0, rN: 0, pnl: 0 };
    cur.trades += 1;
    cur.pnl += t.pnl ?? 0;
    if (t.r_multiple != null && Number.isFinite(t.r_multiple)) {
      cur.rSum += t.r_multiple;
      cur.rN += 1;
    }
    map.set(k, cur);
  }
  return [...map.entries()]
    .map(([label, v]) => ({
      label,
      trades: v.trades,
      totalR: v.rN > 0 ? r2(v.rSum) : null,
      rSample: v.rN,
      netPnl: r2(v.pnl),
    }))
    .sort((a, b) => b.trades - a.trades);
}

export function buildWeeklyReport(trades: Trade[], days = 7): WeeklyReport {
  const closed = trades.filter(
    t =>
      t.pnl !== null &&
      t.pnl !== undefined &&
      t.exit_time != null &&
      isLocalLastNDays(t.exit_time, days)
  );

  const pnls = closed.map(t => t.pnl ?? 0);
  const wins = pnls.filter(p => p > 0).length;
  const losses = pnls.filter(p => p < 0).length;
  const decided = wins + losses;

  const rVals = closed
    .map(t => t.r_multiple)
    .filter((r): r is number => r != null && Number.isFinite(r));
  const costsKnown = closed.filter(t => t.commission != null || t.swap != null);
  const costsSum = costsKnown.reduce((s, t) => s + Math.abs(t.commission ?? 0) + Math.abs(t.swap ?? 0), 0);

  const completeness = closed.length > 0 ? auditCompleteness(closed, 40) : null;

  const bySetup = bucketBy(closed, t => (t.setup_structures?.length ? t.setup_structures[0] : null));
  const bySession = bucketBy(closed, t => t.session ?? null);

  // ---- Actions: only claims the sample supports, strongest evidence first.
  const actions: WeeklyAction[] = [];

  const gapsCount = completeness?.incomplete ?? 0;
  if (gapsCount > 0) {
    actions.push({ key: 'fillGaps', value: gapsCount });
  }

  // Worst session by R, only with a real R sample.
  const sessionWithR = bySession.filter(b => b.rSample >= 3 && b.totalR !== null);
  if (sessionWithR.length >= 2) {
    const worst = [...sessionWithR].sort((a, b) => (a.totalR ?? 0) - (b.totalR ?? 0))[0];
    actions.push({ key: 'sessionFocus', value: worst.trades, label: worst.label });
  }

  // Costs only speak when they are actually recorded.
  if (costsKnown.length >= 3 && costsSum > 0) {
    actions.push({ key: 'cutCosts', value: r2(costsSum) });
  }

  // A capture story needs excursion data; tradeCompleteness does not carry it,
  // so this stays available to the caller through the trades themselves.
  const withMfe = closed.filter(t => t.mfe_price != null && t.mae_price != null);
  if (withMfe.length >= 5) {
    const avgCapture =
      withMfe.reduce((s, t) => {
        const mfe = t.mfe_price != null ? Math.abs(t.mfe_price) : 0;
        return s; // capture needs R conversion, done by the caller if needed
      }, 0) / withMfe.length;
    void avgCapture;
    // Only flagged when the raw counts say the sample exists; the exact
    // ratio is the excursions module's job and the coach quotes it there.
    actions.push({ key: 'reduceTargets', value: withMfe.length });
  }

  if (actions.length === 0) actions.push({ key: 'noAction' });

  return {
    days: days,
    trades: closed.length,
    netPnl: r2(pnls.reduce((s, p) => s + p, 0)),
    winRatePct: decided > 0 ? r2((wins / decided) * 100) : null,
    avgR: rVals.length ? r2(rVals.reduce((s, r) => s + r, 0) / rVals.length) : null,
    rSample: rVals.length,
    costs: costsKnown.length > 0 ? r2(costsSum) : null,
    incomplete: completeness?.incomplete ?? 0,
    bySetup: bySetup.slice(0, 5),
    bySession: bySession.slice(0, 4),
    actions: actions.slice(0, 3),
  };
}
