import { useMemo } from 'react';
import type { Trade } from '../../types/domain';

/**
 * Period-review range helpers, shared by the weekly and monthly reviews.
 *
 * Both rituals answer the same questions at different zoom levels, so both
 * must slice time the same way: local-clock month boundaries (not UTC, not
 * fixed 30-day windows) and a previous period for the deltas.
 */

const DAY_MS = 86_400_000;

export interface MonthPoint {
  /** YYYYMM sort key, stable and locale-free. */
  key: string;
  /** Display label, e.g. "JANV. 26". */
  label: string;
  value: number;
  trades: number;
}

/**
 * Gains per calendar month between `from` and `to` (exclusive), oldest first.
 *
 * Like everything in this module, a trade is filed under the month it was
 * closed in: the dashboard's monthlyPerformance buckets on entry_time, which
 * files a swing closed in February under January. Analytics must agree with
 * the monthly review, and the review closes the books on the exit.
 */
export function monthlyPnlSeries(
  trades: Trade[],
  from: Date,
  to: Date,
  lang: 'fr' | 'en'
): MonthPoint[] {
  return periodSeries(trades, from, to, 'month').map(s => {
    const y = Number(s.label.slice(0, 4));
    const m = Number(s.label.slice(4, 6));
    const label = new Date(y, m - 1, 1)
      .toLocaleDateString(lang === 'en' ? 'en-US' : 'fr-FR', {
        month: 'short',
        year: '2-digit',
      })
      .toUpperCase();
    return { key: s.label, label, value: s.value, trades: s.trades };
  });
}

/** Local 00:00 of the day containing `d`. */
export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Monday 00:00 local of the week containing `d` (Mon = 0). */
function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const dow = (s.getDay() + 6) % 7;
  s.setDate(s.getDate() - dow);
  return s;
}

