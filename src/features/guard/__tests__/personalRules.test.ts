import {
  evaluatePersonalRules,
  losingStreak,
  todaysTrades,
} from '../personalRules';
import type { Trade, TradingAccount } from '../../../types/domain';

const ACCOUNT_ID = 'acc-1';

function account(over: Partial<TradingAccount> = {}): TradingAccount {
  return {
    id: ACCOUNT_ID,
    user_id: 'u',
    name: 'Perso',
    type: 'personal',
    balance: 10000,
    initial_balance: 10000,
    currency: 'USD',
    is_active: true,
    max_daily_loss_limit: null,
    created_at: '2025-01-01T00:00:00Z',
    ...over,
  } as TradingAccount;
}

/** `hoursAgo` keeps every trade inside the device-local day the test runs in. */
function trade(over: Partial<Trade> = {}, hoursAgo = 1): Trade {
  const d = new Date();
  d.setHours(d.getHours() - hoursAgo);
  return {
    id: Math.random().toString(36).slice(2),
    user_id: 'u',
    account_id: ACCOUNT_ID,
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 100,
    exit_price: 110,
    stop_loss: 90,
    take_profit: 130,
    size: 1,
    entry_time: d.toISOString(),
    exit_time: d.toISOString(),
    pnl: 10,
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
    created_at: d.toISOString(),
    ...over,
  } as Trade;
}

describe('todaysTrades', () => {
  it('keeps only trades on the given account', () => {
    const list = [trade(), trade({ account_id: 'other' })];
    expect(todaysTrades(list, ACCOUNT_ID)).toHaveLength(1);
  });

  it('excludes trades from previous days', () => {
    // 48h ago is unambiguously another local day whatever the timezone.
    expect(todaysTrades([trade({}, 48)], ACCOUNT_ID)).toHaveLength(0);
  });
});

describe('losingStreak', () => {
  it('counts consecutive losses back from the most recent trade', () => {
    const list = [
      trade({ pnl: -5 }, 1),
      trade({ pnl: -5 }, 2),
      trade({ pnl: 20 }, 3),
    ];
    expect(losingStreak(list)).toBe(2);
  });

  it('is reset by the most recent trade being a win', () => {
    const list = [trade({ pnl: 20 }, 1), trade({ pnl: -5 }, 2)];
    expect(losingStreak(list)).toBe(0);
  });

  it('ignores open trades rather than letting them reset the streak', () => {
    // An unresolved position is not a win; treating it as one would clear a
    // streak that is still running and unlock a tilting session.
    const list = [
      trade({ pnl: null, exit_price: null }, 1),
      trade({ pnl: -5 }, 2),
      trade({ pnl: -5 }, 3),
    ];
    expect(losingStreak(list)).toBe(2);
  });

  it('treats a breakeven trade as breaking the streak', () => {
    const list = [trade({ pnl: 0 }, 1), trade({ pnl: -5 }, 2)];
    expect(losingStreak(list)).toBe(0);
  });

  it('is 0 for no trades', () => {
    expect(losingStreak([])).toBe(0);
  });
});

describe('evaluatePersonalRules', () => {
  it('reports no rules when none are configured', () => {
    const s = evaluatePersonalRules([trade()], account());
    expect(s.hasRules).toBe(false);
    expect(s.breach).toBeNull();
  });

  it('never fires a rule that is not set', () => {
    // 50 trades but no cap configured: the trader chose not to be limited.
    const list = Array.from({ length: 50 }, () => trade());
    expect(evaluatePersonalRules(list, account()).breach).toBeNull();
  });

  it('breaches once the daily trade cap is reached', () => {
    const list = [trade(), trade(), trade()];
    const s = evaluatePersonalRules(list, account({ max_trades_per_day: 3 }));
    expect(s.breach).toEqual({ code: 'MAX_TRADES_PER_DAY', count: 3, limit: 3 });
  });

  it('does not breach below the cap', () => {
    const s = evaluatePersonalRules([trade(), trade()], account({ max_trades_per_day: 3 }));
    expect(s.breach).toBeNull();
    expect(s.tradesToday).toBe(2);
  });

  it('counts only the current day towards the cap', () => {
    // Yesterday's trades must not consume today's allowance.
    const list = [trade({}, 48), trade({}, 49), trade()];
    const s = evaluatePersonalRules(list, account({ max_trades_per_day: 3 }));
    expect(s.tradesToday).toBe(1);
    expect(s.breach).toBeNull();
  });

  it('breaches on a losing streak', () => {
    const list = [trade({ pnl: -5 }, 1), trade({ pnl: -5 }, 2)];
    const s = evaluatePersonalRules(list, account({ max_consecutive_losses: 2 }));
    expect(s.breach).toEqual({ code: 'MAX_CONSECUTIVE_LOSSES', count: 2, limit: 2 });
  });

  it('prioritises the trade cap over the streak, matching the SQL', () => {
    // Both rules are breached; the client must name the same one the server
    // stored, otherwise the screen and the lock disagree.
    const list = [trade({ pnl: -5 }, 1), trade({ pnl: -5 }, 2)];
    const s = evaluatePersonalRules(
      list,
      account({ max_trades_per_day: 2, max_consecutive_losses: 2 })
    );
    expect(s.breach?.code).toBe('MAX_TRADES_PER_DAY');
  });

  it('breaches when a planned trade risks more than allowed', () => {
    const s = evaluatePersonalRules([], account({ max_risk_per_trade_pct: 1 }), 2.5);
    expect(s.breach).toEqual({ code: 'MAX_RISK_PER_TRADE', count: 2.5, limit: 1 });
  });

  it('allows a planned trade exactly at the limit', () => {
    // The rule is "max 1%", so 1% itself is compliant.
    const s = evaluatePersonalRules([], account({ max_risk_per_trade_pct: 1 }), 1);
    expect(s.breach).toBeNull();
  });

  it('ignores the risk rule when no trade is being planned', () => {
    const s = evaluatePersonalRules([], account({ max_risk_per_trade_pct: 1 }), null);
    expect(s.breach).toBeNull();
    expect(s.hasRules).toBe(true);
  });

  it('treats a non-positive limit as unset rather than locking forever', () => {
    // A cap of 0 would make every day instantly breached; the schema rejects
    // it, and the client refuses to honour it if one ever slips through.
    const s = evaluatePersonalRules([trade()], account({ max_trades_per_day: 0 }));
    expect(s.maxTradesPerDay).toBeNull();
    expect(s.breach).toBeNull();
  });

  it('applies to a personal account, not just prop accounts', () => {
    // The whole point of the change: discipline rules are not a prop-firm
    // privilege.
    const s = evaluatePersonalRules(
      [trade(), trade()],
      account({ type: 'personal', max_trades_per_day: 2 })
    );
    expect(s.breach?.code).toBe('MAX_TRADES_PER_DAY');
  });

  it('scopes rules to the selected account', () => {
    const list = [trade(), trade({ account_id: 'other' }), trade({ account_id: 'other' })];
    const s = evaluatePersonalRules(list, account({ max_trades_per_day: 2 }));
    expect(s.tradesToday).toBe(1);
    expect(s.breach).toBeNull();
  });

  it('survives a null account', () => {
    expect(() => evaluatePersonalRules([trade()], null)).not.toThrow();
    expect(evaluatePersonalRules([trade()], null).hasRules).toBe(false);
  });

  it('survives an empty trade list', () => {
    const s = evaluatePersonalRules([], account({ max_trades_per_day: 3 }));
    expect(s.tradesToday).toBe(0);
    expect(s.breach).toBeNull();
  });
});
