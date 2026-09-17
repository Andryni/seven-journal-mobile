import { useMemo } from 'react';
import type { Trade } from '../../types/domain';
import { tradeDate } from './periodReview';

/**
 * Yearly review — the ritual zoomed out to twelve months.
 *
 * The monthly review answers "did this month beat last month"; the year
 * answers a different question: WHERE did the year happen. Twelve months
 * side by side expose the concentrated quarter, the bleeding stretch and the
 * streaks that a month-to-month delta averages away — and the best/worst
 * month verdicts name them, the same way the review names the best/worst
 * setup.
 *
 * The `year` prop makes the screen navigable without recomputing "now":
 * callers pass an anchor and every figure recomputes against it, exactly the
 * pattern the monthly and weekly reviews use.
 */
export interface YearReview {
  /** Calendar year under review. */
  year: number;
  /** True when the year has no closed trade (the screen shows its empty state). */
  hasData: boolean;
  /** Cumulative P&L, one point per trading day of the year, oldest first. */
  cumPnL: number[];
  /** Net for each of the 12 months, oldest first; 0 for months with none. */
  monthlyPnL: { label: string; value: number; trades: number }[];
  /** The 12 months as a cumulative walk, for the mini curve. */
  cumByMonth: number[];
  /** Total year net and trade count. */
  netPnL: number;
  trades: number;
  winRate: number;
  /** Sum of R over the year's closed trades. */
  totalR: number;
  /** Best and worst month by net P&L (null when the year is empty). */
  bestMonth: { month: number; label: string; value: number } | null;
  worstMonth: { month: number; label: string; value: number } | null;
  /** Longest run of positive months / negative months, oldest first. */
  bestStreak: number;
  worstStreak: number;
  /** A year earlier than the journal's first trade exists? (back-arrow guard) */
  canGoPrev: boolean;
  /** The year under review is not the live one? (forward-arrow guard) */
  canGoNext: boolean;
}

const MONTH_KEYS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'] as const;

export function useYearlyReview(trades: Trade[], year: number): YearReview {
  return useMemo(() => {
    const from = new Date(year, 0, 1);
    const to = new Date(year + 1, 0, 1);

    const closed = trades.filter(t => t.pnl !== null && t.pnl !== undefined);
    const inYear = closed.filter(t => {
      const d = tradeDate(t);
      return d !== null && d >= from && d < to;
    });

    const netPnL = Math.round(inYear.reduce((s, t) => s + (t.pnl || 0), 0) * 100) / 100;
    const wins = inYear.filter(t => (t.pnl || 0) > 0).length;
    const totalR = Math.round(inYear.reduce((s, t) => s + (t.r_multiple || 0), 0) * 100) / 100;

    // One slot per calendar month, oldest first. The label is the i18n-agnostic
    // month key; the screen maps it to the locale name through t().
    const perMonth = MONTH_KEYS.map(key => ({ label: key, value: 0, trades: 0 }));
    const daily = new Map<number, number>();
    for (const t of inYear) {
      const d = tradeDate(t)!;
      const m = d.getMonth();
      perMonth[m].value = Math.round((perMonth[m].value + (t.pnl || 0)) * 100) / 100;
      perMonth[m].trades += 1;
      // A single point per trading day keeps the year curve readable at 200+
      // trades; cumulativePnlSeries-style bucketing, inlined to stay pure here.
      const ts = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      daily.set(ts, (daily.get(ts) ?? 0) + (t.pnl || 0));
    }

    let acc = 0;
    const cumPnL = [...daily.keys()]
      .sort((a, b) => a - b)
      .map(ts => {
        acc += daily.get(ts) || 0;
        return Math.round(acc * 100) / 100;
      });

    let accMonth = 0;
    const cumByMonth = perMonth.map(m => {
      accMonth += m.value;
      return Math.round(accMonth * 100) / 100;
    });

    const hasData = inYear.length > 0;

    // Best/worst months: only traded months can carry a verdict — a January
    // with no trades must not be crowned "best month" of a February start.
    let bestMonth: YearReview['bestMonth'] = null;
    let worstMonth: YearReview['worstMonth'] = null;
    for (let i = 0; i < perMonth.length; i++) {
      const m = perMonth[i];
      if (m.trades === 0) continue;
      if (!bestMonth || m.value > bestMonth.value) {
        bestMonth = { month: i, label: m.label, value: m.value };
      }
      if (!worstMonth || m.value < worstMonth.value) {
        worstMonth = { month: i, label: m.label, value: m.value };
      }
    }

    // Streaks walk the months oldest-first, skipping untouched months so a
    // summer break does not snap a run of green months in two.
    let bestStreak = 0;
    let worstStreak = 0;
    let runPos = 0;
    let runNeg = 0;
    for (const m of perMonth) {
      if (m.trades === 0) continue;
      if (m.value > 0) {
        runPos += 1;
        runNeg = 0;
      } else if (m.value < 0) {
        runNeg += 1;
        runPos = 0;
      }
      bestStreak = Math.max(bestStreak, runPos);
      worstStreak = Math.max(worstStreak, runNeg);
    }

    // Navigation guards: the back arrow exists only while an earlier year
    // holds a closed trade; the forward one only while we are not on the
    // live year.
    let earliestYear: number | null = null;
    for (const t of closed) {
      const d = tradeDate(t);
      if (!d) continue;
      if (earliestYear === null || d.getFullYear() < earliestYear) {
        earliestYear = d.getFullYear();
      }
    }
    const nowYear = new Date().getFullYear();
    const canGoPrev = earliestYear !== null && year - 1 >= earliestYear;
    const canGoNext = year < nowYear;

    return {
      year,
      hasData,
      cumPnL,
      monthlyPnL: perMonth,
      cumByMonth,
      netPnL,
      trades: inYear.length,
      winRate: inYear.length ? Math.round((wins / inYear.length) * 1000) / 10 : 0,
      totalR,
      bestMonth,
      worstMonth,
      bestStreak,
      worstStreak,
      canGoPrev,
      canGoNext,
    };
  }, [trades, year]);
}
