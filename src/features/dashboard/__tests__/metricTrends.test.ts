import { computeMetricTrends, MIN_POINTS_FOR_TREND } from '../metricTrends';
import type { Trade } from '../../../types/domain';

let seq = 0;
const trade = (pnl: number | null, dayOffset = 0): Trade =>
  ({
    id: `t${seq++}`,
    account_id: 'a1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2000,
    exit_price: 2010,
    stop_loss: 1990,
    take_profit: 2020,
    size: 1,
    timeframe: 'H1',
    entry_time: new Date(2026, 0, 1 + dayOffset, 9).toISOString(),
    exit_time: new Date(2026, 0, 1 + dayOffset, 10).toISOString(),
    pnl,
    r_multiple: null,
    result: 'TP',
    mental_state: 'focused',
    session: 'London',
    notes: null,
  }) as Trade;

beforeEach(() => {
  seq = 0;
});

describe('computeMetricTrends', () => {
  it('stays silent below the minimum, rather than drawing a 2-point "trend"', () => {
    const r = computeMetricTrends([trade(100), trade(-50), trade(100)]);
    expect(r.winRate).toEqual([]);
    expect(r.profitFactor).toEqual([]);
    expect(r.expectancy).toEqual([]);
    expect(r.drawdown).toEqual([]);
  });

  it('produces one point per closed trade', () => {
    const r = computeMetricTrends([trade(100, 0), trade(-50, 1), trade(100, 2), trade(-50, 3)]);
    expect(r.winRate).toHaveLength(4);
    expect(r.expectancy).toHaveLength(4);
  });

  it('tracks win rate cumulatively', () => {
    const r = computeMetricTrends([trade(100, 0), trade(-50, 1), trade(100, 2), trade(100, 3)]);
    expect(r.winRate).toEqual([100, 50, 66.67, 75]);
  });

  it('ends on the value the headline metric shows', () => {
    // 3 wins of 100, 1 loss of 50 -> 75% and expectancy (300-50)/4 = 62.5
    const r = computeMetricTrends([trade(100, 0), trade(100, 1), trade(100, 2), trade(-50, 3)]);
    expect(r.winRate[r.winRate.length - 1]).toBe(75);
    expect(r.expectancy[r.expectancy.length - 1]).toBe(62.5);
  });

  it('never emits Infinity for a book with no losses', () => {
    const r = computeMetricTrends([trade(100, 0), trade(100, 1), trade(100, 2), trade(100, 3)]);
    for (const v of r.profitFactor) {
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('computes profit factor once a loss exists', () => {
    // 300 won, 100 lost -> 3
    const r = computeMetricTrends([trade(100, 0), trade(100, 1), trade(100, 2), trade(-100, 3)]);
    expect(r.profitFactor[3]).toBe(3);
  });

  it('reports drawdown as a non-decreasing positive magnitude', () => {
    const r = computeMetricTrends([trade(100, 0), trade(-60, 1), trade(-40, 2), trade(20, 3)]);
    expect(r.drawdown).toEqual([0, 60, 100, 100]);
    for (let i = 1; i < r.drawdown.length; i++) {
      expect(r.drawdown[i]).toBeGreaterThanOrEqual(r.drawdown[i - 1]);
    }
  });

  it('ignores open trades', () => {
    const r = computeMetricTrends([
      trade(100, 0),
      trade(null, 1),
      trade(-50, 2),
      trade(100, 3),
      trade(100, 4),
    ]);
    expect(r.winRate).toHaveLength(4);
  });

  it('orders by entry time, not array order', () => {
    // Newest first, as a query would return them.
    const r = computeMetricTrends([trade(-50, 3), trade(100, 2), trade(100, 1), trade(100, 0)]);
    expect(r.winRate[0]).toBe(100); // oldest trade is a win
    expect(r.winRate[3]).toBe(75);
  });

  it('downsamples a long history but keeps the final value exact', () => {
    const many = Array.from({ length: 300 }, (_, i) => trade(i % 3 === 0 ? -50 : 100, i));
    const r = computeMetricTrends(many);
    expect(r.winRate.length).toBeLessThanOrEqual(40);
    expect(r.winRate.length).toBeGreaterThan(10);
    // 200 wins of 300 trades
    expect(r.winRate[r.winRate.length - 1]).toBeCloseTo(66.67, 1);
  });

  it('requires at least MIN_POINTS_FOR_TREND closed trades', () => {
    const justEnough = Array.from({ length: MIN_POINTS_FOR_TREND }, (_, i) => trade(100, i));
    expect(computeMetricTrends(justEnough).winRate).toHaveLength(MIN_POINTS_FOR_TREND);
  });
});
