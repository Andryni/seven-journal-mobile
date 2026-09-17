import type { Trade } from '../../types/domain';
import type { DailyDebrief } from '../playbook/usePlaybook';
import { localDayKey, isSameLocalDay } from '../../utils/formatDate';

/**
 * The morning brief — what the trader should know BEFORE the session opens.
 *
 * Most journaling apps look backward. This one closes the loop the debrief
 * opens: every evening the trader writes `objective_tomorrow`, and every
 * morning that objective comes back to the top of the dashboard, joined with
 * what history actually says about this particular weekday and how yesterday
 * ended. Three lines, in priority order — the discipline loop, then the
 * statistical nudge, then the emotional handoff.
 *
 * Pure and deterministic so the copy decisions are unit-testable: which
 * lines exist, which are absent, and the exact silence rules (no objective
 * written means no objective line — the card never invents one).
 */

export interface BriefStats {
  /** Trades on this weekday across the whole journal. */
  dayTrades: number;
  /** Net R on this weekday; null when no R was ever recorded. */
  dayAvgR: number | null;
  /** Win rate on this weekday, percent. */
  dayWinRate: number;
  /** Most traded playbook strategy on this weekday, if the title is known. */
  favouriteSetup: string | null;
}

export interface MorningBrief {
  /** The objective the trader wrote in yesterday's debrief, verbatim. */
  objective: string | null;
  /** Whether the debrief of yesterday exists at all. */
  hasYesterdayDebrief: boolean;
  /** Yesterday's mental score (0-10), when the debrief exists. */
  yesterdayMentalScore: number | null;
  /** Yesterday's declared mistakes, if any. */
  yesterdayMistakes: string[];
  /** Weekday statistics for the current weekday name. */
  stats: BriefStats;
  /** Localized weekday label key slot — resolved by the caller via i18n. */
  weekdayIndex: number; // 0 = Sunday ... 6 = Saturday (JS convention)
}

export function buildMorningBrief(
  trades: Trade[],
  debriefs: DailyDebrief[],
  now: Date = new Date(),
  /** Titles of the user's own strategies; only these can be named as favourite. */
  playbookTitles: string[] = []
): MorningBrief {
  const weekdayIndex = now.getDay();

  // ── Yesterday's handoff ──
  // Calendar day strictly before `now`, keyed locally so a debrief written at
  // 23:40 and one written at 00:20 the next day land on different days — the
  // debrief is a daily record, exactly like the discipline grid.
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = localDayKey(yesterday);
  const yesterdayDebrief =
    debriefs.find(d => d.date === yesterdayKey) ?? null;

  // ── Weekday history ──
  // Strictly the past: a trade logged today shares this weekday and would
  // otherwise pollute the aggregate the same morning it was taken, which the
  // "historically" wording excludes.
  const sameWeekday = trades.filter(t => {
    if (!t.entry_time) return false;
    if (isSameLocalDay(t.entry_time, now)) return false;
    return new Date(t.entry_time).getDay() === weekdayIndex;
  });
  const closed = sameWeekday.filter(t => t.pnl !== null && t.pnl !== undefined);
  const wins = closed.filter(t => (t.pnl ?? 0) > 0).length;
  const decided = closed.filter(t => (t.pnl ?? 0) !== 0).length;

  const rs = closed
    .map(t => t.r_multiple)
    .filter((r): r is number => r !== null && r !== undefined && Number.isFinite(r));

  // Most traded playbook strategy on this weekday — the playbook linkage
  // lives in setup_structures[0] (see TradeFormModal), so that is what is
  // counted.
  //
  // Only titles from the user's own playbook are eligible. setup_structures
  // is a free-form string array that still holds fixed ICT labels written by
  // an older version of the app — 'BOS', 'FVG', 'OB' — and naming one of
  // those surfaced "Jeudi : ... surtout en BOS" to a trader whose playbook
  // contains no such strategy, which is advice about a name they never
  // chose and cannot act on. Same fix as computeInsights.bestSetup: with no
  // playbook defined there is nothing to name, so the slot stays empty.
  const allowed = new Map(
    playbookTitles.map(p => [p.toLowerCase().trim(), p.trim()])
  );
  const setupCount = new Map<string, number>();
  for (const t of sameWeekday) {
    const raw = t.setup_structures?.[0];
    if (!raw) continue;
    const canonical = allowed.get(raw.toLowerCase().trim());
    if (!canonical) continue;
    setupCount.set(canonical, (setupCount.get(canonical) ?? 0) + 1);
  }
  let favouriteSetup: string | null = null;
  let best = 0;
  for (const [name, n] of setupCount) {
    if (n > best) {
      best = n;
      favouriteSetup = name;
    }
  }

  return {
    objective: yesterdayDebrief?.objective_tomorrow?.trim() || null,
    hasYesterdayDebrief: yesterdayDebrief !== null,
    yesterdayMentalScore: yesterdayDebrief?.mental_score ?? null,
    yesterdayMistakes: yesterdayDebrief?.mistakes_committed ?? [],
    stats: {
      dayTrades: sameWeekday.length,
      dayAvgR: rs.length
        ? Math.round((rs.reduce((s, r) => s + r, 0) / rs.length) * 100) / 100
        : null,
      dayWinRate: decided > 0 ? Math.round((wins / decided) * 100) : 0,
      favouriteSetup,
    },
    weekdayIndex,
  };
}

/** True when there is genuinely nothing to show — the card hides entirely. */
export function isBriefEmpty(brief: MorningBrief): boolean {
  return (
    brief.objective === null &&
    !brief.hasYesterdayDebrief &&
    brief.stats.dayTrades === 0
  );
}

/** Guard against an accidental future-dated debrief match. */
export function debriefIsAboutYesterday(
  debrief: DailyDebrief | null,
  now: Date = new Date()
): boolean {
  if (!debrief) return false;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return debrief.date === localDayKey(yesterday);
}

/** Re-exported for the card's "trades today" count, if it needs one. */
export { isSameLocalDay };
