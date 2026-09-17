import type { Trade } from '../../../types/domain';
import { useYearlyReview } from '../useYearlyReview';

/**
 * `useYearlyReview` only calls useMemo, which React evaluates eagerly on first
 * render. Calling it outside a component is safe here and avoids pulling in
 * react-test-renderer for what is pure arithmetic — the same trick the weekly
 * and monthly review tests use.
 */
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMemo: (fn: () => unknown) => fn(),
}));

const base: Omit<Trade, 'id' | 'entry_time' | 'exit_time' | 'pnl'> = {
  user_id: 'u',
  account_id: 'a',
  pair: 'XAUUSD',
  direction: 'BUY',
  entry_price: 2000,
  exit_price: 2010,
  stop_loss: 1995,
  take_profit: 2020,
  size: 1,
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
  commission: 0,
  swap: 0,
  mae_price: null,
  mfe_price: null,
  tags: [],
  created_at: '',
};

function mk(id: string, iso: string, pnl: number, r = 1): Trade {
  return { ...base, id, entry_time: iso, exit_time: iso, pnl, r_multiple: r } as Trade;
}

describe('useYearlyReview', () => {
  const Y = new Date().getFullYear();

  it('buckets the year into twelve months, oldest first', () => {
    const r = useYearlyReview(
      [
        mk('1', `${Y}-01-15T09:00:00`, 200),
        mk('2', `${Y}-03-10T09:00:00`, 150),
        mk('3', `${Y}-03-20T09:00:00`, -50),
      ],
      Y
    );
    expect(r.monthlyPnL).toHaveLength(12);
    expect(r.monthlyPnL[0].value).toBe(200);
    expect(r.monthlyPnL[2].value).toBe(100);
    expect(r.monthlyPnL[2].trades).toBe(2);
    expect(r.monthlyPnL[1].trades).toBe(0);
    expect(r.netPnL).toBe(300);
    // The month walk ends at the year's total.
    expect(r.cumByMonth[11]).toBe(300);
  });

  it('files a trade under the month it was closed, not opened', () => {
    const r = useYearlyReview(
      [mk('1', `${Y}-01-31T22:00:00`, 80, 1)], // opened Jan 31, closed Feb 2
      Y
    );
    // entry 2026-01-31T22:00, exit 2026-02-02T10:00
    const r2 = useYearlyReview(
      [{ ...mk('1', `${Y}-01-31T22:00:00`, 80), exit_time: `${Y}-02-02T10:00:00` }],
      Y
    );
    expect(r.monthlyPnL[0].trades).toBe(1);
    expect(r2.monthlyPnL[0].trades).toBe(0);
    expect(r2.monthlyPnL[1].value).toBe(80);
  });

  it('computes win rate and total R', () => {
    const r = useYearlyReview(
      [
        mk('1', `${Y}-02-05T09:00:00`, 100, 2),
        mk('2', `${Y}-02-06T09:00:00`, -60, -1),
        mk('3', `${Y}-02-07T09:00:00`, 40, 0.5),
      ],
      Y
    );
    expect(r.trades).toBe(3);
    expect(r.winRate).toBeCloseTo(66.7, 1);
    expect(r.totalR).toBeCloseTo(1.5, 2);
  });

  it('names best and worst months among traded months only', () => {
    const r = useYearlyReview(
      [
        mk('1', `${Y}-03-05T09:00:00`, 300),
        mk('2', `${Y}-05-05T09:00:00`, -120),
      ],
      Y
    );
    // January and February hold no trade: neither may carry a verdict.
    expect(r.bestMonth?.month).toBe(2);
    expect(r.worstMonth?.month).toBe(4);
  });

  it('counts streaks across untouched months', () => {
    const r = useYearlyReview(
      [
        mk('1', `${Y}-01-05T09:00:00`, 50),
        // February empty: a summer-break-style gap must not snap the run.
        mk('2', `${Y}-03-05T09:00:00`, 70),
        mk('3', `${Y}-04-05T09:00:00`, -30),
      ],
      Y
    );
    expect(r.bestStreak).toBe(2);
    expect(r.worstStreak).toBe(1);
  });

  it('accumulates the curve per trading day', () => {
    const r = useYearlyReview(
      [
        mk('1', `${Y}-01-05T09:00:00`, 100),
        mk('2', `${Y}-01-05T15:00:00`, -30), // same day: one point
        mk('3', `${Y}-01-07T09:00:00`, 60),
      ],
      Y
    );
    expect(r.cumPnL).toEqual([70, 130]);
  });

  it('guards the arrows: no year before the journal, none after the live year', () => {
    // Journal starts this year: no year before it.
    const r = useYearlyReview([mk('1', `${Y}-02-05T09:00:00`, 100)], Y);
    expect(r.canGoPrev).toBe(false);
    expect(r.canGoNext).toBe(false); // live year

    const rPast = useYearlyReview(
      [
        mk('1', `${Y - 1}-02-05T09:00:00`, 100),
        mk('2', `${Y}-02-05T09:00:00`, 100),
      ],
      Y - 1
    );
    expect(rPast.canGoPrev).toBe(false); // journal starts in the reviewed year
    expect(rPast.canGoNext).toBe(true);

    const rLast = useYearlyReview(
      [
        mk('1', `${Y - 2}-02-05T09:00:00`, 100),
        mk('2', `${Y - 1}-02-05T09:00:00`, 100),
      ],
      Y - 1
    );
    expect(rLast.canGoPrev).toBe(true);
  });

  it('reports an empty year without crashing', () => {
    const r = useYearlyReview([mk('1', `${Y - 3}-02-05T09:00:00`, 100)], Y);
    expect(r.hasData).toBe(false);
    expect(r.bestMonth).toBeNull();
    expect(r.worstMonth).toBeNull();
    expect(r.cumPnL).toEqual([]);
    expect(r.cumByMonth).toHaveLength(12);
  });
});
