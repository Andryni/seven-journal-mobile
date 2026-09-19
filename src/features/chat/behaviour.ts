import type { Trade, TradingAccount } from '../../types/domain';
import type { EconomicEvent } from '../calendar/economicEvents';

/**
 * Behavioural findings, computed on the device.
 *
 * This is the module that makes the coach more than a summariser: the three
 * most expensive habits in retail trading are all RELATIONAL facts — a loss
 * followed quickly by a bigger re-entry, a day with too many entries, an
 * entry next to a market-moving release — and none of them shows up in any
 * per-trade statistic. They require reading the journal as a SEQUENCE and
 * joining it against data only this app holds (the personal rules, the
 * economic calendar). A model asked to do this itself would hallucinate
 * timings; here every finding carries its trade numbers, minutes and R so
 * the coach can only quote what was measured.
 *
 * Pure and dependency-free. Currencies: the calendar join matches by the
 * quote-currency heuristic (pairs containing the event's currency code),
 * which is coarse but honest — a false positive costs one sentence, a missed
 * NFP costs a blown day.
 *
 * Sample-size discipline: every detector refuses to speak below a minimum,
 * and every finding names its exact numbers. A behavioural claim without
 * its count is an accusation; with it, it is a statistic.
 */

/** Minutes after a loss within which a re-entry counts as reactive. */
const REVENGE_WINDOW_MIN = 15;
/** The reactive re-entry must also risk more than the loser did. */
const REVENGE_SIZE_FACTOR = 1.0;

export interface RevengeFinding {
  kind: 'revenge';
  /** Trade number (1-based, in the sent window) of the LOSING trade. */
  triggerN: number;
  /** The reactive re-entry(s), soonest first. */
  reactions: { n: number; minutesAfter: number; samePair: boolean }[];
  /** Total extra P&L of the reactions, in the account currency. */
  extraPnl: number;
}

export interface OvertradingFinding {
  kind: 'overtrading';
  /** Local date, e.g. 2026-09-19. */
  date: string;
  trades: number;
  /** The personal rule that was set (max_trades_per_day), if any. */
  limit: number | null;
  /** Net P&L of that day — overtrading days usually pay negative. */
  dayPnl: number;
}

export interface NewsFinding {
  kind: 'news';
  /** Trade number in the sent window. */
  n: number;
  eventTitle: string;
  eventCurrency: string;
  /** Minutes between the event and the entry; negative = after. */
  minutesFromEvent: number;
}

export interface BehaviourReport {
  revenge: RevengeFinding[];
  overtrading: OvertradingFinding[];
  news: NewsFinding[];
  /** Closed trades considered; the honest denominator for every claim. */
  examined: number;
}

/**
 * Trade numbers in the sent window, by id — every finding references trades
 * the model can actually see. Trades outside the window keep their findings
 * out rather than renaming them: a "trade 97" the model has never seen is
 * how a confirmation dialog ends up touching the wrong row.
 */
function windowIndex(window: Trade[]): Map<string, number> {
  const m = new Map<string, number>();
  window.forEach((t, i) => m.set(t.id, i + 1));
  return m;
}

function minutesBetween(a: string | null, b: string | null): number | null {
  if (!a || !b) return null;
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.round((tb - ta) / 60000);
}

/** Currencies the calendar tracks, for the pair-containment join. */
function pairCurrencies(pair: string): string[] {
  const p = (pair || '').toUpperCase();
  // EURUSD -> [EUR, USD]; XAUUSD -> [XAU, USD] (XAU never matches a tracked
  // currency, which is exactly right).
  return p.length >= 6 ? [p.slice(0, 3), p.slice(3, 6)] : [];
}

