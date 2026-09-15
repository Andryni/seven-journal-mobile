import type { Trade } from '../../types/domain';

/**
 * Rolling history for each headline metric, so a KPI can show where it came
 * from and not just where it is.
 *
 * A win rate of 58% means something quite different when it was 72% a month
 * ago. The number alone hides that; a sparkline beside it does not.
 *
 * Each series is CUMULATIVE, recomputed after every closed trade: point i is
 * the metric as it stood over trades 0..i. That is the honest reading of "how
 * has this evolved" -- a rolling window would instead show local noise, and
 * would disagree with the headline figure, which is computed over everything.
 */

export interface MetricTrends {
  winRate: number[];
  profitFactor: number[];
  expectancy: number[];
  /** Positive magnitudes; the caller decides that bigger is worse. */
  drawdown: number[];
}

/** Below this, a sparkline is noise pretending to be a trend. */
export const MIN_POINTS_FOR_TREND = 4;

/** Caps the series so a 900-trade history still draws a readable line. */
const MAX_POINTS = 40;

/**
 * Evenly downsamples to at most MAX_POINTS, always keeping the final value:
 * the last point must match the headline number the sparkline sits beside.
 */
function downsample(series: number[]): number[] {
  if (series.length <= MAX_POINTS) return series;
  const step = (series.length - 1) / (MAX_POINTS - 1);
  const out: number[] = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    out.push(series[Math.round(i * step)]);
  }
  out[out.length - 1] = series[series.length - 1];
  return out;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeMetricTrends(trades: Trade[]): MetricTrends {
  const closed = trades
    .filter(t => t.pnl !== null)
    .sort((a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime());

  const empty: MetricTrends = { winRate: [], profitFactor: [], expectancy: [], drawdown: [] };
  if (closed.length < MIN_POINTS_FOR_TREND) return empty;

  const winRate: number[] = [];
  const profitFactor: number[] = [];
  const expectancy: number[] = [];
  const drawdown: number[] = [];

  let wins = 0;
  let grossWin = 0;
  let grossLoss = 0;
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;

  closed.forEach((t, i) => {
    const pnl = t.pnl as number;
    if (pnl > 0) {
      wins++;
      grossWin += pnl;
    } else if (pnl < 0) {
      grossLoss += Math.abs(pnl);
    }

    cumulative += pnl;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDd) maxDd = dd;

    const n = i + 1;
    winRate.push(round2((wins / n) * 100));
    // No losses yet means profit factor is undefined, not infinite. Plotting
    // Infinity breaks the scale and hides every other point, so the series
    // holds gross profit's shape until the first loss gives it a denominator.
    profitFactor.push(grossLoss > 0 ? round2(grossWin / grossLoss) : round2(grossWin > 0 ? 1 : 0));
    expectancy.push(round2(cumulative / n));
    drawdown.push(round2(maxDd));
  });

  return {
    winRate: downsample(winRate),
    profitFactor: downsample(profitFactor),
    expectancy: downsample(expectancy),
    drawdown: downsample(drawdown),
  };
}
