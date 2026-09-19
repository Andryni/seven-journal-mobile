import { buildWeeklyReport } from '../weeklyReport';
import type { Trade } from '../../../types/domain';

function trade(over: Partial<Trade> & { id: string }): Trade {
  return {
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2410,
    stop_loss: 2395,
    take_profit: 2420,
    size: 1,
    entry_time: new Date().toISOString(),
    exit_time: new Date().toISOString(),
    pnl: 100,
    r_multiple: 2,
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
    created_at: new Date().toISOString(),
    ...over,
  };
}

const daysAgo = (n: number, h = 12) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(h, 0, 0, 0);
  return d.toISOString();
};

describe('buildWeeklyReport', () => {
  it('includes only trades closed within the last 7 local days', () => {
    const recent = trade({ id: 'a', exit_time: daysAgo(2), pnl: 100, r_multiple: 2 });
    const old = trade({ id: 'b', exit_time: daysAgo(20), pnl: -500, r_multiple: -3 });
    const r = buildWeeklyReport([recent, old]);
    expect(r.trades).toBe(1);
    expect(r.netPnl).toBe(100);
  });

  it('attributes R by setup and session with honest samples', () => {
    const t1 = trade({ id: 'a', setup_structures: ['FVG'], session: 'London', r_multiple: 2, pnl: 200 });
    const t2 = trade({ id: 'b', setup_structures: ['FVG'], session: 'London', r_multiple: -1, pnl: -100 });
    const t3 = trade({ id: 'c', setup_structures: ['OB'], session: 'New York', r_multiple: 1, pnl: 80 });
    const r = buildWeeklyReport([t1, t2, t3]);
    const fvg = r.bySetup.find(b => b.label === 'FVG');
    expect(fvg?.totalR).toBe(1);
    expect(fvg?.rSample).toBe(2);
    const lon = r.bySession.find(b => b.label === 'London');
    expect(lon?.trades).toBe(2);
  });

  it('demands fillGaps when the week is incomplete', () => {
    const t1 = trade({ id: 'a', notes: null, mental_state: 'focused', r_multiple: null });
    const r = buildWeeklyReport([t1]);
    expect(r.incomplete).toBeGreaterThan(0);
    expect(r.actions.map(a => a.key)).toContain('fillGaps');
  });

  it('returns noAction rather than inventing one on a clean thin week', () => {
    const t = trade({
      id: 'a',
      r_multiple: 2,
      notes: 'ok',
      commission: 0,
      swap: 0,
      setup_structures: ['FVG'],
      tags: ['clean'],
    });
    const r = buildWeeklyReport([t]);
    expect(r.actions).toEqual([{ key: 'noAction' }]);
  });
});
