import type { Trade } from '../../../types/domain';
import {
  periodSeries,
  cumulativePnlSeries,
  monthlyPnlHistory,
  monthlyPnlSeries,
  useMonthlyReview,
} from '../periodReview';

/**
 * `useMonthlyReview` only calls useMemo, which React evaluates eagerly on
 * first render, so calling it outside a component is safe and avoids pulling
 * react-test-renderer for what is pure arithmetic.
 */
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (fn: () => unknown) => fn(),
}));

const base: Omit<Trade, 'id' | 'entry_time' | 'pnl'> = {
  user_id: 'u',
  account_id: 'a',
  pair: 'XAUUSD',
  direction: 'BUY',
  entry_price: 2000,
  exit_price: 2010,
  stop_loss: 1995,
  take_profit: 2020,
  size: 1,
  exit_time: null,
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
  created_at: '2026-01-01T00:00:00Z',
};

const mk = (id: string, iso: string, pnl: number, extra: Partial<Trade> = {}): Trade =>
  ({ ...base, id, entry_time: iso, pnl, ...extra }) as Trade;

// Reference "now": Wednesday 2026-01-14.
const NOW = new Date('2026-01-14T12:00:00');

describe('periodSeries', () => {
  it('buckets monthly P&L into one slot per month, oldest first', () => {
    const r = periodSeries(
      [
        mk('1', '2025-11-10T09:00:00', 100),
        mk('2', '2025-12-03T09:00:00', -40),
        mk('3', '2025-12-20T09:00:00', 60),
      ],
      new Date(2025, 10, 1),
      new Date(2026, 1, 1),
      'month'
    );
    // [from, to) covers November through January.
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ label: '202511', value: 100, trades: 1 });
    expect(r[1].label).toBe('202512');
    expect(r[1].value).toBe(20);
    expect(r[1].trades).toBe(2);
    expect(r[2]).toEqual({ label: '202601', value: 0, trades: 0 });
  });

  it('buckets weekly P&L into Monday-first calendar weeks', () => {
    // January 2026: Thu 1st -> week starts Mon Dec 29.
    const r = periodSeries(
      [
        mk('1', '2026-01-05T09:00:00', 100), // Mon Jan 5, week of Jan 5
        mk('2', '2026-01-07T09:00:00', 50), // Wed, same week
        mk('3', '2026-01-12T09:00:00', -30), // Mon Jan 12, next week
      ],
      new Date(2026, 0, 1),
      new Date(2026, 0, 15),
      'week'
    );
    // Slots: Dec 29 (empty), Jan 5, Jan 12.
    expect(r).toHaveLength(3);
    expect(r[0]).toEqual({ label: 'W01', value: 0, trades: 0 });
    expect(r[1]).toEqual({ label: 'W02', value: 150, trades: 2 });
    expect(r[2]).toEqual({ label: 'W03', value: -30, trades: 1 });
  });

  it('assigns a straddling trade to the week its close falls in', () => {
    // Week starting Mon 2026-01-05 straddles nothing, but a trade closed
    // Saturday belongs to that same week.
    const r = periodSeries(
      [mk('1', '2026-01-10T21:00:00', 70)],
      new Date(2026, 0, 5),
      new Date(2026, 0, 12),
      'week'
    );
    expect(r).toHaveLength(1);
    expect(r[0].value).toBe(70);
  });

  it('skips open trades', () => {
    const r = periodSeries(
      [mk('1', '2026-01-06T09:00:00', 100), { ...mk('2', '2026-01-07T09:00:00', 0), pnl: null }],
      new Date(2026, 0, 5),
      new Date(2026, 0, 12),
      'week'
    );
    expect(r[0].trades).toBe(1);
  });
});

describe('cumulativePnlSeries', () => {
  it('accumulates one point per traded day inside the window', () => {
    const r = cumulativePnlSeries(
      [
        mk('1', '2026-01-05T09:00:00', 100),
        mk('2', '2026-01-05T15:00:00', 50),
        mk('3', '2026-01-07T09:00:00', -40),
      ],
      new Date(2026, 0, 1),
      new Date(2026, 1, 1)
    );
    expect(r).toEqual([100, 150, 110]);
  });

  it('ignores trades outside the window', () => {
    const r = cumulativePnlSeries(
      [
        mk('1', '2025-12-31T09:00:00', 999),
        mk('2', '2026-01-05T09:00:00', 20),
        mk('3', '2026-02-01T09:00:00', 999),
      ],
      new Date(2026, 0, 1),
      new Date(2026, 1, 1)
    );
    expect(r).toEqual([20]);
  });

  it('returns empty for an empty window', () => {
    expect(cumulativePnlSeries([], new Date(2026, 0, 1), new Date(2026, 1, 1))).toEqual([]);
  });
});

