import { renderHook } from '@testing-library/react-hooks';
import { useStreakData } from '../useStreakData';
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

describe('useStreakData', () => {
  it('should return empty state for no trades', () => {
    const { result } = renderHook(() => useStreakData([]));
    expect(result.current.currentStreak).toBe(0);
    expect(result.current.currentType).toBe('none');
    expect(result.current.bestWinStreak).toBe(0);
    expect(result.current.bestLossStreak).toBe(0);
  });

  it('should detect current win streak', () => {
    const trades = [
      makeTrade({ id: '3', result: 'TP', pnl: 100 }),
      makeTrade({ id: '2', result: 'TP', pnl: 100 }),
      makeTrade({ id: '1', result: 'TP', pnl: 100 }),
    ];
    const { result } = renderHook(() => useStreakData(trades));
    expect(result.current.currentStreak).toBe(3);
    expect(result.current.currentType).toBe('win');
  });

  it('should detect current loss streak', () => {
    const trades = [
      makeTrade({ id: '3', result: 'SL', pnl: -100 }),
      makeTrade({ id: '2', result: 'SL', pnl: -100 }),
    ];
    const { result } = renderHook(() => useStreakData(trades));
    expect(result.current.currentStreak).toBe(2);
    expect(result.current.currentType).toBe('loss');
  });

  it('should stop streak at first different result', () => {
    const trades = [
      makeTrade({ id: '4', result: 'TP', pnl: 100 }),
      makeTrade({ id: '3', result: 'TP', pnl: 100 }),
      makeTrade({ id: '2', result: 'SL', pnl: -100 }),
      makeTrade({ id: '1', result: 'TP', pnl: 100 }),
    ];
    const { result } = renderHook(() => useStreakData(trades));
    expect(result.current.currentStreak).toBe(2);
    expect(result.current.currentType).toBe('win');
  });

  it('should track best win streak across all trades', () => {
    const trades = [
      makeTrade({ id: '6', result: 'TP', pnl: 100 }),
      makeTrade({ id: '5', result: 'SL', pnl: -100 }),
      makeTrade({ id: '4', result: 'TP', pnl: 100 }),
      makeTrade({ id: '3', result: 'TP', pnl: 100 }),
      makeTrade({ id: '2', result: 'TP', pnl: 100 }),
      makeTrade({ id: '1', result: 'TP', pnl: 100 }),
    ];
    const { result } = renderHook(() => useStreakData(trades));
    expect(result.current.bestWinStreak).toBe(4);
    // Current streak: most recent is TP, then SL breaks it → streak=1
    expect(result.current.currentStreak).toBe(1);
  });

  it('should count total wins and losses', () => {
    const trades = [
      makeTrade({ id: '5', result: 'TP', pnl: 100 }),
      makeTrade({ id: '4', result: 'TP', pnl: 100 }),
      makeTrade({ id: '3', result: 'SL', pnl: -100 }),
      makeTrade({ id: '2', result: 'TP', pnl: 100 }),
      makeTrade({ id: '1', result: 'SL', pnl: -100 }),
    ];
    const { result } = renderHook(() => useStreakData(trades));
    expect(result.current.totalWins).toBeGreaterThanOrEqual(2);
    expect(result.current.totalLosses).toBeGreaterThanOrEqual(1);
  });
});
