import type { Trade } from '../../types/domain';
import { localDayKey } from '../../utils/formatDate';

/**
 * Journal insight engine — statistics, not a language model.
 *
 * Most of what trading apps sell as "AI" is descriptive statistics over data
 * the journal already holds. Doing it this way is deterministic, free, works
 * offline, and above all is unit-testable: an insight that tells a trader to
 * stop trading Tuesdays had better be reproducible.
 *
 * The hard part is not computing the numbers, it is refusing to report them.
 * With 8 trades every pattern looks significant, so every rule here declares a
 * minimum sample and a minimum effect size, and stays silent below either.
 * A journal that cries wolf on noise gets ignored within a week.
 */

export type InsightId =
  | 'revenge-trading'
  | 'size-escalation'
  | 'losing-hour'
  | 'losing-weekday'
  | 'off-plan'
  | 'no-stop'
  | 'tilt-state'
  | 'overtrading-day'
  | 'best-setup';

export type InsightSeverity = 'critical' | 'warning' | 'good';

export interface Insight {
  id: InsightId;
  severity: InsightSeverity;
  /** i18n key for the headline. */
  titleKey: string;
  /** Interpolation values, already rounded for display. */
  params: Record<string, string | number>;
  /** Trades the finding is based on — lets the UI show the evidence. */
  sampleSize: number;
  /** Currency impact, when the rule can attribute one. Negative = cost. */
  impact: number | null;
}

/** Minimum closed trades before the engine says anything at all. */
export const MIN_TRADES_FOR_INSIGHTS = 20;

/** Per-bucket minimum before a bucket-level claim is allowed. */
const MIN_BUCKET = 5;

const TILT_STATES = ['revenge', 'fomo', 'greedy'];

const closedOnly = (trades: Trade[]) => trades.filter(t => t.pnl !== null);

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const mean = (xs: number[]) => (xs.length ? sum(xs) / xs.length : 0);

function round(n: number, dp = 2): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Trades sorted oldest-first, which sequence-based rules depend on. */
function chronological(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
}

/**
 * Revenge trading: a position opened soon after a loss.
 *
 * Measured against the trader's own baseline rather than an absolute rule --
 * the claim is only made when those trades actually perform worse.
 */
function revengeTrading(trades: Trade[]): Insight | null {
  const seq = chronological(trades);
  const WINDOW_MS = 30 * 60 * 1000;

  const revenge: Trade[] = [];
  const normal: Trade[] = [];

  for (let i = 1; i < seq.length; i++) {
    const prev = seq[i - 1];
    const cur = seq[i];
    const gap = new Date(cur.entry_time).getTime() - new Date(prev.exit_time ?? prev.entry_time).getTime();
    if ((prev.pnl ?? 0) < 0 && gap >= 0 && gap <= WINDOW_MS) revenge.push(cur);
    else normal.push(cur);
  }

  if (revenge.length < MIN_BUCKET) return null;

  const revengeAvg = mean(revenge.map(t => t.pnl ?? 0));
  const normalAvg = mean(normal.map(t => t.pnl ?? 0));

  // Only worth saying if the quick re-entries are genuinely worse.
  if (revengeAvg >= normalAvg) return null;

  return {
    id: 'revenge-trading',
    severity: 'critical',
    titleKey: 'insightRevenge',
    params: {
      count: revenge.length,
      avg: round(revengeAvg, 0),
      normal: round(normalAvg, 0),
    },
    sampleSize: revenge.length,
    impact: round(sum(revenge.map(t => t.pnl ?? 0)), 2),
  };
}

/**
 * Size escalation: positions grow after a loss.
 *
 * Classic martingale behaviour, and the fastest route to breaching a drawdown
 * limit. Compares size after a losing trade to size after a winning one.
 */