describe('monthlyPnlSeries', () => {
  it('labels each month and files trades under their close month', () => {
    // Opened in December, closed in January: the January slot owns it.
    const r = monthlyPnlSeries(
      [
        mk('1', '2025-12-30T09:00:00', 300, { exit_time: '2026-01-02T15:00:00' }),
        mk('2', '2026-01-06T09:00:00', -120),
      ],
      new Date(2025, 11, 1),
      new Date(2026, 1, 1),
      'en'
    );
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ key: '202512', value: 0, trades: 0 });
    expect(r[1]).toMatchObject({ key: '202601', value: 180, trades: 2 });
    expect(r[1].label).toMatch(/JAN/);
  });

  it('produces French labels for the fr locale', () => {
    const r = monthlyPnlSeries(
      [mk('1', '2026-01-06T09:00:00', 50)],
      new Date(2026, 0, 1),
      new Date(2026, 1, 1),
      'fr'
    );
    expect(r[0].label).toMatch(/JANV|JAN/);
  });
});

describe('monthlyPnlHistory', () => {
  it('starts at the month of the first trade and runs to now, inclusive', () => {
    const r = monthlyPnlHistory(
      [
        mk('1', '2025-11-10T09:00:00', 100),
        mk('2', '2026-01-06T09:00:00', 50),
        mk('3', '2025-12-06T09:00:00', -20),
      ],
      new Date(2026, 0, 14)
    );
    expect(r.map(h => h.label)).toEqual(['202511', '202512', '202601']);
    expect(r.map(h => h.value)).toEqual([100, -20, 50]);
  });

  it('returns empty for a journal without closed trades', () => {
    expect(monthlyPnlHistory([mk('1', '2026-01-06T09:00:00', 0, { pnl: null })], NOW)).toEqual([]);
    expect(monthlyPnlHistory([], NOW)).toEqual([]);
  });
});

describe('useMonthlyReview — comparisons and navigation', () => {
  it('exposes cumulative curves and weekly buckets for both months', () => {
    // January 2026: weeks Mon 5, Mon 12, Mon 19, Mon 26 (Feb starts Thu 29th
    // slot -> week of Jan 26 covers Jan 26-Feb 1).
    const r = useMonthlyReview(
      [
        mk('1', '2026-01-05T09:00:00', 100),
        mk('2', '2026-01-07T09:00:00', 50),
        mk('3', '2026-01-12T09:00:00', -30),
        mk('4', '2025-12-03T09:00:00', 200),
        mk('5', '2025-12-10T09:00:00', 100),
      ],
      NOW
    );
    expect(r.cumPnL).toEqual([100, 150, 120]);
    expect(r.prevCumPnL).toEqual([200, 300]);
    // January 2026 has five Monday-starting weeks: Dec 29, Jan 5, 12, 19, 26.
    expect(r.weeklyPnL.map(w => w.value)).toEqual([0, 150, -30, 0, 0]);
    // December 2025 starts on a Monday: weeks Dec 1, 8, 15, 22, 29.
    expect(r.prevWeeklyPnL.map(w => w.value)).toEqual([200, 100, 0, 0, 0]);
    expect(r.prevPnL).toBe(300);
    expect(r.prevTrades).toBe(2);
    expect(r.canGoPrev).toBe(true);
    expect(r.prevStart.getFullYear()).toBe(2025);
    expect(r.prevStart.getMonth()).toBe(11);
  });

  it('hides the prev chevron when the journal starts in the reviewed month', () => {
    const r = useMonthlyReview([mk('1', '2026-01-06T09:00:00', 100)], NOW);
    expect(r.canGoPrev).toBe(false);
  });

  it('recomputes everything against an anchored month', () => {
    const r = useMonthlyReview(
      [
        mk('1', '2025-12-03T09:00:00', 200),
        mk('2', '2025-11-10T09:00:00', 90),
        mk('3', '2026-01-06T09:00:00', 999),
      ],
      new Date(2025, 11, 20) // reviewing December 2025
    );
    expect(r.netPnL).toBe(200);
    expect(r.prevPnL).toBe(90);
    expect(r.canGoPrev).toBe(true);
  });
});
