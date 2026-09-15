import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  periodRange,
  tradeDate,
  selectTrades,
  computeShareStats,
  periodLabel,
  shareFileName,
} from '../shareScope';
import type { Trade } from '../../types/domain';

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 100,
    exit_price: 110,
    size: 1,
    entry_time: '2025-03-12T09:00:00',
    exit_time: '2025-03-12T11:00:00',
    pnl: 100,
    r_multiple: 1,
    commission: 0,
    swap: 0,
    tags: [],
    created_at: '2025-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

// Wednesday 12 March 2025, local time.
const NOW = new Date(2025, 2, 12, 15, 0, 0);

describe('period boundaries', () => {
  it('starts the day at local midnight', () => {
    const d = startOfDay(NOW);
    expect(d.getHours()).toBe(0);
    expect(d.getDate()).toBe(12);
  });

  it('starts the week on Monday, not Sunday', () => {
    // A trading week runs Mon-Fri; a Sunday-first week would cut the week a
    // trader just finished in half.
    const w = startOfWeek(NOW);
    expect(w.getDay()).toBe(1);
    expect(w.getDate()).toBe(10);
  });

  it('keeps Monday itself as the start of its own week', () => {
    const monday = new Date(2025, 2, 10, 8, 0, 0);
    expect(startOfWeek(monday).getDate()).toBe(10);
  });

  it('treats Sunday as the end of the week that began on Monday', () => {
    const sunday = new Date(2025, 2, 16, 20, 0, 0);
    expect(startOfWeek(sunday).getDate()).toBe(10);
  });

  it('starts the month on the first', () => {
    expect(startOfMonth(NOW).getDate()).toBe(1);
    expect(startOfMonth(NOW).getMonth()).toBe(2);
  });

  it('crosses a year boundary correctly for the week', () => {
    // 1 Jan 2025 is a Wednesday; its week starts Mon 30 Dec 2024.
    const w = startOfWeek(new Date(2025, 0, 1, 12));
    expect(w.getFullYear()).toBe(2024);
    expect(w.getMonth()).toBe(11);
    expect(w.getDate()).toBe(30);
  });
});

describe('periodRange', () => {
  it('returns a half-open day window', () => {
    const { from, to } = periodRange('day', NOW);
    expect(from!.getDate()).toBe(12);
    expect(to!.getDate()).toBe(13);
  });

  it('returns Monday to the following Monday for a week', () => {
    const { from, to } = periodRange('week', NOW);
    expect(from!.getDate()).toBe(10);
    expect(to!.getDate()).toBe(17);
  });

  it('returns the first of next month as the exclusive end', () => {
    const { from, to } = periodRange('month', NOW);
    expect(from!.getMonth()).toBe(2);
    expect(to!.getMonth()).toBe(3);
    expect(to!.getDate()).toBe(1);
  });

  it('rolls December into January of the next year', () => {
    const { to } = periodRange('month', new Date(2025, 11, 20));
    expect(to!.getFullYear()).toBe(2026);
    expect(to!.getMonth()).toBe(0);
  });

  it('is unbounded for all and trade', () => {
    expect(periodRange('all', NOW).from).toBeNull();
    expect(periodRange('trade', NOW).to).toBeNull();
  });
});

describe('tradeDate', () => {
  it('uses the exit time: that is the day the P&L landed', () => {
    const t = trade({ entry_time: '2025-03-10T09:00:00', exit_time: '2025-03-13T16:00:00' });
    expect(tradeDate(t)!.getDate()).toBe(13);
  });

  it('falls back to entry time when a broker import omitted the exit', () => {
    const t = trade({ entry_time: '2025-03-11T09:00:00', exit_time: null as never });
    expect(tradeDate(t)!.getDate()).toBe(11);
  });

  it('returns null rather than an Invalid Date', () => {
    expect(tradeDate(trade({ entry_time: 'nonsense', exit_time: null as never }))).toBeNull();
  });
});

describe('selectTrades', () => {
  const open = trade({ id: 'open', pnl: null as never });
  const monday = trade({ id: 'mon', exit_time: '2025-03-10T12:00:00', pnl: 10 });
  const today = trade({ id: 'today', exit_time: '2025-03-12T12:00:00', pnl: 20 });
  const lastWeek = trade({ id: 'prev', exit_time: '2025-03-05T12:00:00', pnl: 30 });
  const lastMonth = trade({ id: 'feb', exit_time: '2025-02-20T12:00:00', pnl: 40 });
  const all = [open, monday, today, lastWeek, lastMonth];

  it('never includes an open position: it has no result to publish', () => {
    expect(selectTrades(all, 'all').map(t => t.id)).not.toContain('open');
  });

  it('day keeps only today', () => {
    expect(selectTrades(all, 'day', { now: NOW }).map(t => t.id)).toEqual(['today']);
  });

  it('week keeps Monday through today but drops last week', () => {
    expect(selectTrades(all, 'week', { now: NOW }).map(t => t.id)).toEqual(['mon', 'today']);
  });

  it('month keeps March and drops February', () => {
    expect(selectTrades(all, 'month', { now: NOW }).map(t => t.id)).toEqual([
      'mon',
      'today',
      'prev',
    ]);
  });

  it('trade keeps exactly the one requested', () => {
    expect(selectTrades(all, 'trade', { tradeId: 'today' }).map(t => t.id)).toEqual(['today']);
  });

  it('returns nothing for a trade period with no id rather than everything', () => {
    expect(selectTrades(all, 'trade', { now: NOW })).toEqual([]);
  });

  it('includes a trade closed at one second before midnight', () => {
    const edge = trade({ id: 'edge', exit_time: '2025-03-12T23:59:59', pnl: 5 });
    expect(selectTrades([edge], 'day', { now: NOW }).map(t => t.id)).toEqual(['edge']);
  });

  it('excludes a trade closed at midnight the next day', () => {
    const edge = trade({ id: 'edge', exit_time: '2025-03-13T00:00:00', pnl: 5 });
    expect(selectTrades([edge], 'day', { now: NOW })).toEqual([]);
  });
});

