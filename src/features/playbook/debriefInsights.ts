import type { DailyDebrief } from './usePlaybook';
import type { Trade } from '../../types/domain';
import { localDayKey } from '../../utils/formatDate';

/**
 * Debrief-side derived data, kept pure so the numbers a trader reads about
 * their own discipline are as reproducible as the insights engine.
 *
 * The debrief form used to float free of the journal: you wrote "I chased
 * twice today" while the trades of that day sat in another tab. These
 * helpers join the two, which is where the honesty lives — the cost of a
 * mistake is a fact, not a feeling.
 */

export interface DayStats {
  count: number;
  wins: number;
  pnl: number;
  /** Average R over the day's trades carrying one; null below 1 sample. */
  avgR: number | null;
}

/** Journal stats for the debrief's selected day, in the account's scope. */
export function statsForDay(trades: Trade[], dayKey: string): DayStats {
  const day = trades.filter(t => localDayKey(new Date(t.entry_time)) === dayKey);
  const wins = day.filter(t => (t.pnl || 0) > 0).length;
  const withR = day.filter(t => t.r_multiple !== null);
  return {
    count: day.length,
    wins,
    pnl: day.reduce((s, t) => s + (t.pnl || 0), 0),
    avgR: withR.length > 0
      ? withR.reduce((s, t) => s + (t.r_multiple || 0), 0) / withR.length
      : null,
  };
}

export interface MistakeCost {
  id: string;
  /** Days the mistake was committed. */
  days: number;
  /** Sum of the day PnL on those days. Negative days hurt; context, not proof. */
  totalPnl: number;
}

/**
 * PnL joined onto each mistake, day by day. Deliberately day-level, not
 * trade-level: a mistake is a behaviour spanning the session, and trade-level
 * attribution would silently credit or blame unrelated executions.
 */
export function mistakeCosts(debriefs: DailyDebrief[], trades: Trade[]): MistakeCost[] {
  const pnlByDay = new Map<string, number>();
  for (const tr of trades) {
    const k = localDayKey(new Date(tr.entry_time));
    pnlByDay.set(k, (pnlByDay.get(k) || 0) + (tr.pnl || 0));
  }

  const acc = new Map<string, { days: number; totalPnl: number }>();
  for (const d of debriefs) {
    for (const m of d.mistakes_committed || []) {
      const cur = acc.get(m) || { days: 0, totalPnl: 0 };
      cur.days += 1;
      cur.totalPnl += pnlByDay.get(d.date) || 0;
      acc.set(m, cur);
    }
  }
  return [...acc.entries()]
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => a.totalPnl - b.totalPnl);
}

/**
 * Consecutive most-recent days with a debrief and zero mistakes, counting
 * back from today (or from yesterday if today has no debrief yet — the
 * streak should not die just because the evening is young).
 */
export function disciplineStreak(debriefs: DailyDebrief[]): number {
  const byDay = new Map(debriefs.map(d => [d.date, d]));
  let streak = 0;
  const cursor = new Date();
  // If today has no debrief (or not saved yet), start from yesterday.
  if (!byDay.has(localDayKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 366; i++) {
    const d = byDay.get(localDayKey(cursor));
    if (!d) break;
    if ((d.mistakes_committed || []).length > 0) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * One calendar cell of the discipline grid. `pnl` is null when the day had
 * no trades — a no-trade day is discipline too, and must not read as "lost".
 */
export interface DisciplineDayCell {
  dateKey: string | null;
  hasDebrief: boolean;
  mistakes: number;
  rulesFollowed: number;
  pnl: number | null;
  isToday: boolean;
  isFuture: boolean;
}

/**
 * GitHub-style grid of the last `weeks` calendar weeks, Monday-first,
 * ending with the current week. Colour comes from the DEBRIEF (did the
 * trader stay clean?), not from PnL — this matrix is about behaviour;
 * the money side of the same days is the mistake-cost card's job.
 */
export function disciplineGrid(
  debriefs: DailyDebrief[],
  trades: Trade[],
  weeks = 8,
  now: Date = new Date()
): DisciplineDayCell[][] {
  const byDay = new Map(debriefs.map(d => [d.date, d]));
  const pnlByDay = new Map<string, number>();
  for (const tr of trades) {
    const k = localDayKey(new Date(tr.entry_time));
    pnlByDay.set(k, (pnlByDay.get(k) || 0) + (tr.pnl || 0));
  }

  const todayKey = localDayKey(now);
  // Start of the grid = the Monday of the week (weeks-1) weeks back; the last
  // cell is the current week's Sunday. (getDay()+6)%7 maps Monday to 0.
  const cursor = new Date(now);
  const dow = (cursor.getDay() + 6) % 7;
  cursor.setDate(cursor.getDate() - dow - 7 * (weeks - 1));

  const grid: DisciplineDayCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: DisciplineDayCell[] = [];
    for (let d = 0; d < 7; d++) {
      const key = localDayKey(cursor);
      const deb = byDay.get(key);
      row.push({
        dateKey: key,
        hasDebrief: Boolean(deb),
        mistakes: deb?.mistakes_committed?.length ?? 0,
        rulesFollowed: deb?.rules_followed?.length ?? 0,
        pnl: pnlByDay.has(key) ? pnlByDay.get(key)! : null,
        isToday: key === todayKey,
        isFuture: key > todayKey,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    grid.push(row);
  }
  return grid;
}

export interface MentalPnlBucket {
  /** Days in the bucket with a joined PnL. */
  days: number;
  totalPnl: number;
}

export interface MentalVsPnl {
  /** Self-declared mental score 7–10. */
  strong: MentalPnlBucket;
  /** Self-declared mental score 1–4. */
  weak: MentalPnlBucket;
  /** Days scoring 5–6: the grey zone, reported so the sample is honest. */
  middle: MentalPnlBucket;
}

/**
 * Declared mental state joined to real money. The mirror a trader cannot
 * argue with: "the days you FELT strong were worth +X; the days you felt
 * weak cost you Y" — or, when the correlation is absent, that fact too.
 */
export function mentalVsPnl(debriefs: DailyDebrief[], trades: Trade[]): MentalVsPnl {
  const pnlByDay = new Map<string, number>();
  for (const tr of trades) {
    const k = localDayKey(new Date(tr.entry_time));
    pnlByDay.set(k, (pnlByDay.get(k) || 0) + (tr.pnl || 0));
  }

  const empty = (): MentalPnlBucket => ({ days: 0, totalPnl: 0 });
  const out: MentalVsPnl = { strong: empty(), weak: empty(), middle: empty() };
  for (const d of debriefs) {
    const score = d.mental_score;
    if (score === null || score === undefined) continue;
    if (!pnlByDay.has(d.date)) continue; // only days that actually traded
    const bucket = score >= 7 ? out.strong : score <= 4 ? out.weak : out.middle;
    bucket.days += 1;
    bucket.totalPnl += pnlByDay.get(d.date) || 0;
  }
  return out;
}