/** A trade is filed under the day it was closed, falling back to entry_time. */
export function tradeDate(t: Trade): Date | null {
  const raw = t.exit_time || t.entry_time;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** One entry per period between `from` and `to`, oldest first. */
export function periodSeries(
  trades: Trade[],
  from: Date,
  to: Date,
  step: 'week' | 'month'
): { label: string; value: number; trades: number }[] {
  const slots: { label: string; value: number; trades: number; start: Date }[] = [];
  if (step === 'month') {
    let y = from.getFullYear();
    let m = from.getMonth();
    while (new Date(y, m, 1).getTime() < to.getTime()) {
      slots.push({
        label: `${y}${String(m + 1).padStart(2, '0')}`,
        value: 0,
        trades: 0,
        start: new Date(y, m, 1),
      });
      m += 1;
      if (m > 11) {
        m = 0;
        y += 1;
      }
    }
  } else {
    // Date arithmetic, not timestamp addition: adding 7*DAY_MS across a DST
    // change drifts the slot an hour off local midnight, and a slot computed
    // at 23:00 the day before never matches a trade's week start again.
    const cursor = startOfWeek(from);
    while (cursor.getTime() < to.getTime()) {
      slots.push({
        label: `W${String(slots.length + 1).padStart(2, '0')}`,
        value: 0,
        trades: 0,
        start: new Date(cursor),
      });
      cursor.setDate(cursor.getDate() + 7);
    }
  }
  if (slots.length === 0) return [];

  const index = new Map<number, number>(slots.map((s, i) => [s.start.getTime(), i]));
  for (const t of trades) {
    if (t.pnl === null || t.pnl === undefined) continue;
    const d = tradeDate(t);
    if (!d) continue;
    let slot: Date;
    if (step === 'month') {
      slot = new Date(d.getFullYear(), d.getMonth(), 1);
    } else {
      slot = startOfWeek(d);
    }
    const i = index.get(slot.getTime());
    if (i === undefined) continue;
    slots[i].value = Math.round((slots[i].value + (t.pnl || 0)) * 100) / 100;
    slots[i].trades += 1;
  }
  return slots.map(({ label, value, trades }) => ({ label, value, trades }));
}

/**
 * Cumulative P&L per trading day inside [from, to), one point per day with a
 * trade. A period that opens flat then moves is the shape the trader reads.
 */
export function cumulativePnlSeries(trades: Trade[], from: Date, to: Date): number[] {
  const perDay = new Map<number, number>();
  for (const t of trades) {
    if (t.pnl === null || t.pnl === undefined) continue;
    const d = tradeDate(t);
    if (!d) continue;
    const ts = d.getTime();
    if (ts < from.getTime() || ts >= to.getTime()) continue;
    perDay.set(ts, (perDay.get(ts) ?? 0) + (t.pnl || 0));
  }
  let acc = 0;
  return [...perDay.keys()].sort((a, b) => a - b).map(ts => {
    acc += perDay.get(ts) || 0;
    return Math.round(acc * 100) / 100;
  });
}

/**
 * History of net P&L per calendar month, oldest first, starting from the
 * month of the first closed trade and running to `to` (exclusive).
 */
export function monthlyPnlHistory(trades: Trade[], to: Date) {
  const closed = trades.filter(t => t.pnl !== null);
  let first: number | null = null;
  for (const t of closed) {
    const d = tradeDate(t);
    if (!d) continue;
    const ts = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    if (first === null || ts < first) first = ts;
  }
  if (first === null) return [];
  return periodSeries(closed, new Date(first), to, 'month');
}

export interface PeriodRange {
  start: Date;
  /** Exclusive upper bound. */
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

/** Local 00:00 of the first day of `d`'s month, plus the previous month. */
export function monthRange(d: Date): PeriodRange {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  return { start, end, prevStart, prevEnd: start };
}

/** Monday 00:00 local of `d`'s week, plus the previous week. */
export function weekRange(d: Date): PeriodRange {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  const dow = (start.getDay() + 6) % 7; // Mon=0
  start.setDate(start.getDate() - dow);
  const end = new Date(start.getTime() + 7 * 86_400_000);
  const prevStart = new Date(start.getTime() - 7 * 86_400_000);
  return { start, end, prevStart, prevEnd: start };
}

export interface Breakdown {
  key: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export interface MonthReview {
  hasData: boolean;
  rangeStart: Date;
  rangeEnd: Date;
  /** Local midnight, first day of the month before the reviewed one. */
  prevStart: Date;
  /** False when the month is empty and there is no earlier month to show. */
  canGoPrev: boolean;
  netPnL: number;
  /** Change vs the previous month, in currency. */
  deltaPnL: number;
  /** Previous month's net, for the comparison strip. */
  prevPnL: number;
  /** Previous month's trade count. */
  prevTrades: number;
  trades: number;
  winRate: number;
  avgR: number;
  /** Change in average R vs the previous month. */
  deltaAvgR: number;
  greenDays: number;
  tradingDays: number;
  bestDay: { label: string; value: number } | null;
  worstDay: { label: string; value: number } | null;
  bestSetup: Breakdown | null;
  worstSetup: Breakdown | null;
  bestSession: Breakdown | null;
  recurringMistake: { state: string; count: number } | null;
  /** Per-day P&L across the whole month, 1st first. */
  dailyPnL: { label: string; value: number }[];
  /** Cumulative P&L per trading day of the month, for the mini curve. */
  cumPnL: number[];
  /** Cumulative P&L per trading day of the previous month. */
  prevCumPnL: number[];
  /** Per-week P&L across the current month (calendar weeks, Mon-first). */
  weeklyPnL: { label: string; value: number; trades: number }[];
  /** Per-week P&L across the previous month. */
  prevWeeklyPnL: { label: string; value: number; trades: number }[];
}

function summarise(trades: Trade[], keyOf: (t: Trade) => string | null): Breakdown[] {
  const map = new Map<string, { pnl: number; trades: number; wins: number }>();
  for (const t of trades) {
    const key = keyOf(t);
    if (!key) continue;
    const e = map.get(key) ?? { pnl: 0, trades: 0, wins: 0 };
    e.pnl += t.pnl || 0;
    e.trades += 1;
    if ((t.pnl || 0) > 0) e.wins += 1;
    map.set(key, e);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      pnl: Math.round(v.pnl * 100) / 100,
      trades: v.trades,
      winRate: v.trades ? Math.round((v.wins / v.trades) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

/** A trade's setup signature — playbook structures first, then ICT flags. */
function setupKey(t: Trade): string | null {
  if (t.setup_structures?.length) return t.setup_structures.join(' + ');
  const flags: string[] = [];
  if (t.setup_fvg) flags.push('FVG');
  if (t.setup_ob) flags.push('OB');
  if (t.setup_liquidity_sweep) flags.push('SWEEP');
  return flags.length ? flags.join(' + ') : null;
}

/**
 * Monthly Review — the weekly review zoomed out one level.
 *
 * Same questions as the week: did I improve, what paid, what bled. At this
 * horizon the calendar view matters (how lumpy was the month?), so the
 * per-day bars cover the whole month and the best/worst day are named.
 */
export function useMonthlyReview(trades: Trade[], now: Date = new Date()): MonthReview {
  return useMemo(() => {
    const { start: rangeStart, end: rangeEnd, prevStart, prevEnd } = monthRange(now);

    const inRange = (t: Trade, from: Date, to: Date) => {
      const ts = new Date(t.entry_time).getTime();
      return ts >= from.getTime() && ts < to.getTime();
    };

    const closed = trades.filter(t => t.pnl !== null);
    const month = closed.filter(t => inRange(t, rangeStart, rangeEnd));
    const prev = closed.filter(t => inRange(t, prevStart, prevEnd));

    const sum = (arr: Trade[]) => arr.reduce((a, t) => a + (t.pnl || 0), 0);
    const avgRof = (arr: Trade[]) => {
      const withR = arr.filter(t => t.r_multiple !== null);
      return withR.length
        ? withR.reduce((a, t) => a + (t.r_multiple || 0), 0) / withR.length
        : 0;
    };

    const netPnL = Math.round(sum(month) * 100) / 100;
    const deltaPnL = Math.round((netPnL - sum(prev)) * 100) / 100;
    const wins = month.filter(t => (t.pnl || 0) > 0).length;
    const avgR = Math.round(avgRof(month) * 100) / 100;
    const deltaAvgR = Math.round((avgR - avgRof(prev)) * 100) / 100;

    const setups = summarise(month, setupKey);
    const sessions = summarise(month, t => t.session);

    const tiltCounts = new Map<string, number>();
    for (const t of month) {
      if (['revenge', 'fomo', 'greedy'].includes(t.mental_state)) {
        tiltCounts.set(t.mental_state, (tiltCounts.get(t.mental_state) ?? 0) + 1);
      }
    }
    const topTilt = [...tiltCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    // One slot per day of the month. Days with no closed trade stay at 0 but
    // do not count as "green" — only traded days enter the day verdicts.
    const daysInMonth = new Date(
      rangeStart.getFullYear(),
      rangeStart.getMonth() + 1,
      0
    ).getDate();
    const perDay: { label: string; value: number; traded: boolean }[] = Array.from(
      { length: daysInMonth },
      (_, i) => ({ label: String(i + 1), value: 0, traded: false })
    );
    for (const t of month) {
      const d = new Date(t.entry_time);
      if (d.getFullYear() !== rangeStart.getFullYear() || d.getMonth() !== rangeStart.getMonth())
        continue;
      const slot = perDay[d.getDate() - 1];
      if (!slot) continue;
      slot.value = Math.round((slot.value + (t.pnl || 0)) * 100) / 100;
      slot.traded = true;
    }

    const tradedDays = perDay.filter(d => d.traded);
    const greenDays = tradedDays.filter(d => d.value > 0).length;
    const bestDay = tradedDays.length
      ? tradedDays.reduce((a, b) => (b.value > a.value ? b : a))
      : null;
    const worstDay = tradedDays.length
      ? tradedDays.reduce((a, b) => (b.value < a.value ? b : a))
      : null;

    // Comparison strips: cumulative per trading day and per calendar week,
    // for this month and the previous one. Calendar weeks can straddle the
    // month boundary; a slot counts only its week's start inside the range,
    // and a straddling trade lands in the week it was closed in.
    const cumPnL = cumulativePnlSeries(month, rangeStart, rangeEnd);
    const prevCumPnL = cumulativePnlSeries(prev, prevStart, rangeStart);
    const weeklyPnL = periodSeries(month, rangeStart, rangeEnd, 'week');
    const prevWeeklyPnL = periodSeries(prev, prevStart, rangeStart, 'week');

    // Navigation guard: the arrow is offered only when an earlier month
    // exists in the journal, so the review never lands on a month of zeros.
    const earliest = closed.reduce<number | null>((min, t) => {
      const d = tradeDate(t);
      if (!d) return min;
      const ts = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      return min === null || ts < min ? ts : min;
    }, null);
    const canGoPrev = earliest !== null && prevStart.getTime() >= earliest;

    return {
      hasData: month.length > 0,
      rangeStart,
      rangeEnd,
      prevStart,
      canGoPrev,
      netPnL,
      deltaPnL,
      prevPnL: Math.round(sum(prev) * 100) / 100,
      prevTrades: prev.length,
      trades: month.length,
      winRate: month.length ? Math.round((wins / month.length) * 1000) / 10 : 0,
      avgR,
      deltaAvgR,
      greenDays,
      tradingDays: tradedDays.length,
      bestDay: bestDay ? { label: bestDay.label, value: bestDay.value } : null,
      worstDay: worstDay ? { label: worstDay.label, value: worstDay.value } : null,
      bestSetup: setups.length ? setups[0] : null,
      worstSetup: setups.length > 1 ? setups[setups.length - 1] : null,
      bestSession: sessions.length ? sessions[0] : null,
      recurringMistake: topTilt ? { state: topTilt[0], count: topTilt[1] } : null,
      dailyPnL: perDay.map(({ label, value }) => ({ label, value })),
      cumPnL,
      prevCumPnL,
      weeklyPnL,
      prevWeeklyPnL,
    };
  }, [trades, now]);
}
