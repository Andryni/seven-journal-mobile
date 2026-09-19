import type { Trade } from '../../types/domain';
import { numericGaps } from '../chat/buildChatContext';

/**
 * The journal's NUMERIC gaps as a ranked report.
 *
 * The chat's `gaps` block answers "what is missing" in prose; this module
 * answers the same question for a UI card. Same `numericGaps` primitive —
 * one definition, or the card and the coach would drift apart within a
 * release.
 *
 * Pure and dependency-free: the ranking and the counts are the testable
 * parts, the hook that feeds it lives in useJournalGaps.
 */

export type NumericGaps = ReturnType<typeof numericGaps>;

/** One incomplete trade, with its gaps and how many there are. */
export interface GapRow {
  trade: Trade;
  gaps: NumericGaps;
  missingCount: number;
}

export interface JournalGapsReport {
  /** Closed trades examined. */
  audited: number;
  /** Trades carrying at least one numeric gap. */
  incomplete: number;
  /** Missing count per field, summed over the audited trades. */
  counts: Record<keyof NumericGaps, number>;
  /** The worst trades first: most missing fields, then most recent. */
  rows: GapRow[];
}

/** How many rows the card shows before the aggregate counts take over. */
export const MAX_GAP_ROWS = 30;

const GAP_KEYS: (keyof NumericGaps)[] = [
  'r',
  'rFillable',
  'stop',
  'target',
  'exit',
  'costs',
  'excursions',
  'excursionsFillable',
  'notes',
];

/**
 * Rank the incomplete trades worst-first.
 *
 * "Worst" is most missing fields, then most recent — the same ordering rule
 * as auditCompleteness, so the card and the chat name the same trades first.
 * Open positions are excluded: they have no result to complete yet.
 */
export function buildJournalGapsReport(trades: Trade[], cap = MAX_GAP_ROWS): JournalGapsReport {
  const counts = GAP_KEYS.reduce(
    (acc, k) => ({ ...acc, [k]: 0 }),
    {} as Record<keyof NumericGaps, number>
  );

  const rows: GapRow[] = [];
  let audited = 0;

  for (const trade of trades) {
    if (trade.pnl === null || trade.pnl === undefined) continue;
    audited += 1;

    const gaps = numericGaps(trade);
    const missingCount = GAP_KEYS.filter(k => gaps[k]).length;
    if (missingCount === 0) continue;

    for (const k of GAP_KEYS) if (gaps[k]) counts[k] += 1;
    rows.push({ trade, gaps, missingCount });
  }

  rows.sort((a, b) => {
    if (b.missingCount !== a.missingCount) return b.missingCount - a.missingCount;
    const ta = new Date(a.trade.exit_time || a.trade.entry_time || 0).getTime();
    const tb = new Date(b.trade.exit_time || b.trade.entry_time || 0).getTime();
    return tb - ta;
  });

  return {
    audited,
    incomplete: rows.length,
    counts,
    rows: rows.slice(0, cap),
  };
}