function sizeEscalation(trades: Trade[]): Insight | null {
  const seq = chronological(trades).filter(t => (t.size ?? 0) > 0);

  const afterLoss: number[] = [];
  const afterWin: number[] = [];

  for (let i = 1; i < seq.length; i++) {
    const prevPnl = seq[i - 1].pnl ?? 0;
    if (prevPnl < 0) afterLoss.push(seq[i].size);
    else if (prevPnl > 0) afterWin.push(seq[i].size);
  }

  if (afterLoss.length < MIN_BUCKET || afterWin.length < MIN_BUCKET) return null;

  const lossAvg = mean(afterLoss);
  const winAvg = mean(afterWin);
  if (winAvg <= 0) return null;

  const increase = ((lossAvg - winAvg) / winAvg) * 100;
  // 25% is well beyond rounding noise in lot sizing.
  if (increase < 25) return null;

  return {
    id: 'size-escalation',
    severity: 'critical',
    titleKey: 'insightSizeEscalation',
    params: { pct: round(increase, 0) },
    sampleSize: afterLoss.length,
    impact: null,
  };
}

/** The single hour of the day that bleeds, if one clearly does. */
function losingHour(trades: Trade[]): Insight | null {
  const buckets = new Map<number, number[]>();
  for (const t of trades) {
    const h = new Date(t.entry_time).getHours();
    if (!buckets.has(h)) buckets.set(h, []);
    buckets.get(h)!.push(t.pnl ?? 0);
  }

  let worst: { hour: number; total: number; n: number } | null = null;
  for (const [hour, pnls] of buckets) {
    if (pnls.length < MIN_BUCKET) continue;
    const total = sum(pnls);
    if (total >= 0) continue;
    if (!worst || total < worst.total) worst = { hour, total, n: pnls.length };
  }

  if (!worst) return null;

  const overall = sum(trades.map(t => t.pnl ?? 0));
  // Ignore an hour that is merely proportionally bad in an already bad book;
  // the point is to isolate a hour that stands out.
  if (overall < 0 && worst.total > overall * 0.4) return null;

  return {
    id: 'losing-hour',
    severity: 'warning',
    titleKey: 'insightLosingHour',
    params: { hour: worst.hour, total: round(worst.total, 0), count: worst.n },
    sampleSize: worst.n,
    impact: round(worst.total, 2),
  };
}

/** Weekday with a materially negative expectancy. */
function losingWeekday(trades: Trade[]): Insight | null {
  const buckets = new Map<number, number[]>();
  for (const t of trades) {
    const d = new Date(t.entry_time).getDay();
    if (!buckets.has(d)) buckets.set(d, []);
    buckets.get(d)!.push(t.pnl ?? 0);
  }

  let worst: { day: number; total: number; n: number } | null = null;
  for (const [day, pnls] of buckets) {
    if (pnls.length < MIN_BUCKET) continue;
    const total = sum(pnls);
    if (total >= 0) continue;
    if (!worst || total < worst.total) worst = { day, total, n: pnls.length };
  }

  if (!worst) return null;

  return {
    id: 'losing-weekday',
    severity: 'warning',
    titleKey: 'insightLosingWeekday',
    params: { day: worst.day, total: round(worst.total, 0), count: worst.n },
    sampleSize: worst.n,
    impact: round(worst.total, 2),
  };
}

/** Trades taken without a playbook setup, and what they cost. */
function offPlan(trades: Trade[]): Insight | null {
  const off = trades.filter(
    t => !t.setup_structures?.length && !t.setup_fvg && !t.setup_ob && !t.setup_liquidity_sweep
  );
  if (off.length < MIN_BUCKET) return null;

  const share = (off.length / trades.length) * 100;
  if (share < 20) return null;

  const total = sum(off.map(t => t.pnl ?? 0));

  return {
    id: 'off-plan',
    severity: total < 0 ? 'critical' : 'warning',
    titleKey: 'insightOffPlan',
    params: { pct: round(share, 0), count: off.length, total: round(total, 0) },
    sampleSize: off.length,
    impact: round(total, 2),
  };
}

/** Positions entered with no stop loss recorded. */
function noStop(trades: Trade[]): Insight | null {
  const naked = trades.filter(t => !t.stop_loss || t.stop_loss <= 0);
  if (naked.length === 0) return null;

  const share = (naked.length / trades.length) * 100;

  return {
    id: 'no-stop',
    severity: 'critical',
    titleKey: 'insightNoStop',
    params: { count: naked.length, pct: round(share, 0) },
    sampleSize: naked.length,
    impact: round(sum(naked.map(t => t.pnl ?? 0)), 2),
  };
}

