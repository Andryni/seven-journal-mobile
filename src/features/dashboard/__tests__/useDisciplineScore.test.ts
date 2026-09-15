import { computeDisciplineScore } from '../useDisciplineScore';
import type { Trade } from '../../../types/domain';

const base: Trade = {
  id: '1',
  user_id: 'u',
  account_id: 'a',
  pair: 'XAUUSD',
  direction: 'BUY',
  entry_price: 2000,
  exit_price: 2010,
  stop_loss: 1995,
  take_profit: 2020,
  size: 1,
  entry_time: '2026-01-01T10:00:00Z',
  exit_time: '2026-01-01T11:00:00Z',
  pnl: 100,
  r_multiple: 2,
  timeframe: 'M15',
  setup_structures: ['BOS'],
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
  created_at: '2026-01-01T10:00:00Z',
};

const make = (overrides: Partial<Trade>[], n = overrides.length): Trade[] =>
  Array.from({ length: n }, (_, i) => ({
    ...base,
    id: String(i),
    ...(overrides[i] ?? overrides[0] ?? {}),
  }));

const run = (trades: Trade[]) => computeDisciplineScore(trades);

describe('computeDisciplineScore', () => {
  it('returns a zeroed D grade with no trades', () => {
    const r = run([]);
    expect(r.score).toBe(0);
    expect(r.grade).toBe('D');
    expect(r.sampleSize).toBe(0);
  });

  it('awards a perfect score to disciplined, identical trades', () => {
    const r = run(make([{}], 10));
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
  });

  it('penalises missing stop losses', () => {
    const r = run(make([{ stop_loss: 0 }], 4));
    const risk = r.components.find(c => c.id === 'risk')!;
    expect(risk.score).toBe(0);
    expect(risk.detail).toBe('0/4');
  });

  it('penalises trades taken without a setup', () => {
    const r = run(
      make([{ setup_structures: [], setup_fvg: false, setup_ob: false, setup_liquidity_sweep: false }], 5)
    );
    expect(r.components.find(c => c.id === 'plan')!.score).toBe(0);
  });

  it('credits the plan when any single setup flag is set', () => {
    const r = run(make([{ setup_structures: [], setup_ob: true }], 3));
    expect(r.components.find(c => c.id === 'plan')!.score).toBe(100);
  });

  it('penalises erratic position sizing', () => {
    const trades = [
      { ...base, id: '1', size: 0.1 },
      { ...base, id: '2', size: 5 },
      { ...base, id: '3', size: 0.2 },
      { ...base, id: '4', size: 9 },
    ];
    const steady = run(make([{ size: 1 }], 4));
    const erratic = run(trades);
    expect(erratic.components.find(c => c.id === 'sizing')!.score).toBeLessThan(
      steady.components.find(c => c.id === 'sizing')!.score
    );
  });

  it('flags tilted mental states', () => {
    const r = run([
      { ...base, id: '1', mental_state: 'revenge' },
      { ...base, id: '2', mental_state: 'fomo' },
      { ...base, id: '3', mental_state: 'focused' },
      { ...base, id: '4', mental_state: 'focused' },
    ]);
    const rev = r.components.find(c => c.id === 'revenge')!;
    expect(rev.score).toBe(50);
    expect(rev.detail).toBe('2 tilt');
  });

  it('is independent of P&L — losing but disciplined still scores A', () => {
    const r = run(make([{ pnl: -500, result: 'SL' }], 8));
    expect(r.grade).toBe('A');
  });

  it('maps scores onto grade boundaries', () => {
    expect(run(make([{}], 5)).grade).toBe('A');
    const bad = run(
      make([{ stop_loss: 0, setup_structures: [], mental_state: 'revenge' }], 5)
    );
    expect(bad.grade).toBe('D');
  });
});