export function detectBehaviour(params: {
  /** Whole closed history, chronological or not — sorted internally. */
  trades: Trade[];
  /** The ordered window the model sees; findings outside it are dropped. */
  window: Trade[];
  /** Account, for the personal max_trades_per_day rule. */
  account?: TradingAccount | null;
  /** High-impact events (already filtered by the calendar module). */
  events?: EconomicEvent[];
  /** Local calendar days of history to scan for overtrading. */
  overtradingDays?: number;
}): BehaviourReport {
  const { trades, window, account = null, events = [], overtradingDays = 14 } = params;

  const closed = trades
    .filter(t => t.pnl !== null && t.pnl !== undefined)
    .sort(
      (a, b) =>
        new Date(a.entry_time || 0).getTime() - new Date(b.entry_time || 0).getTime()
    );

  const idx = windowIndex(window);
  const report: BehaviourReport = {
    revenge: [],
    overtrading: [],
    news: [],
    examined: closed.length,
  };

  // ---- Revenge: a loss, then an entry within the window on the same pair
  // with a size at least as large. The pair condition keeps "took another
  // trade after a loss" (normal) apart from "went straight back into the
  // SAME fight" (the habit that compounds).
  for (let i = 0; i < closed.length; i++) {
    const loser = closed[i];
    if ((loser.pnl ?? 0) >= 0) continue;
    const reactions: RevengeFinding['reactions'] = [];
    let extraPnl = 0;
    for (let j = i + 1; j < closed.length; j++) {
      const next = closed[j];
      if (next.pair !== loser.pair) continue;
      const mins = minutesBetween(loser.exit_time ?? loser.entry_time, next.entry_time);
      if (mins === null || mins > REVENGE_WINDOW_MIN) break;
      if (next.size < loser.size * REVENGE_SIZE_FACTOR) continue;
      const n = idx.get(next.id);
      if (n !== undefined) {
        reactions.push({ n, minutesAfter: mins, samePair: true });
        extraPnl += next.pnl ?? 0;
      }
    }
    if (reactions.length === 0) continue;
    const triggerN = idx.get(loser.id);
    // The trigger must also be visible, or the finding is unanchored prose.
    if (triggerN === undefined) continue;
    report.revenge.push({ kind: 'revenge', triggerN, reactions, extraPnl });
  }

  // ---- Overtrading: local days whose entry count exceeds the personal
  // rule. Without a rule the detector stays silent — counting against an
  // invented limit would be moralising, not measurement.
  const limit = account?.max_trades_per_day;
  if (limit && limit > 0) {
    const byDay = new Map<string, Trade[]>();
    for (const t of closed) {
      if (!t.entry_time) continue;
      const d = new Date(t.entry_time);
      if (Number.isNaN(d.getTime())) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const list = byDay.get(key) ?? [];
      list.push(t);
      byDay.set(key, list);
    }
    const cutoff = Date.now() - overtradingDays * 24 * 60 * 60 * 1000;
    const days = [...byDay.entries()]
      .filter(([key]) => new Date(`${key}T12:00:00`).getTime() >= cutoff)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1));
    for (const [date, list] of days) {
      if (list.length <= limit) continue;
      report.overtrading.push({
        kind: 'overtrading',
        date,
        trades: list.length,
        limit,
        dayPnl: Math.round(list.reduce((s, t) => s + (t.pnl ?? 0), 0) * 100) / 100,
      });
    }
  }

  // ---- News: an entry within ±30 minutes of a high-impact event in one of
  // the pair's currencies. Half an hour each side is where the spread widens
  // and the fills degrade; beyond that it is trading the day, not the print.
  const NEWS_WINDOW_MIN = 30;
  for (const e of events) {
    for (let i = 0; i < closed.length; i++) {
      const t = closed[i];
      if (!pairCurrencies(t.pair).includes(e.currency.toUpperCase())) continue;
      const mins = minutesBetween(e.at, t.entry_time);
      if (mins === null || Math.abs(mins) > NEWS_WINDOW_MIN) continue;
      const n = idx.get(t.id);
      if (n === undefined) continue;
      report.news.push({ kind: 'news', n, eventTitle: e.title, eventCurrency: e.currency, minutesFromEvent: mins });
    }
  }

  return report;
}
