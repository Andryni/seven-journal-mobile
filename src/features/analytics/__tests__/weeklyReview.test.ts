import type { Trade } from '../../../types/domain';

// The hook is a thin useMemo over pure logic; we exercise it through a direct
// import of the module's internals via a re-implementation-free path.
import { useWeeklyReview } from '../useWeeklyReview';

/**
 * `useWeeklyReview` only calls useMemo, which React evaluates eagerly on first
 * render. Calling it outside a component is safe here and avoids pulling in
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

// Reference "now": Wednesday 2026-01-14. Week runs Mon 12 -> Sun 18.
const NOW = new Date('2026-01-14T12:00:00');

describe('useWeeklyReview', () => {
  it('reports no data for an empty week', () => {
    const r = useWeeklyReview([], NOW);
    expect(r.hasData).toBe(false);
    expect(r.netPnL).toBe(0);
    expect(r.trades).toBe(0);
  });

  it('sums only trades inside the current Mon-Sun window', () => {
    const r = useWeeklyReview(
      [
        mk('1', '2026-01-12T09:00:00', 100), // Mon, in
        mk('2', '2026-01-14T09:00:00', 50), // Wed, in
        mk('3', '2026-01-11T09:00:00', 999), // Sun prior, out
        mk('4', '2026-01-19T09:00:00', 999), // next Mon, out
      ],
      NOW
    );
    expect(r.trades).toBe(2);
    expect(r.netPnL).toBe(150);
  });

  it('computes the delta against the previous week', () => {
    const r = useWeeklyReview(
      [
        mk('1', '2026-01-13T09:00:00', 200), // this week
        mk('2', '2026-01-06T09:00:00', 50), // previous week
      ],
      NOW
    );
    expect(r.netPnL).toBe(200);
    expect(r.deltaPnL).toBe(150);
  });

  it('excludes open trades', () => {
    const r = useWeeklyReview(
      [mk('1', '2026-01-13T09:00:00', 100), { ...mk('2', '2026-01-13T10:00:00', 0), pnl: null }],
      NOW
    );
    expect(r.trades).toBe(1);
  });

  it('ranks the best and worst setup by P&L', () => {
    const r = useWeeklyReview(
      [
        mk('1', '2026-01-13T09:00:00', 300, { setup_structures: ['BOS'] }),
        mk('2', '2026-01-13T10:00:00', -120, { setup_structures: ['CHoCH'] }),
        mk('3', '2026-01-13T11:00:00', 40, { setup_structures: ['BOS'] }),
      ],
      NOW
    );
    expect(r.bestSetup?.key).toBe('BOS');
    expect(r.bestSetup?.pnl).toBe(340);
    expect(r.bestSetup?.trades).toBe(2);
    expect(r.worstSetup?.key).toBe('CHoCH');
  });

  it('falls back to ICT flags when no structure is tagged', () => {
    const r = useWeeklyReview(
      [mk('1', '2026-01-13T09:00:00', 80, { setup_fvg: true, setup_ob: true })],
      NOW
    );
    expect(r.bestSetup?.key).toBe('FVG + OB');
  });

  it('ranks the best session', () => {
    const r = useWeeklyReview(
      [
        mk('1', '2026-01-13T09:00:00', 20, { session: 'Asia' }),
        mk('2', '2026-01-13T14:00:00', 250, { session: 'New York' }),
      ],
      NOW
    );
    expect(r.bestSession?.key).toBe('New York');
  });

  it('surfaces the most frequent tilted state', () => {
    const r = useWeeklyReview(
      [
        mk('1', '2026-01-13T09:00:00', -10, { mental_state: 'revenge' }),
        mk('2', '2026-01-13T10:00:00', -10, { mental_state: 'revenge' }),
        mk('3', '2026-01-13T11:00:00', -10, { mental_state: 'fomo' }),
        mk('4', '2026-01-13T12:00:00', 10, { mental_state: 'focused' }),
      ],
      NOW
    );
    expect(r.recurringMistake).toEqual({ state: 'revenge', count: 2 });
  });

  it('reports no recurring mistake when the week was disciplined', () => {
    const r = useWeeklyReview([mk('1', '2026-01-13T09:00:00', 10)], NOW);
    expect(r.recurringMistake).toBeNull();
  });

  it('buckets P&L into seven Monday-first days', () => {
    const r = useWeeklyReview(
      [
        mk('1', '2026-01-12T09:00:00', 100), // Mon
        mk('2', '2026-01-14T09:00:00', -40), // Wed
      ],
      NOW
    );
    expect(r.dailyPnL).toHaveLength(7);
    expect(r.dailyPnL[0]).toEqual({ label: 'LUN', value: 100 });
    expect(r.dailyPnL[2]).toEqual({ label: 'MER', value: -40 });
    expect(r.dailyPnL[1].value).toBe(0);
  });

  it('computes win rate and average R', () => {
    const r = useWeeklyReview(
      [
        mk('1', '2026-01-13T09:00:00', 100, { r_multiple: 2 }),
        mk('2', '2026-01-13T10:00:00', -50, { r_multiple: -1 }),
      ],
      NOW
    );
    expect(r.winRate).toBe(50);
    expect(r.avgR).toBe(0.5);
  });
});
