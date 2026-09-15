import {
  mentionsSetup,
  tradeMatchesSetup,
  computeSetupEdge,
  computeUnattributed,
  computeConfluence,
  MIN_SAMPLE,
} from '../setupAttribution';
import type { PlaybookSetup } from '../usePlaybook';
import type { Trade } from '../../../types/domain';

let seq = 0;

const setup = (title: string): PlaybookSetup => ({
  id: `s-${title}`,
  user_id: 'u1',
  title,
  description: null,
  timeframes: ['M15'],
  validation_rules: [],
  tags: [],
  image_url: null,
  created_at: '2026-01-01T00:00:00.000Z',
});

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t${seq++}`,
    user_id: 'u1',
    account_id: 'a1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2000,
    exit_price: 2010,
    stop_loss: 1990,
    take_profit: 2020,
    size: 1,
    entry_time: `2026-01-${String((seq % 27) + 1).padStart(2, '0')}T09:00:00.000Z`,
    exit_time: null,
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

describe('mentionsSetup', () => {
  it('matches a whole word regardless of case', () => {
    expect(mentionsSetup('Clean london sweep on open', 'London Sweep')).toBe(true);
  });

  it('does not match a substring inside a longer word', () => {
    // The old matcher credited every "OB" setup for a "Breakout" trade.
    expect(mentionsSetup('Textbook breakout continuation', 'OB')).toBe(false);
    expect(mentionsSetup('Fibonacci retracement', 'ob')).toBe(false);
  });

  it('tolerates surrounding punctuation', () => {
    expect(mentionsSetup('Took the (OB) retest.', 'OB')).toBe(true);
    expect(mentionsSetup('plan: FVG, then target', 'FVG')).toBe(true);
  });

  it('never matches an empty title', () => {
    expect(mentionsSetup('anything at all', '')).toBe(false);
    expect(mentionsSetup('anything at all', '   ')).toBe(false);
  });
});

describe('tradeMatchesSetup', () => {
  const s = setup('London Sweep');

  it('matches on the structured field first', () => {
    expect(tradeMatchesSetup(trade({ setup_structures: ['London Sweep'] }), s)).toBe(true);
    expect(tradeMatchesSetup(trade({ setup_structures: ['  london sweep '] }), s)).toBe(true);
  });

  it('falls back to a whole-word note mention', () => {
    expect(tradeMatchesSetup(trade({ notes: 'clean London Sweep entry' }), s)).toBe(true);
  });

  it('does not attribute a trade that merely has confirmation flags', () => {
    // Flags describe the chart, not the plan being run.
    const t = trade({ setup_fvg: true, setup_ob: true, setup_liquidity_sweep: true });
    expect(tradeMatchesSetup(t, s)).toBe(false);
  });

  it('does not hand every trade to a lone setup', () => {
    // The old code had `if (setups.length === 1) return true`, which made the
    // setup's win rate identical to the account win rate.
    const t = trade({ notes: 'random discretionary scalp' });
    expect(tradeMatchesSetup(t, s)).toBe(false);
  });
});

describe('computeSetupEdge', () => {
  const s = setup('ORB');
  const tagged = (pnl: number | null, extra: Partial<Trade> = {}) =>
    trade({ pnl, setup_structures: ['ORB'], ...extra });

  it('returns a zeroed edge when nothing matches', () => {
    const e = computeSetupEdge(s, [trade({ notes: 'unrelated' })]);
    expect(e.count).toBe(0);
    expect(e.winRate).toBe(0);
    expect(e.pnl).toBe(0);
    expect(e.equity).toEqual([]);
  });

  it('counts wins, losses and breakeven separately', () => {
    const e = computeSetupEdge(s, [tagged(100), tagged(-50), tagged(0)]);
    expect(e.wins).toBe(1);
    expect(e.losses).toBe(1);
    expect(e.breakeven).toBe(1);
    expect(e.count).toBe(3);
  });

  it('treats a breakeven trade as neither a win nor a loss in the rate', () => {
    const e = computeSetupEdge(s, [tagged(100), tagged(0)]);
    expect(e.winRate).toBe(50);
  });

  it('excludes open trades from the stats but reports them', () => {
    const e = computeSetupEdge(s, [tagged(100), tagged(null)]);
    expect(e.count).toBe(1);
    expect(e.openCount).toBe(1);
  });

  it('computes expectancy as mean P&L per closed trade', () => {
    const e = computeSetupEdge(s, [tagged(300), tagged(-100)]);
    expect(e.expectancy).toBe(100);
  });

  it('reports profit factor as 0, not Infinity, with no losses', () => {
    const e = computeSetupEdge(s, [tagged(100), tagged(200)]);
    expect(e.profitFactor).toBe(0);
    expect(Number.isFinite(e.profitFactor)).toBe(true);
  });

  it('computes profit factor from gross win over gross loss', () => {
    const e = computeSetupEdge(s, [tagged(300), tagged(-100)]);
    expect(e.profitFactor).toBe(3);
  });

  it('builds a cumulative equity series in chronological order', () => {
    const e = computeSetupEdge(s, [
      tagged(100, { entry_time: '2026-02-03T09:00:00.000Z' }),
      tagged(-40, { entry_time: '2026-02-01T09:00:00.000Z' }),
      tagged(20, { entry_time: '2026-02-02T09:00:00.000Z' }),
    ]);
    expect(e.equity).toEqual([-40, -20, 80]);
    expect(e.pnl).toBe(80);
  });

  it('flags a small sample as low confidence', () => {
    const few = Array.from({ length: MIN_SAMPLE - 1 }, () => tagged(100));
    expect(computeSetupEdge(s, few).lowConfidence).toBe(true);
    const enough = Array.from({ length: MIN_SAMPLE }, () => tagged(100));
    expect(computeSetupEdge(s, enough).lowConfidence).toBe(false);
  });

  it('tracks best and worst trade', () => {
    const e = computeSetupEdge(s, [tagged(50), tagged(430), tagged(-120)]);
    expect(e.bestTrade).toBe(430);
    expect(e.worstTrade).toBe(-120);
  });

  it('averages R only over trades that have one', () => {
    const e = computeSetupEdge(s, [
      tagged(100, { r_multiple: 2 }),
      tagged(-50, { r_multiple: -1 }),
      tagged(10, { r_multiple: null }),
    ]);
    expect(e.avgR).toBe(0.5);
  });
});

describe('computeUnattributed', () => {
  const setups = [setup('ORB'), setup('London Sweep')];

  it('splits closed trades into on-plan and off-plan', () => {
    const trades = [
      trade({ pnl: 100, setup_structures: ['ORB'] }),
      trade({ pnl: -50, setup_structures: ['London Sweep'] }),
      trade({ pnl: -200, notes: 'revenge scalp' }),
    ];
    const r = computeUnattributed(setups, trades);
    expect(r.total).toBe(3);
    expect(r.onPlan).toBe(2);
    expect(r.offPlan).toBe(1);
    expect(r.offPlanPnl).toBe(-200);
    expect(r.onPlanPnl).toBe(50);
    expect(r.adherencePct).toBeCloseTo(66.67, 1);
  });

  it('reports 100% adherence only when everything matched', () => {
    const r = computeUnattributed(setups, [trade({ pnl: 10, setup_structures: ['ORB'] })]);
    expect(r.adherencePct).toBe(100);
  });

  it('handles an empty book without dividing by zero', () => {
    const r = computeUnattributed(setups, []);
    expect(r.adherencePct).toBe(0);
    expect(r.total).toBe(0);
  });

  it('counts every trade as off-plan when no setups exist', () => {
    const r = computeUnattributed([], [trade({ pnl: 10 }), trade({ pnl: -10 })]);
    expect(r.offPlan).toBe(2);
    expect(r.adherencePct).toBe(0);
  });
});

describe('computeConfluence', () => {
  it('scores each flag independently over closed trades', () => {
    const trades = [
      trade({ pnl: 100, setup_fvg: true }),
      trade({ pnl: -50, setup_fvg: true, setup_ob: true }),
      trade({ pnl: 200, setup_ob: true }),
      trade({ pnl: null, setup_ob: true }),
    ];
    const [fvg, ob, sweep] = computeConfluence(trades);
    expect(fvg.count).toBe(2);
    expect(fvg.winRate).toBe(50);
    expect(fvg.pnl).toBe(50);
    expect(ob.count).toBe(2); // the open one is excluded
    expect(ob.pnl).toBe(150);
    expect(sweep.count).toBe(0);
    expect(sweep.winRate).toBe(0);
  });
});
