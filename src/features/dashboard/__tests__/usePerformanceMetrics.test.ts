import { computePerformanceMetrics } from '../usePerformanceMetrics';
import type { Trade } from '../../../types/domain';

let seq = 0;

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t${seq++}`,
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2000,
    exit_price: 2010,
    stop_loss: 1990,
    take_profit: 2020,
    size: 1,
    entry_time: `2026-01-${String((seq % 27) + 1).padStart(2, '0')}T10:00:00.000Z`,
    exit_time: `2026-01-${String((seq % 27) + 1).padStart(2, '0')}T11:00:00.000Z`,
    pnl: 100,
    r_multiple: 1,
    timeframe: 'M15',
    setup_structures: [],
    setup_fvg: false,
    setup_ob: false,
    setup_liquidity_sweep: false,
    bookmap_absorption: null,
    bookmap_passive_orders: null,
    bookmap_aggressive_orders: null,
    bookmap_vwap_position: null,
    mental_state: 'focused',
    cookie_jar_ref: false,
    rule_40_percent: false,
    screenshot_before_url: null,
    screenshot_after_url: null,
    notes: null,
    result: 'TP',
    session: 'London',
    created_at: '2026-01-01T00:00:00.000Z',
    ...over,
  }) as Trade;

beforeEach(() => {
  seq = 0;
});

describe('breakeven handling', () => {
  it('does not count a breakeven trade as a loss', () => {
    // The dashboard showed "2W / 3L" for an account analytics reported as
    // "2W / 2L / 1BE". Same data, two different screens.
    const m = computePerformanceMetrics([
      trade({ pnl: 100 }),
      trade({ pnl: 200 }),
      trade({ pnl: -50 }),
      trade({ pnl: -80 }),
      trade({ pnl: 0 }),
    ]);
    expect(m.winCount).toBe(2);
    expect(m.lossCount).toBe(2);
    expect(m.breakevenCount).toBe(1);
  });

  it('keeps wins + losses + breakeven equal to the closed count', () => {
    const m = computePerformanceMetrics([
      trade({ pnl: 10 }),
      trade({ pnl: 0 }),
      trade({ pnl: -10 }),
      trade({ pnl: null }),
    ]);
    expect(m.winCount + m.lossCount + m.breakevenCount).toBe(m.closedTrades);
    expect(m.openTrades).toBe(1);
  });

  it('does not dilute avgLoss with breakeven trades', () => {
    // Two real losses of 100 each. avgLoss must be 100, not 66.67.
    const m = computePerformanceMetrics([
      trade({ pnl: -100 }),
      trade({ pnl: -100 }),
      trade({ pnl: 0 }),
    ]);
    expect(m.avgLoss).toBe(100);
  });

  it('still counts breakeven in the win rate denominator', () => {
    // A breakeven is not a win: 1 win out of 2 closed trades is 50%.
    const m = computePerformanceMetrics([trade({ pnl: 100 }), trade({ pnl: 0 })]);
    expect(m.winRate).toBe(50);
  });
});

describe('profit factor', () => {
  it('reports 0, not 99.99, when there are no losses', () => {
    // 99.99 was a fabricated number that looked like a measurement.
    const m = computePerformanceMetrics([trade({ pnl: 100 }), trade({ pnl: 50 })]);
    expect(m.profitFactor).toBe(0);
  });

  it('computes gross profit over gross loss', () => {
    const m = computePerformanceMetrics([trade({ pnl: 300 }), trade({ pnl: -100 })]);
    expect(m.profitFactor).toBe(3);
  });

  it('is unaffected by breakeven trades', () => {
    const withBe = computePerformanceMetrics([
      trade({ pnl: 300 }),
      trade({ pnl: -100 }),
      trade({ pnl: 0 }),
    ]);
    expect(withBe.profitFactor).toBe(3);
  });

  it('never returns Infinity or NaN', () => {
    for (const set of [[], [trade({ pnl: 0 })], [trade({ pnl: 100 })], [trade({ pnl: -100 })]]) {
      const m = computePerformanceMetrics(set);
      expect(Number.isFinite(m.profitFactor)).toBe(true);
    }
  });
});

describe('aggregates', () => {
  it('handles an empty book without dividing by zero', () => {
    const m = computePerformanceMetrics([]);
    expect(m.winRate).toBe(0);
    expect(m.netPnL).toBe(0);
    expect(m.avgWin).toBe(0);
    expect(m.avgLoss).toBe(0);
    expect(m.maxDrawdown).toBe(0);
  });

  it('excludes open trades from closed statistics', () => {
    const m = computePerformanceMetrics([trade({ pnl: 100 }), trade({ pnl: null })]);
    expect(m.closedTrades).toBe(1);
    expect(m.openTrades).toBe(1);
    expect(m.netPnL).toBe(100);
  });

  it('sums net P&L across wins and losses', () => {
    const m = computePerformanceMetrics([
      trade({ pnl: 500 }),
      trade({ pnl: -200 }),
      trade({ pnl: 409.99 }),
    ]);
    expect(m.netPnL).toBeCloseTo(709.99, 2);
  });

  it('tracks max drawdown as a positive magnitude from the peak', () => {
    const m = computePerformanceMetrics([
      trade({ pnl: 500, entry_time: '2026-02-01T10:00:00.000Z' }),
      trade({ pnl: -300, entry_time: '2026-02-02T10:00:00.000Z' }),
      trade({ pnl: -100, entry_time: '2026-02-03T10:00:00.000Z' }),
    ]);
    expect(m.maxDrawdown).toBe(400);
  });

  it('builds the equity curve in chronological order', () => {
    const m = computePerformanceMetrics([
      trade({ pnl: 100, entry_time: '2026-03-03T10:00:00.000Z' }),
      trade({ pnl: 50, entry_time: '2026-03-01T10:00:00.000Z' }),
      trade({ pnl: -20, entry_time: '2026-03-02T10:00:00.000Z' }),
    ]);
    expect(m.equityCurve.map(p => p.pnl)).toEqual([50, 30, 130]);
  });

  it('picks the best and worst trades', () => {
    const m = computePerformanceMetrics([
      trade({ pnl: 120 }),
      trade({ pnl: 640 }),
      trade({ pnl: -310 }),
    ]);
    expect(m.bestTrade?.pnl).toBe(640);
    expect(m.worstTrade?.pnl).toBe(-310);
  });

  it('returns no best/worst trade when nothing qualifies', () => {
    const m = computePerformanceMetrics([trade({ pnl: 0 })]);
    expect(m.bestTrade).toBeNull();
    expect(m.worstTrade).toBeNull();
  });
});