describe('computeShareStats', () => {
  it('sums net P&L and reports gross plus costs separately', () => {
    const s = computeShareStats([
      trade({ pnl: 100, commission: 7, swap: 1 }),
      trade({ pnl: -40, commission: 3, swap: 0 }),
    ]);
    expect(s.netPnl).toBe(60);
    expect(s.costs).toBe(11);
    expect(s.grossPnl).toBe(71);
  });

  it('normalises costs a broker exported as negatives', () => {
    const s = computeShareStats([trade({ pnl: 50, commission: -5, swap: -2 })]);
    expect(s.costs).toBe(7);
  });

  it('excludes breakeven trades from the win rate denominator', () => {
    // Two wins, one loss, one scratch -> 2/3, not 2/4. Cutting a trade that
    // stopped working is discipline, not a loss.
    const s = computeShareStats([
      trade({ pnl: 10 }),
      trade({ pnl: 20 }),
      trade({ pnl: -5 }),
      trade({ pnl: 0 }),
    ]);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.breakeven).toBe(1);
    expect(s.winRate).toBe(66.67);
  });

  it('reports a zero win rate for an empty window instead of NaN', () => {
    const s = computeShareStats([]);
    expect(s.winRate).toBe(0);
    expect(s.netPnl).toBe(0);
    expect(s.equity).toEqual([]);
  });

  it('builds the equity curve in closing order, not array order', () => {
    const s = computeShareStats([
      trade({ id: 'b', exit_time: '2025-03-12T15:00:00', pnl: -30 }),
      trade({ id: 'a', exit_time: '2025-03-12T09:00:00', pnl: 50 }),
    ]);
    expect(s.equity).toEqual([50, 20]);
  });

  it('tracks the best winning streak', () => {
    const s = computeShareStats([
      trade({ pnl: 10 }),
      trade({ pnl: 10 }),
      trade({ pnl: -5 }),
      trade({ pnl: 10 }),
      trade({ pnl: 10 }),
      trade({ pnl: 10 }),
    ]);
    expect(s.bestStreak).toBe(3);
  });

  it('lets a breakeven trade neither extend nor break a streak', () => {
    const s = computeShareStats([
      trade({ pnl: 10 }),
      trade({ pnl: 0 }),
      trade({ pnl: 10 }),
    ]);
    expect(s.bestStreak).toBe(2);
  });

  it('reports best and worst trades', () => {
    const s = computeShareStats([trade({ pnl: 80 }), trade({ pnl: -25 }), trade({ pnl: 12 })]);
    expect(s.bestTrade).toBe(80);
    expect(s.worstTrade).toBe(-25);
  });
});

describe('periodLabel', () => {
  it('labels a day with its full date', () => {
    expect(periodLabel('day', 'en-GB', NOW)).toContain('12');
    expect(periodLabel('day', 'en-GB', NOW)).toContain('2025');
  });

  it('collapses the repeated month inside one week', () => {
    // 10-16 March: the month is stated once, at the end.
    const label = periodLabel('week', 'en-GB', NOW);
    expect(label).toBe('10 — 16 MAR 2025');
  });

  it('keeps both months when a week straddles two', () => {
    // Mon 31 Mar - Sun 6 Apr 2025.
    const label = periodLabel('week', 'en-GB', new Date(2025, 3, 2));
    expect(label).toContain('MAR');
    expect(label).toContain('APR');
  });

  it('labels a month without day numbers', () => {
    expect(periodLabel('month', 'en-GB', NOW)).toBe('MARCH 2025');
  });

  it('is empty for all: there is no window to name', () => {
    expect(periodLabel('all', 'en-GB', NOW)).toBe('');
  });

  it('labels a single trade with its own closing date', () => {
    const t = trade({ exit_time: '2025-01-07T10:00:00' });
    expect(periodLabel('trade', 'en-GB', NOW, t)).toContain('2025');
    expect(periodLabel('trade', 'en-GB', NOW, t)).toContain('07');
  });
});

describe('shareFileName', () => {
  it('is ASCII, dated and free of spaces', () => {
    expect(shareFileName('week', NOW)).toBe('seven-week-20250312.png');
  });

  it('zero-pads single-digit months and days', () => {
    expect(shareFileName('day', new Date(2025, 0, 5))).toBe('seven-day-20250105.png');
  });
});
