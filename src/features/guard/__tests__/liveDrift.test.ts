import {
  openPositions,
  openedToday,
  losingStreakToday,
  evaluateLiveDrift,
} from '../liveDrift';
import type { Trade, TradingAccount } from '../../../types/domain';
import type { SyncTradeRow } from '../../sync/normalize';

const NOW = new Date(2026, 8, 16, 14, 0, 0);

const iso = (h: number, day = 16) =>
  new Date(2026, 8, day, h, 0, 0).toISOString();

function account(over: Partial<TradingAccount> = {}): TradingAccount {
  return {
    id: 'acc1',
    user_id: 'u',
    name: 'Main',
    type: 'personal',
    balance: 10000,
    initial_balance: 10000,
    currency: 'USD',
    max_trades_per_day: 3,
    max_consecutive_losses: 2,
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
    entry_time: iso(9),
    exit_time: iso(10),
    pnl: 100,
    r_multiple: 1,
    created_at: iso(9),
    ...over,
  } as unknown as Trade;
}

function staged(over: Partial<SyncTradeRow> = {}): SyncTradeRow {
  return {
    id: 's1',
    external_id: 'p1',
    payload: { symbol: 'XAUUSD' },
    is_open: true,
    open_time: iso(13),
    close_time: null,
    status: 'pending',
    created_at: iso(13),
    ...over,
  } as SyncTradeRow;
}

describe('openPositions', () => {
  it('keeps only what the broker reports as open', () => {
    const rows = [staged(), staged({ id: 's2', is_open: false })];
    expect(openPositions(rows).map(r => r.id)).toEqual(['s1']);
  });

  it('survives an empty or missing list', () => {
    expect(openPositions([])).toEqual([]);
    expect(openPositions(undefined as never)).toEqual([]);
  });
});

describe('openedToday', () => {
  it('uses the broker open_time, not the ingest time', () => {
    // A row can arrive late -- EA reconnects, history is replayed. Counting
    // it by created_at would warn about a position from last week.
    const oldPosition = staged({
      id: 'old',
      open_time: iso(10, 9),
      created_at: iso(13),
    });
    expect(openedToday([oldPosition], NOW)).toEqual([]);
  });

  it('counts a position opened earlier today', () => {
    expect(openedToday([staged()], NOW)).toHaveLength(1);
  });

  it('ignores a row with no usable open_time', () => {
    expect(openedToday([staged({ open_time: null })], NOW)).toEqual([]);
    expect(openedToday([staged({ open_time: 'nonsense' })], NOW)).toEqual([]);
  });
});

describe('losingStreakToday', () => {
  it('counts consecutive losses at the end of the day', () => {
    const trades = [
      trade({ id: 'a', pnl: 100, exit_time: iso(9) }),
      trade({ id: 'b', pnl: -50, exit_time: iso(10) }),
      trade({ id: 'c', pnl: -60, exit_time: iso(11) }),
    ];
    expect(losingStreakToday(trades, 'acc1', NOW)).toBe(2);
  });

  it('resets on a win', () => {
    const trades = [
      trade({ id: 'a', pnl: -50, exit_time: iso(9) }),
      trade({ id: 'b', pnl: 100, exit_time: iso(11) }),
    ];
    expect(losingStreakToday(trades, 'acc1', NOW)).toBe(0);
  });

  it('skips a scratch without breaking the streak', () => {
    // A breakeven is neither a loss nor a recovery, matching personalRules.
    const trades = [
      trade({ id: 'a', pnl: -50, exit_time: iso(9) }),
      trade({ id: 'b', pnl: 0, exit_time: iso(10) }),
      trade({ id: 'c', pnl: -30, exit_time: iso(11) }),
    ];
    expect(losingStreakToday(trades, 'acc1', NOW)).toBe(2);
  });

  it('ignores other accounts', () => {
    const trades = [trade({ id: 'x', account_id: 'other', pnl: -50 })];
    expect(losingStreakToday(trades, 'acc1', NOW)).toBe(0);
  });
});

