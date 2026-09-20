import { buildCandleChart, tradeMarkers, type CandleBar } from '../candleChart';

/**
 * The replay chart's arithmetic. Nothing here is visible in a screenshot when
 * it is wrong: a cropped stop line and an inverted axis both look like a chart.
 */
const bar = (o: number, h: number, l: number, c: number, min = 0): CandleBar => ({
  t: new Date(Date.UTC(2026, 8, 15, 12, min)).toISOString(),
  o,
  h,
  l,
  c,
});

describe('buildCandleChart', () => {
  it('inverts the axis: a higher price is higher on screen', () => {
    const g = buildCandleChart({
      bars: [bar(100, 110, 95, 105), bar(105, 120, 100, 115)],
      width: 300,
      height: 200,
    });
    expect(g.candles[1].wickTop).toBeLessThan(g.candles[0].wickTop);
  });

  it('includes the stop and the target in the domain, however far they sit', () => {
    // The point of the replay: seeing where the stop stood relative to the
    // noise. A chart that crops it hides the only level the trade was built on.
    const g = buildCandleChart({
      bars: [bar(100, 101, 99, 100.5)],
      markers: [
        { price: 80, label: 'SL', tone: 'stop' },
        { price: 140, label: 'TP', tone: 'target' },
      ],
      width: 300,
      height: 200,
    });

    expect(g.domain.min).toBe(80);
    expect(g.domain.max).toBe(140);
    for (const m of g.markers) {
      expect(m.y).toBeGreaterThanOrEqual(0);
      expect(m.y).toBeLessThanOrEqual(200);
    }
    // TP above SL, always.
    const tp = g.markers.find(m => m.tone === 'target')!;
    const sl = g.markers.find(m => m.tone === 'stop')!;
    expect(tp.y).toBeLessThan(sl.y);
  });

  it('lays candles out left to right, inside the padding', () => {
    const bars = Array.from({ length: 5 }, (_, i) => bar(100 + i, 101 + i, 99 + i, 100.5 + i, i));
    const g = buildCandleChart({ bars, width: 300, height: 200, padding: 10 });

    expect(g.candles).toHaveLength(5);
    expect(g.candles[0].x).toBeGreaterThanOrEqual(10);
    expect(g.candles[4].x + g.candles[4].bodyWidth).toBeLessThanOrEqual(290);
    for (let i = 1; i < g.candles.length; i++) {
      expect(g.candles[i].x).toBeGreaterThan(g.candles[i - 1].x);
    }
  });

  it('keeps every body at least one pixel wide, however many candles', () => {
    const bars = Array.from({ length: 400 }, (_, i) => bar(100, 101, 99, 100, i % 60));
    const g = buildCandleChart({ bars, width: 300, height: 200 });
    expect(g.candles.every(c => c.bodyWidth >= 1)).toBe(true);
    expect(g.candles.every(c => c.bodyHeight >= 1)).toBe(true);
  });

  it('survives a flat series without dividing by zero', () => {
    const g = buildCandleChart({ bars: [bar(100, 100, 100, 100)], width: 300, height: 200 });
    expect(g.domain.max).toBeGreaterThan(g.domain.min);
    expect(Number.isFinite(g.candles[0].bodyY)).toBe(true);
    expect(Number.isFinite(g.candles[0].wickTop)).toBe(true);
  });

  it('survives an empty series and a degenerate box', () => {
    const empty = buildCandleChart({ bars: [], width: 300, height: 200 });
    expect(empty.candles).toEqual([]);
    expect(empty.markers).toEqual([]);
    expect(Number.isFinite(empty.domain.min)).toBe(true);

    const tiny = buildCandleChart({ bars: [bar(100, 101, 99, 100)], width: 0, height: 0 });
    expect(Number.isFinite(tiny.candles[0].bodyY)).toBe(true);
    expect(Number.isFinite(tiny.step)).toBe(true);
  });

  it('drops bars with an unparseable price instead of drawing NaN', () => {
    const g = buildCandleChart({
      bars: [bar(100, 101, 99, 100), { t: 'x', o: NaN, h: 101, l: 99, c: 100 }],
      width: 300,
      height: 200,
    });
    expect(g.candles).toHaveLength(1);
  });

  it('draws a body from open to close, up or down', () => {
    const g = buildCandleChart({
      bars: [bar(100, 110, 95, 105), bar(105, 110, 95, 100)],
      width: 300,
      height: 200,
    });
    expect(g.candles[0].up).toBe(true);
    expect(g.candles[1].up).toBe(false);
    // Same high/low, so the same wick extent.
    expect(g.candles[0].wickTop).toBeCloseTo(g.candles[1].wickTop, 6);
  });
});

describe('tradeMarkers', () => {
  it('lists the levels the trade was defined by, stop and target first', () => {
    const markers = tradeMarkers({
      direction: 'BUY',
      entry_price: 100,
      stop_loss: 95,
      take_profit: 115,
      exit_price: 114,
      mae_price: 96,
      mfe_price: 116,
    });

    expect(markers.map(m => m.label)).toEqual(['SL', 'TP', 'IN', 'OUT', 'MAE', 'MFE']);
  });

  it('omits what is not recorded instead of inventing a zero', () => {
    // A stop of 0 is not a stop, and drawing it at the bottom of the chart
    // would be a confident lie about a trade with no protection.
    const markers = tradeMarkers({
      direction: 'BUY',
      entry_price: 100,
      stop_loss: null,
      take_profit: 0,
      exit_price: null,
    });
    expect(markers.map(m => m.label)).toEqual(['IN']);
  });
});
