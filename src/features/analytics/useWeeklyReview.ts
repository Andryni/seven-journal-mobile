import { useMemo } from 'react';
import type { Trade } from '../../types/domain';

export interface Breakdown {
  key: string;
  pnl: number;
  trades: number;
  winRate: number;
}

export interface WeeklyReview {
  hasData: boolean;
  rangeStart: Date;
  rangeEnd: Date;
  netPnL: number;
  /** Change vs the previous week, in currency. */
  deltaPnL: number;
  trades: number;
  winRate: number;
  avgR: number;
  /** Change in average R vs the previous week. */
  deltaAvgR: number;
  bestSetup: Breakdown | null;
  worstSetup: Breakdown | null;
  bestSession: Breakdown | null;
  /** Most frequent tilted mental state this week, if any. */
  recurringMistake: { state: string; count: number } | null;
  /** Per-day P&L for the week, Monday-first. */
  dailyPnL: { label: string; value: number }[];
}

const DAY_MS = 86_400_000;

/** Monday 00:00 local of the week containing `d`. */
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Mon=0
  x.setDate(x.getDate() - dow);
  return x;
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
 * Weekly Review — turns the journal from an archive into a feedback loop.
 *
 * A trader rarely reads 200 rows looking for a pattern. This answers, for the
 * last 7 days: did I improve, which setup paid, which one bled, when do I
 * trade best, and which emotional state keeps showing up.
 */
export function useWeeklyReview(trades: Trade[], now: Date = new Date()): WeeklyReview {
  return useMemo(() => {
    const rangeStart = startOfWeek(now);
    const rangeEnd = new Date(rangeStart.getTime() + 7 * DAY_MS);
    const prevStart = new Date(rangeStart.getTime() - 7 * DAY_MS);

    const inRange = (t: Trade, from: Date, to: Date) => {
      const ts = new Date(t.entry_time).getTime();
      return ts >= from.getTime() && ts < to.getTime();
    };

    const closed = trades.filter(t => t.pnl !== null);
    const week = closed.filter(t => inRange(t, rangeStart, rangeEnd));
    const prev = closed.filter(t => inRange(t, prevStart, rangeStart));

    const sum = (arr: Trade[]) => arr.reduce((a, t) => a + (t.pnl || 0), 0);
    const avgRof = (arr: Trade[]) => {
      const withR = arr.filter(t => t.r_multiple !== null);
      return withR.length
        ? withR.reduce((a, t) => a + (t.r_multiple || 0), 0) / withR.length
        : 0;
    };

    const netPnL = Math.round(sum(week) * 100) / 100;
    const deltaPnL = Math.round((netPnL - sum(prev)) * 100) / 100;
    const wins = week.filter(t => (t.pnl || 0) > 0).length;
    const avgR = Math.round(avgRof(week) * 100) / 100;
    const deltaAvgR = Math.round((avgR - avgRof(prev)) * 100) / 100;

    const setups = summarise(week, setupKey);
    const sessions = summarise(week, t => t.session);

    const tiltCounts = new Map<string, number>();
    for (const t of week) {
      if (['revenge', 'fomo', 'greedy'].includes(t.mental_state)) {
        tiltCounts.set(t.mental_state, (tiltCounts.get(t.mental_state) ?? 0) + 1);
      }
    }
    const topTilt = [...tiltCounts.entries()].sort((a, b) => b[1] - a[1])[0];

    const dailyPnL = Array.from({ length: 7 }, (_, i) => {
      const dayStart = new Date(rangeStart.getTime() + i * DAY_MS);
      const dayEnd = new Date(dayStart.getTime() + DAY_MS);
      const v = sum(week.filter(t => inRange(t, dayStart, dayEnd)));
      return {
        label: ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'][i],
        value: Math.round(v * 100) / 100,
      };
    });

    return {
      hasData: week.length > 0,
      rangeStart,
      rangeEnd,
      netPnL,
      deltaPnL,
      trades: week.length,
      winRate: week.length ? Math.round((wins / week.length) * 1000) / 10 : 0,
      avgR,
      deltaAvgR,
      bestSetup: setups.length ? setups[0] : null,
      worstSetup: setups.length > 1 ? setups[setups.length - 1] : null,
      bestSession: sessions.length ? sessions[0] : null,
      recurringMistake: topTilt ? { state: topTilt[0], count: topTilt[1] } : null,
      dailyPnL,
    };
  }, [trades, now]);
}
