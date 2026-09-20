/**
 * Candle chart geometry — pure, so it can be tested without a renderer.
 *
 * The chart answers one question the journal could never answer: what the price
 * DID while the trade was open. The arithmetic that decides whether it answers
 * honestly is small and unforgiving: the vertical domain has to include the
 * STOP and the TARGET (a chart that crops the stop line is a chart that hides
 * the only level the trade was built around), the axis has to be inverted
 * (higher price = smaller y), and a flat series must not divide by zero.
 *
 * All of that is here rather than in the component, because none of it can be
 * checked by looking at a chart that has already been drawn wrong.
 */

export interface CandleBar {
  /** ISO-8601 UTC, as the terminal reported it. */
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
}

export type MarkerTone = 'entry' | 'stop' | 'target' | 'exit' | 'mae' | 'mfe';

export interface ChartMarker {
  price: number;
  label: string;
  tone: MarkerTone;
}

export interface CandleChartInput {
  bars: readonly CandleBar[];
  markers?: readonly ChartMarker[];
  width: number;
  height: number;
  padding?: number;
}

export interface PlottedCandle {
  /** Left edge of the body. */
  x: number;
  bodyWidth: number;
  /** Top of the body (the higher of open/close) and its height, both >= 1px. */
  bodyY: number;
  bodyHeight: number;
  wickX: number;
  wickTop: number;
  wickBottom: number;
  up: boolean;
}

export interface PlottedMarker {
  y: number;
  label: string;
  tone: MarkerTone;
}

export interface CandleChartGeometry {
  candles: PlottedCandle[];
  markers: PlottedMarker[];
  /** Price range actually drawn, markers included. */
  domain: { min: number; max: number };
  /** Horizontal slot per candle, in px. */
  step: number;
}

const DEFAULT_PADDING = 6;

/**
 * A flat series (every bar at the same price, or a single marker and no bars)
 * still needs a span: dividing by it is how a chart becomes a blank rectangle
 * with NaN inside.
 */
function span(min: number, max: number): { min: number; max: number } {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (max > min) return { min, max };
  const pad = Math.abs(max) * 0.001 || 1;
  return { min: min - pad, max: max + pad };
}

export function buildCandleChart(input: CandleChartInput): CandleChartGeometry {
  const padding = input.padding ?? DEFAULT_PADDING;

  // A degenerate box (a chart inside a collapsed container) must still produce
  // finite numbers: the renderer draws nothing, rather than crashing on NaN.
  const width = Math.max(1, Math.floor(input.width));
  const height = Math.max(1, Math.floor(input.height));
  const plotWidth = Math.max(1, width - padding * 2);
  const plotHeight = Math.max(1, height - padding * 2);

  const bars = input.bars.filter(
    b =>
      Number.isFinite(b.o) &&
      Number.isFinite(b.h) &&
      Number.isFinite(b.l) &&
      Number.isFinite(b.c)
  );

  const markers = input.markers ?? [];

  let lo = Infinity;
  let hi = -Infinity;
  for (const b of bars) {
    if (b.l < lo) lo = b.l;
    if (b.h > hi) hi = b.h;
  }
  // Markers widen the domain. An SL 40 points away belongs ON the chart: the
  // whole point of the replay is seeing where the stop stood relative to the
  // noise that took it out.
  for (const m of markers) {
    if (!Number.isFinite(m.price)) continue;
    if (m.price < lo) lo = m.price;
    if (m.price > hi) hi = m.price;
  }

  const domain = span(lo, hi);
  const range = domain.max - domain.min;

  const yFor = (price: number) =>
    padding + (1 - (price - domain.min) / range) * plotHeight;

  const step = bars.length > 0 ? plotWidth / bars.length : plotWidth;
  // min 1px: a 400-candle series in a 300px box must still show something for
  // every candle rather than rounding bodies out of existence.
  const bodyWidth = Math.max(1, Math.min(step * 0.6, 14));

  const candles: PlottedCandle[] = bars.map((bar, index) => {
    const bodyTop = yFor(Math.max(bar.o, bar.c));
    const bodyBottom = yFor(Math.min(bar.o, bar.c));
    return {
      x: padding + index * step + (step - bodyWidth) / 2,
      bodyWidth,
      bodyY: bodyTop,
      bodyHeight: Math.max(1, bodyBottom - bodyTop),
      wickX: padding + index * step + step / 2,
      wickTop: yFor(bar.h),
      wickBottom: yFor(bar.l),
      up: bar.c >= bar.o,
    };
  });

  return {
    candles,
    markers: markers
      .filter(m => Number.isFinite(m.price))
      .map(m => ({ y: yFor(m.price), label: m.label, tone: m.tone })),
    domain,
    step,
  };
}

/**
 * Whatever jsonb holds, give the chart an array of usable bars.
 *
 * The bars come from a different process (an MQL5 expert) through a webhook,
 * so the shape is not guaranteed: the column is jsonb precisely because the
 * source is one we do not control. Anything malformed is dropped rather than
 * rendered as a gap, and the result is sorted — a chart drawn in arrival order
 * is a chart of nothing.
 */
export function normalizeBars(raw: unknown): CandleBar[] {
  if (!Array.isArray(raw)) return [];

  return (raw as Record<string, unknown>[])
    .map(r => ({
      t: typeof r?.t === 'string' ? r.t : null,
      o: Number(r?.o),
      h: Number(r?.h),
      l: Number(r?.l),
      c: Number(r?.c),
    }))
    .filter(
      r =>
        r.t !== null &&
        Number.isFinite(r.o) &&
        Number.isFinite(r.h) &&
        Number.isFinite(r.l) &&
        Number.isFinite(r.c)
    )
    .map(r => ({ t: r.t as string, o: r.o, h: r.h, l: r.l, c: r.c }))
    .sort((a, b) => a.t.localeCompare(b.t));
}

/**
 * The markers a replay shows for one trade, most important first.
 *
 * Ordering is not cosmetic: they are drawn top to bottom, and when two levels
 * sit on the same pixel the first one wins. Stop and target first — they are
 * the levels the trade was DEFINED by; entry and exit next; excursions last,
 * because they are the only ones that can be derived from the terminal's own
 * arithmetic rather than from a deal.
 */
export function tradeMarkers(trade: {
  direction: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  exit_price: number | null;
  mae_price?: number | null;
  mfe_price?: number | null;
}): ChartMarker[] {
  const out: ChartMarker[] = [];

  if (trade.stop_loss) out.push({ price: trade.stop_loss, label: 'SL', tone: 'stop' });
  if (trade.take_profit) out.push({ price: trade.take_profit, label: 'TP', tone: 'target' });
  out.push({ price: trade.entry_price, label: 'IN', tone: 'entry' });
  if (trade.exit_price) out.push({ price: trade.exit_price, label: 'OUT', tone: 'exit' });
  if (trade.mae_price) out.push({ price: trade.mae_price, label: 'MAE', tone: 'mae' });
  if (trade.mfe_price) out.push({ price: trade.mfe_price, label: 'MFE', tone: 'mfe' });

  return out;
}
