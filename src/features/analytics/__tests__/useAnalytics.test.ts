import type { Trade, TradingAccount } from '../../../types/domain';

// useAnalytics is a stack of useMemo calls over pure logic; evaluating them
// eagerly lets us test the maths without a renderer.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (fn: () => unknown) => fn(),
}));

import { useAnalytics } from '../useAnalytics';

const baseTrade: Omit<Trade, 'id' | 'pnl' | 'entry_time'> = {
  user_id: 'u',
  account_id: 'acc1',
  pair: 'XAUUSD',
  direction: 'BUY',
  entry_price: 2000,
  exit_price: 2010,
  stop_loss: 1995,
  take_profit: 2020,
  size: 1,
  exit_time: '2026-01-13T11:00:00Z',
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
  created_at: '2026-01-13T10:00:00Z',
};

const mk = (id: string, pnl: number | null, extra: Partial<Trade> = {}): Trade =>
  ({ ...baseTrade, id, pnl, entry_time: '2026-01-13T10:00:00Z', ...extra }) as Trade;

const account: TradingAccount = {
  id: 'acc1',
  user_id: 'u',
  name: 'Challenge',
  type: 'challenge',
  balance: 100000,
  initial_balance: 100000,
  currency: 'USD',
  is_active: true,
  max_daily_loss_limit: 2000,
  max_drawdown_limit: 10000,
  profit_target: 10000,
  consistency_rule_percent: 15,
  created_at: '2026-01-01T00:00:00Z',
};

const run = (trades: Trade[], overrides: Partial<Parameters<typeof useAnalytics>[0]> = {}) =>
  useAnalytics({
    trades,
    accounts: [account],
    playbookSetups: [],
    activeAccountId: 'acc1',
    dateRange: 'all',
    lang: 'fr',
    t: ((k: string) => k) as never,
    ...overrides,
  });

describe('useAnalytics', () => {
  it('handles an empty trade list without dividing by zero', () => {
    const r = run([]);
    expect(r.totalPnL).toBe(0);
    expect(r.winRate).toBe(0);
    expect(r.profitFactor).toBe(0);
    expect(r.expectancy).toBe(0);
    expect(r.maxDrawdown).toBe(0);
  });

  it('excludes open trades from every aggregate', () => {
    const r = run([mk('1', 100), mk('2', null)]);
    expect(r.closed).toHaveLength(1);
    expect(r.totalPnL).toBe(100);
  });

  it('scopes to the active account', () => {
    const r = run([mk('1', 100), mk('2', 500, { account_id: 'other' })]);
    expect(r.closed).toHaveLength(1);
    expect(r.totalPnL).toBe(100);
  });

  it('includes all accounts when none is active', () => {
    const r = run([mk('1', 100), mk('2', 500, { account_id: 'other' })], {
      activeAccountId: null,
    });
    expect(r.closed).toHaveLength(2);
    expect(r.totalPnL).toBe(600);
  });

  it('computes win rate, profit factor and expectancy', () => {
    const r = run([mk('1', 200), mk('2', 100), mk('3', -100), mk('4', -50)]);
    expect(r.wins).toHaveLength(2);
    expect(r.losses).toHaveLength(2);
    expect(r.winRate).toBe(50);
    expect(r.profitFactor).toBeCloseTo(2, 5); // 300 / 150
    expect(r.totalPnL).toBe(150);
    expect(r.expectancy).toBeCloseTo(37.5, 5);
  });

  it('caps profit factor when there are no losses', () => {
    const r = run([mk('1', 100), mk('2', 50)]);
    expect(r.profitFactor).toBe(99.9);
  });

  it('separates breakeven trades from wins and losses', () => {
    const r = run([mk('1', 0), mk('2', 100)]);
    expect(r.breakeven).toHaveLength(1);
    expect(r.wins).toHaveLength(1);
    expect(r.losses).toHaveLength(0);
  });

  it('tracks peak-to-trough max drawdown', () => {
    // Equity: +500, +300, -200, +300 → peak 500, trough -200 ⇒ DD 700
    const r = run([mk('1', 500), mk('2', -200), mk('3', -500), mk('4', 500)]);
    expect(r.maxDrawdown).toBe(700);
  });

  it('reports zero drawdown on a monotonically rising curve', () => {
    const r = run([mk('1', 100), mk('2', 100), mk('3', 100)]);
    expect(r.maxDrawdown).toBe(0);
    expect(r.currentDrawdown).toBe(0);
  });

  it('groups P&L by session', () => {
    const r = run([
      mk('1', 100, { session: 'London' }),
      mk('2', -40, { session: 'London' }),
      mk('3', 300, { session: 'New York' }),
    ]);
    const london = r.sessionBreakdown.find(s => s.name === 'London')!;
    const ny = r.sessionBreakdown.find(s => s.name === 'New York')!;
    expect(london.pnl).toBe(60);
    expect(london.count).toBe(2);
    expect(london.winRate).toBe(50);
    expect(ny.pnl).toBe(300);
  });

  it('defaults a null session to Over Session', () => {
    const r = run([mk('1', 50, { session: null })]);
    expect(r.sessionBreakdown.find(s => s.name === 'Over Session')!.count).toBe(1);
  });

  it('buckets day-of-week with Monday first', () => {
    // 2026-01-13 is a Tuesday.
    const r = run([mk('1', 120, { entry_time: '2026-01-13T10:00:00' })]);
    expect(r.dayOfWeekAnalysis[1].nameEn).toBe('Tue');
    expect(r.dayOfWeekAnalysis[1].pnl).toBe(120);
    expect(r.dayOfWeekAnalysis[0].count).toBe(0);
  });

  it('breaks down performance by mental state', () => {
    const r = run([
      mk('1', -200, { mental_state: 'revenge' }),
      mk('2', 100, { mental_state: 'focused' }),
    ]);
    const revenge = r.mentalBreakdown.find(m => m.state === 'REVENGE')!;
    expect(revenge.count).toBe(1);
    expect(revenge.pnl).toBe(-200);
    expect(revenge.winRate).toBe(0);
  });

  it('exposes the selected account and its prop-firm limits', () => {
    const r = run([]);
    expect(r.selectedAccount?.id).toBe('acc1');
    expect(r.initialBalance).toBe(100000);
    expect(r.profitTarget).toBe(10000);
    expect(r.maxDrawdownLimit).toBe(10000);
  });

  it('filters by the selected date range', () => {
    const old = mk('old', 999, { entry_time: '2020-01-01T10:00:00Z' });
    const recent = mk('recent', 100, { entry_time: new Date().toISOString() });
    const all = run([old, recent]);
    const week = run([old, recent], { dateRange: '7d' });
    expect(all.closed).toHaveLength(2);
    expect(week.closed).toHaveLength(1);
    expect(week.totalPnL).toBe(100);
  });
});
