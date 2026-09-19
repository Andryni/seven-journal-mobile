import { detectBehaviour } from '../behaviour';
import type { Trade } from '../../../types/domain';

function trade(over: Partial<Trade> & { id: string }): Trade {
  const now = Date.now();
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
    entry_time: new Date(now - 3600_000).toISOString(),
    exit_time: new Date(now - 3500_000).toISOString(),
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
    created_at: new Date(now).toISOString(),
    ...over,
  };
}

describe('detectBehaviour', () => {
  it('flags a same-pair re-entry within the window after a loss with a bigger size', () => {
    const t0 = Date.now();
    const loser = trade({
      id: 'l1',
      pnl: -100,
      size: 1,
      result: 'SL',
      exit_time: new Date(t0 - 10 * 60000).toISOString(),
      entry_time: new Date(t0 - 70 * 60000).toISOString(),
    });
    const reentry = trade({
      id: 'r1',
      size: 1.5,
      pnl: -50,
      entry_time: new Date(t0 - 6 * 60000).toISOString(),
      exit_time: new Date(t0 - 5 * 60000).toISOString(),
    });
    const r = detectBehaviour({
      trades: [loser, reentry],
      window: [loser, reentry],
    });
    expect(r.revenge).toHaveLength(1);
    expect(r.revenge[0].triggerN).toBe(1);
    expect(r.revenge[0].reactions[0].n).toBe(2);
    expect(r.revenge[0].reactions[0].minutesAfter).toBe(4);
    expect(r.revenge[0].extraPnl).toBe(-50);
  });

  it('stays silent when the re-entry is smaller', () => {
    const t0 = Date.now();
    const loser = trade({
      id: 'l1',
      pnl: -100,
      size: 2,
      exit_time: new Date(t0 - 10 * 60000).toISOString(),
    });
    const smaller = trade({ id: 'r1', size: 1, entry_time: new Date(t0 - 5 * 60000).toISOString() });
    const r = detectBehaviour({ trades: [loser, smaller], window: [loser, smaller] });
    expect(r.revenge).toHaveLength(0);
  });

  it('drops findings for trades outside the sent window', () => {
    const t0 = Date.now();
    const loser = trade({ id: 'l1', pnl: -100, exit_time: new Date(t0 - 10 * 60000).toISOString() });
    const reentry = trade({ id: 'r1', size: 2, entry_time: new Date(t0 - 5 * 60000).toISOString() });
    const r = detectBehaviour({ trades: [loser, reentry], window: [loser] });
    expect(r.revenge).toHaveLength(0);
  });

  it('flags overtrading only against the personal rule', () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 9, 0);
    const mk = (i: number) =>
      trade({
        id: `d${i}`,
        entry_time: new Date(start.getTime() + i * 30 * 60000).toISOString(),
        exit_time: new Date(start.getTime() + i * 30 * 60000 + 15 * 60000).toISOString(),
        pnl: i % 2 === 0 ? 50 : -30,
      });
    const trades = [0, 1, 2, 3].map(mk);
    const account = {
      id: 'a', user_id: 'u', name: 'A', type: 'funded' as const, balance: 0,
      initial_balance: 0, currency: 'USD', is_active: true,
      max_daily_loss_limit: null, created_at: '', max_trades_per_day: 3,
    };
    const withRule = detectBehaviour({ trades, window: trades, account });
    expect(withRule.overtrading).toHaveLength(1);
    expect(withRule.overtrading[0].trades).toBe(4);
    expect(withRule.overtrading[0].limit).toBe(3);

    const withoutRule = detectBehaviour({ trades, window: trades, account: null });
    expect(withoutRule.overtrading).toHaveLength(0);
  });

  it('flags entries within 30 minutes of a matching-currency event, not others', () => {
    const eventAt = new Date(Date.now() - 20 * 60000).toISOString();
    const near = trade({ id: 'n1', pair: 'EURUSD', entry_time: new Date(new Date(eventAt).getTime() + 10 * 60000).toISOString() });
    const far = trade({ id: 'f1', pair: 'XAUUSD', entry_time: new Date(new Date(eventAt).getTime() + 10 * 60000).toISOString() });
    const events = [
      { title: 'CPI', currency: 'EUR', at: eventAt, impact: 'High' as const, forecast: null, previous: null },
    ];
    const r = detectBehaviour({ trades: [near, far], window: [near, far], events });
    expect(r.news).toHaveLength(1);
    expect(r.news[0].n).toBe(1);
    expect(r.news[0].eventCurrency).toBe('EUR');
  });
});
