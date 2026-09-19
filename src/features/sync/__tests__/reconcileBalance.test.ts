import {
  journalBalance,
  reconcileBalance,
  TOLERANCE_ABS,
} from '../reconcileBalance';
import type { Trade, TradingAccount } from '../../../types/domain';

function account(over: Partial<TradingAccount> = {}): TradingAccount {
  return {
    id: 'acc1',
    user_id: 'u',
    name: 'Main',
    type: 'personal',
    balance: 10000,
    initial_balance: 10000,
    currency: 'USD',
    created_at: '2026-01-01T00:00:00Z',
    ...over,
  } as unknown as TradingAccount;
}

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'acc1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2410,
    size: 1,
    entry_time: '2026-03-12T09:00:00',
    exit_time: '2026-03-12T11:00:00',
    pnl: 100,
    r_multiple: 1,
    created_at: '2026-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

describe('journalBalance', () => {
  it('is starting capital plus realised P&L', () => {
    const trades = [trade({ id: 'a', pnl: 250 }), trade({ id: 'b', pnl: -80 })];
    expect(journalBalance(account(), trades)).toBe(10170);
  });

  it('excludes open positions, because the broker balance excludes them too', () => {
    // Counting unrealised P&L here would manufacture a gap on every open
    // position; that is what equity is for.
    const trades = [trade({ id: 'a', pnl: 250 }), trade({ id: 'b', pnl: null as never })];
    expect(journalBalance(account(), trades)).toBe(10250);
  });

  it('applies declared cash movements', () => {
    expect(journalBalance(account(), [], 500)).toBe(10500);
    expect(journalBalance(account(), [], -2000)).toBe(8000);
  });

  it('returns null without an account or a starting capital', () => {
    expect(journalBalance(null, [])).toBeNull();
    expect(journalBalance(account({ initial_balance: null as never }), [])).toBeNull();
  });
});

describe('reconcileBalance — unknown is not agreement', () => {
  it('reports unknown when the broker has never reported', () => {
    // An older EA, or a connector that has not beaten yet. Claiming a match
    // on data we do not have would be worse than showing nothing.
    const r = reconcileBalance({ account: account(), trades: [trade()] });
    expect(r.verdict).toBe('unknown');
    expect(r.difference).toBeNull();
  });

  it('reports unknown when the balance is not a finite number', () => {
    for (const bad of [null, undefined, NaN, Infinity]) {
      const r = reconcileBalance({
        account: account(),
        trades: [],
        brokerBalance: bad as never,
      });
      expect(r.verdict).toBe('unknown');
    }
  });

  it('reports unknown without an account rather than guessing', () => {
    const r = reconcileBalance({ account: null, trades: [], brokerBalance: 10000 });
    expect(r.verdict).toBe('unknown');
  });
});

describe('reconcileBalance — tolerance', () => {
  it('matches on an exact agreement', () => {
    const r = reconcileBalance({
      account: account(),
      trades: [trade({ pnl: 100 })],
      brokerBalance: 10100,
    });
    expect(r.verdict).toBe('match');
    expect(r.difference).toBe(0);
    expect(r.hints).toEqual([]);
  });

  it('ignores a rounding-sized gap', () => {
    const r = reconcileBalance({
      account: account(),
      trades: [trade({ pnl: 100 })],
      brokerBalance: 10100 + TOLERANCE_ABS / 2,
    });
    expect(r.verdict).toBe('match');
  });

  it('scales with account size: 5 on a small account is a gap', () => {
    // The whole point of having both an absolute floor and a percentage.
    const small = reconcileBalance({
      account: account({ initial_balance: 200, balance: 200 }),
      trades: [],
      brokerBalance: 195,
    });
    expect(small.verdict).toBe('journal_high');
  });

  it('scales with account size: 5 on a large account is noise', () => {
    const large = reconcileBalance({
      account: account({ initial_balance: 100000, balance: 100000 }),
      trades: [],
      brokerBalance: 99995,
    });
    expect(large.verdict).toBe('match');
  });
});

describe('reconcileBalance — direction and causes', () => {
  it('flags journal_low when the broker is richer', () => {
    // The journal has not recorded something: the case that matters most.
    const r = reconcileBalance({
      account: account(),
      trades: [trade({ pnl: 100 })],
      brokerBalance: 10600,
    });
    expect(r.verdict).toBe('journal_low');
    expect(r.difference).toBe(500);
    expect(r.hints[0]).toBe('missing_trades');
  });

  it('flags journal_high when the journal is richer', () => {
    const r = reconcileBalance({
      account: account(),
      trades: [trade({ pnl: 100 })],
      brokerBalance: 9800,
    });
    expect(r.verdict).toBe('journal_high');
    expect(r.difference).toBe(-300);
    expect(r.hints[0]).toBe('uncaptured_costs');
  });

  it('always offers cash movement as a cause, in both directions', () => {
    // A deposit or withdrawal is the commonest innocent explanation, and the
    // app cannot distinguish it from a missing trade.
    for (const broker of [10600, 9600]) {
      const r = reconcileBalance({
        account: account(),
        trades: [trade({ pnl: 100 })],
        brokerBalance: broker,
      });
      expect(r.hints).toContain('cash_movement');
    }
  });

  it('mentions open positions when some are running', () => {
    const r = reconcileBalance({
      account: account(),
      trades: [trade({ id: 'a', pnl: 100 }), trade({ id: 'b', pnl: null as never })],
      brokerBalance: 10600,
    });
    expect(r.hints).toContain('open_positions');
  });

  it('offers no cause at all when the numbers agree', () => {
    const r = reconcileBalance({
      account: account(),
      trades: [trade({ pnl: 100 })],
      brokerBalance: 10100,
    });
    expect(r.hints).toEqual([]);
  });
});

describe('reconcileBalance — reporting', () => {
  it('reports drift as a fraction of the broker balance', () => {
    const r = reconcileBalance({
      account: account(),
      trades: [],
      brokerBalance: 11000,
    });
    // 1000 out of 11000.
    expect(r.driftPct).toBeCloseTo(0.0909, 3);
  });

  it('carries the timestamp so the card can say how fresh it is', () => {
    const at = '2026-09-18T10:00:00.000Z';
    expect(
      reconcileBalance({ account: account(), trades: [], brokerBalance: 10000, brokerAt: at })
        .brokerAt
    ).toBe(at);
  });

  it('survives a zero broker balance without dividing by zero', () => {
    const r = reconcileBalance({
      account: account({ initial_balance: 0, balance: 0 }),
      trades: [trade({ pnl: -100 })],
      brokerBalance: 0,
    });
    expect(Number.isFinite(r.driftPct as number)).toBe(true);
  });

  it('never throws on an empty journal', () => {
    expect(() =>
      reconcileBalance({ account: account(), trades: [], brokerBalance: 10000 })
    ).not.toThrow();
  });
});
