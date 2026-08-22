import { renderHook } from '@testing-library/react-hooks';
import { useRRDistribution } from '../useRRDistribution';
import type { Trade } from '../../../types/domain';

const makeTrade = (overrides: Partial<Trade> = {}): Trade => ({
  id: '1',
  user_id: 'u1',
  account_id: 'a1',
  pair: 'NQ',
  direction: 'BUY',
  entry_price: 100,
  exit_price: 110,
  stop_loss: 95,
  take_profit: 120,
  size: 1,
  entry_time: new Date().toISOString(),
  exit_time: new Date().toISOString(),
  pnl: 100,
  r_multiple: 2,
  timeframe: 'M5',
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
  created_at: new Date().toISOString(),
  ...overrides,
});

describe('useRRDistribution', () => {
  it('should return empty array for no trades', () => {
    const { result } = renderHook(() => useRRDistribution([]));
    expect(result.current).toEqual([]);
  });

  it('should group trades by R-multiple', () => {
    const trades = [
      makeTrade({ id: '1', r_multiple: 2.5, pnl: 250, result: 'TP' }),
      makeTrade({ id: '2', r_multiple: 1.2, pnl: 120, result: 'TP' }),
      makeTrade({ id: '3', r_multiple: -1, pnl: -100, result: 'SL' }),
    ];
    const { result } = renderHook(() => useRRDistribution(trades));
    expect(result.current.length).toBeGreaterThan(0);
    const plus3R = result.current.find(b => b.label === '+3R');
    expect(plus3R?.count).toBe(1);
    const minus1R = result.current.find(b => b.label === '-1R');
    expect(minus1R?.count).toBe(1);
  });

  it('should filter out empty buckets', () => {
    const trades = [
      makeTrade({ id: '1', r_multiple: 1.5, pnl: 150, result: 'TP' }),
    ];
    const { result } = renderHook(() => useRRDistribution(trades));
    const allBuckets = result.current;
    expect(allBuckets.every(b => b.count > 0)).toBe(true);
  });

  it('should calculate PnL per bucket', () => {
    const trades = [
      makeTrade({ id: '1', r_multiple: 1.2, pnl: 120, result: 'TP' }),
      makeTrade({ id: '2', r_multiple: 1.8, pnl: 180, result: 'TP' }),
    ];
    const { result } = renderHook(() => useRRDistribution(trades));
    const plus1R = result.current.find(b => b.label === '+1R');
    expect(plus1R?.pnl).toBe(120);
    const plus2R = result.current.find(b => b.label === '+2R');
    expect(plus2R?.pnl).toBe(180);
  });
});