/** Performance while tilted, versus focused. */
function tiltState(trades: Trade[]): Insight | null {
  const tilted = trades.filter(t => TILT_STATES.includes(t.mental_state));
  if (tilted.length < MIN_BUCKET) return null;

  const calm = trades.filter(t => !TILT_STATES.includes(t.mental_state));
  if (calm.length < MIN_BUCKET) return null;

  const tiltedAvg = mean(tilted.map(t => t.pnl ?? 0));
  const calmAvg = mean(calm.map(t => t.pnl ?? 0));
  if (tiltedAvg >= calmAvg) return null;

  return {
    id: 'tilt-state',
    severity: 'warning',
    titleKey: 'insightTilt',
    params: {
      count: tilted.length,
      avg: round(tiltedAvg, 0),
      calm: round(calmAvg, 0),
    },
    sampleSize: tilted.length,
    impact: round(sum(tilted.map(t => t.pnl ?? 0)), 2),
  };
}

/** Days with an unusually high trade count, and whether they pay. */
function overtradingDay(trades: Trade[]): Insight | null {
  const byDay = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = localDayKey(new Date(t.entry_time));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(t);
  }
  if (byDay.size < MIN_BUCKET) return null;

  const counts = [...byDay.values()].map(v => v.length);
  const avgCount = mean(counts);
  const busy = [...byDay.values()].filter(v => v.length >= Math.max(avgCount * 2, 4));
  if (busy.length < 2) return null;

  const busyPnl = sum(busy.flatMap(v => v.map(t => t.pnl ?? 0)));
  if (busyPnl >= 0) return null;

  return {
    id: 'overtrading-day',
    severity: 'warning',
    titleKey: 'insightOvertrading',
    params: {
      days: busy.length,
      avg: round(avgCount, 1),
      total: round(busyPnl, 0),
    },
    sampleSize: busy.reduce((n, v) => n + v.length, 0),
    impact: round(busyPnl, 2),
  };
}

/** The setup that actually earns, so the report is not purely negative. */
function bestSetup(trades: Trade[]): Insight | null {
  const buckets = new Map<string, number[]>();
  for (const t of trades) {
    for (const s of t.setup_structures ?? []) {
      const key = s.trim();
      if (!key) continue;
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(t.pnl ?? 0);
    }
  }

  let best: { key: string; total: number; n: number; wr: number } | null = null;
  for (const [key, pnls] of buckets) {
    if (pnls.length < MIN_BUCKET) continue;
    const total = sum(pnls);
    if (total <= 0) continue;
    const wr = (pnls.filter(p => p > 0).length / pnls.length) * 100;
    if (!best || total > best.total) best = { key, total, n: pnls.length, wr };
  }

  if (!best) return null;

  return {
    id: 'best-setup',
    severity: 'good',
    titleKey: 'insightBestSetup',
    params: {
      setup: best.key,
      total: round(best.total, 0),
      wr: round(best.wr, 0),
      count: best.n,
    },
    sampleSize: best.n,
    impact: round(best.total, 2),
  };
}

const RULES = [
  noStop,
  revengeTrading,
  sizeEscalation,
  offPlan,
  tiltState,
  losingHour,
  losingWeekday,
  overtradingDay,
  bestSetup,
];

const SEVERITY_ORDER: Record<InsightSeverity, number> = {
  critical: 0,
  warning: 1,
  good: 2,
};

export interface InsightsResult {
  /** False when there is not enough history to say anything honestly. */
  hasEnoughData: boolean;
  tradesAnalysed: number;
  insights: Insight[];
}

/**
 * Run every rule over the closed trades of one account.
 *
 * Pure and synchronous: no network, no model, no key. Callers pass already
 * account-scoped trades (see features/accounts/accountScope).
 */
export function computeInsights(trades: Trade[]): InsightsResult {
  const closed = closedOnly(trades);

  if (closed.length < MIN_TRADES_FOR_INSIGHTS) {
    return { hasEnoughData: false, tradesAnalysed: closed.length, insights: [] };
  }

  const insights = RULES.map(rule => rule(closed)).filter((x): x is Insight => x !== null);

  insights.sort((a, b) => {
    const s = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (s !== 0) return s;
    // Within a severity, lead with the most expensive finding.
    return Math.abs(b.impact ?? 0) - Math.abs(a.impact ?? 0);
  });

  return { hasEnoughData: true, tradesAnalysed: closed.length, insights };
}
