import type { Trade } from '../types/domain';

/**
 * Selecting what a share card covers.
 *
 * The card used to be locked to "every trade in the account, forever", which
 * is the one period nobody actually wants to post. A trader shares a single
 * good execution, or the day, or the week they just closed. This module turns
 * that choice into a date window and the numbers that go on the card.
 *
 * Kept free of React and of any Expo module so the arithmetic is testable on
 * its own -- the rendering and the file writing are the parts that need a
 * device, and they should not drag the maths along with them.
 */

export type SharePeriod = 'trade' | 'day' | 'week' | 'month' | 'all';

export interface ShareStats {
  /** Trades the card is built from: closed, inside the window. */
  trades: Trade[];
  netPnl: number;
  /** Gross of costs, so the card can show what fees took. */
  grossPnl: number;
  costs: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalR: number;
  bestTrade: number;
  worstTrade: number;
  /** Largest number of consecutive wins in the window. */
  bestStreak: number;
  /** Cumulative P&L after each trade, for the card's sparkline. */
  equity: number[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Local-midnight start of the day containing `d`. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Monday-first start of week.
 *
 * Trading weeks run Monday to Friday, so a Sunday-first week would split the
 * week a trader just finished across two cards.
 */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7; // Monday = 0
  s.setDate(s.getDate() - dow);
  return s;
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/**
 * The window a period covers, as [from, to).
 *
 * `null` means unbounded, which is what 'all' and 'trade' use -- a single
 * trade is selected by identity, not by date.
 */
export function periodRange(
  period: SharePeriod,
  now: Date = new Date()
): { from: Date | null; to: Date | null } {
  switch (period) {
    case 'day': {
      const from = startOfDay(now);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);
      return { from, to };
    }
    case 'week': {
      const from = startOfWeek(now);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return { from, to };
    }
    case 'month': {
      const from = startOfMonth(now);
      const to = new Date(from.getFullYear(), from.getMonth() + 1, 1);
      return { from, to };
    }
    default:
      return { from: null, to: null };
  }
}

/**
 * A trade belongs to the window of the day it was CLOSED, not opened.
 *
 * A swing position opened on Monday and closed on Thursday is Thursday's
 * result: that is the day the P&L landed, and the day the trader is reporting
 * on. Falling back to entry_time keeps trades usable when a broker import
 * omitted the exit timestamp.
 */
export function tradeDate(trade: Trade): Date | null {
  const raw = trade.exit_time || trade.entry_time;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function selectTrades(
  trades: Trade[],
  period: SharePeriod,
  opts: { now?: Date; tradeId?: string | null } = {}
): Trade[] {
  const { now = new Date(), tradeId = null } = opts;

  // Only closed trades: an open position has no result to publish.
  const closed = trades.filter(t => t.pnl !== null && t.pnl !== undefined);

  if (period === 'trade') {
    return tradeId ? closed.filter(t => t.id === tradeId) : [];
  }

  const { from, to } = periodRange(period, now);
  if (!from || !to) return closed;

  return closed.filter(t => {
    const d = tradeDate(t);
    if (!d) return false;
    return d >= from && d < to;
  });
}

/** Costs recorded on a trade, normalised to a positive amount. */
function costOf(t: Trade): number {
  return Math.abs(t.commission || 0) + Math.abs(t.swap || 0);
}

export function computeShareStats(trades: Trade[]): ShareStats {
  const closed = trades.filter(t => t.pnl !== null && t.pnl !== undefined);

  const netPnl = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const costs = closed.reduce((s, t) => s + costOf(t), 0);

  const wins = closed.filter(t => (t.pnl || 0) > 0).length;
  const losses = closed.filter(t => (t.pnl || 0) < 0).length;
  const breakeven = closed.length - wins - losses;

  /**
   * Breakeven trades are excluded from the denominator.
   *
   * A scratched trade is neither a win nor a loss, and counting it as a loss
   * would punish the discipline of cutting a position that stopped working.
   */
  const decided = wins + losses;

  const pnls = closed.map(t => t.pnl || 0);

  let acc = 0;
  const equity = closed
    .slice()
    .sort((a, b) => {
      const da = tradeDate(a)?.getTime() ?? 0;
      const db = tradeDate(b)?.getTime() ?? 0;
      return da - db;
    })
    .map(t => {
      acc += t.pnl || 0;
      return round2(acc);
    });

  let streak = 0;
  let bestStreak = 0;
  for (const p of pnls) {
    if (p > 0) {
      streak += 1;
      if (streak > bestStreak) bestStreak = streak;
    } else if (p < 0) {
      streak = 0;
    }
    // A breakeven trade neither extends nor breaks a streak.
  }

  return {
    trades: closed,
    netPnl: round2(netPnl),
    grossPnl: round2(netPnl + costs),
    costs: round2(costs),
    wins,
    losses,
    breakeven,
    winRate: decided > 0 ? round2((wins / decided) * 100) : 0,
    totalR: round2(closed.reduce((s, t) => s + (t.r_multiple || 0), 0)),
    bestTrade: pnls.length ? round2(Math.max(...pnls)) : 0,
    worstTrade: pnls.length ? round2(Math.min(...pnls)) : 0,
    bestStreak,
    equity,
  };
}

/**
 * Human label for the window, e.g. "12 MAR 2025" or "10 — 16 MAR 2025".
 * Used as the card's subtitle and in the exported filename.
 */
export function periodLabel(
  period: SharePeriod,
  locale: string,
  now: Date = new Date(),
  singleTrade?: Trade | null
): string {
  const upper = (s: string) => s.toUpperCase();

  if (period === 'trade') {
    const d = singleTrade ? tradeDate(singleTrade) : null;
    if (!d) return '';
    return upper(
      d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    );
  }

  if (period === 'all') return '';

  const { from, to } = periodRange(period, now);
  if (!from || !to) return '';

  if (period === 'day') {
    return upper(
      from.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
    );
  }

  const last = new Date(to.getTime() - 1);

  if (period === 'month') {
    return upper(from.toLocaleDateString(locale, { month: 'long', year: 'numeric' }));
  }

  // Week: collapse the repeated month when both ends share one.
  const sameMonth = from.getMonth() === last.getMonth();
  const left = sameMonth
    ? String(from.getDate()).padStart(2, '0')
    : upper(from.toLocaleDateString(locale, { day: '2-digit', month: 'short' }));
  const right = upper(
    last.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })
  );
  return `${left} — ${right}`;
}

/**
 * Filename for the exported PNG. Safe on every filesystem: ASCII, no spaces.
 */
export function shareFileName(period: SharePeriod, now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  return `seven-${period}-${stamp}.png`;
}