describe('evaluateLiveDrift — trade count', () => {
  it('counts open positions alongside closed ones', () => {
    // The whole point: three closed and one still open is four taken today.
    // The old guard only saw the journal, so the fourth was invisible until
    // it was written down -- by which time it was already running.
    const trades = [
      trade({ id: 'a', pnl: 10 }),
      trade({ id: 'b', pnl: 20 }),
      trade({ id: 'c', pnl: -5 }),
    ];
    const alert = evaluateLiveDrift({
      trades,
      staging: [staged()],
      account: account({ max_trades_per_day: 3 }),
      now: NOW,
    });
    expect(alert?.code).toBe('MAX_TRADES_PER_DAY');
    expect(alert?.count).toBe(4);
    expect(alert?.limit).toBe(3);
  });

  it('stays silent exactly at the limit', () => {
    // Three trades against a limit of three is compliance, not a breach.
    const trades = [trade({ id: 'a' }), trade({ id: 'b' }), trade({ id: 'c' })];
    expect(
      evaluateLiveDrift({
        trades,
        staging: [],
        account: account({ max_trades_per_day: 3 }),
        now: NOW,
      })
    ).toBeNull();
  });

  it('ignores yesterday', () => {
    const trades = [
      trade({ id: 'a', entry_time: iso(9, 15), exit_time: iso(10, 15) }),
      trade({ id: 'b', entry_time: iso(11, 15), exit_time: iso(12, 15) }),
      trade({ id: 'c', entry_time: iso(13, 15), exit_time: iso(14, 15) }),
      trade({ id: 'd', entry_time: iso(15, 15), exit_time: iso(16, 15) }),
    ];
    expect(
      evaluateLiveDrift({
        trades,
        staging: [],
        account: account({ max_trades_per_day: 3 }),
        now: NOW,
      })
    ).toBeNull();
  });

  it('says nothing when no rule is configured', () => {
    const trades = Array.from({ length: 9 }, (_, i) => trade({ id: `t${i}` }));
    expect(
      evaluateLiveDrift({
        trades,
        staging: [staged()],
        account: account({ max_trades_per_day: null, max_consecutive_losses: null }),
        now: NOW,
      })
    ).toBeNull();
  });
});

describe('evaluateLiveDrift — losing streak', () => {
  const losing = [
    trade({ id: 'a', pnl: -50, exit_time: iso(10) }),
    trade({ id: 'b', pnl: -60, exit_time: iso(11) }),
  ];

  it('fires while a position is open against the rule', () => {
    const alert = evaluateLiveDrift({
      trades: losing,
      staging: [staged()],
      account: account({ max_trades_per_day: null, max_consecutive_losses: 2 }),
      now: NOW,
    });
    expect(alert?.code).toBe('MAX_CONSECUTIVE_LOSSES');
    expect(alert?.count).toBe(2);
  });

  it('stays silent when nothing is open', () => {
    // With no live position the trader has already stopped; saying it then is
    // a debrief, and the debrief screen already does that.
    expect(
      evaluateLiveDrift({
        trades: losing,
        staging: [],
        account: account({ max_trades_per_day: null, max_consecutive_losses: 2 }),
        now: NOW,
      })
    ).toBeNull();
  });
});

describe('evaluateLiveDrift — behaviour', () => {
  it('raises one alert at a time even when two rules are broken', () => {
    // Three warnings are three things to dismiss, and a trader who dismisses
    // one stops reading the next.
    const trades = [
      trade({ id: 'a', pnl: -50, exit_time: iso(9) }),
      trade({ id: 'b', pnl: -60, exit_time: iso(10) }),
      trade({ id: 'c', pnl: -20, exit_time: iso(11) }),
    ];
    const alert = evaluateLiveDrift({
      trades,
      staging: [staged()],
      account: account({ max_trades_per_day: 3, max_consecutive_losses: 2 }),
      now: NOW,
    });
    expect(alert).not.toBeNull();
    expect(typeof alert!.code).toBe('string');
  });

  it('gives a stable key so the same fact is not announced twice', () => {
    const input = {
      trades: [trade({ id: 'a' }), trade({ id: 'b' }), trade({ id: 'c' })],
      staging: [staged()],
      account: account({ max_trades_per_day: 3 }),
      now: NOW,
    };
    expect(evaluateLiveDrift(input)!.key).toBe(evaluateLiveDrift(input)!.key);
  });

  it('changes the key when the count moves on', () => {
    // Crossing 4 and then 5 are two distinct facts worth saying.
    const base = [trade({ id: 'a' }), trade({ id: 'b' }), trade({ id: 'c' })];
    const four = evaluateLiveDrift({
      trades: base,
      staging: [staged()],
      account: account({ max_trades_per_day: 3 }),
      now: NOW,
    })!;
    const five = evaluateLiveDrift({
      trades: [...base, trade({ id: 'd' })],
      staging: [staged()],
      account: account({ max_trades_per_day: 3 }),
      now: NOW,
    })!;
    expect(four.key).not.toBe(five.key);
  });

  it('returns null without an account rather than guessing', () => {
    expect(
      evaluateLiveDrift({ trades: [], staging: [staged()], account: null, now: NOW })
    ).toBeNull();
  });

  it('never throws on empty input', () => {
    expect(() =>
      evaluateLiveDrift({ trades: [], staging: [], account: account(), now: NOW })
    ).not.toThrow();
  });
});
