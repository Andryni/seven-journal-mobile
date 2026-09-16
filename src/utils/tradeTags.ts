import type { Trade } from '../types/domain';

/**
 * Free-form tags, and the cross-filtering that makes a journal interrogable.
 *
 * The journal could answer "how did I do?" but not "how do I do when I take a
 * London FVG while tired, risking more than 1%?". Tags plus cross-filtering
 * turn a logbook into something you can question.
 *
 * Tags are kept separate from `setup_structures`, which drives playbook
 * attribution. Overloading that column would make every casual note ("news",
 * "tired") look like a trading strategy and quietly corrupt setup statistics.
 *
 * NORMALISATION, applied on the way in so comparison never has to guess:
 *   - trimmed, lowercased, inner whitespace collapsed
 *   - a leading '#' is dropped, so "#news" and "news" are one tag
 *   - empties are discarded, duplicates removed, order preserved
 *
 * Display keeps the normalised form rather than the raw input: showing
 * "FVG", "fvg" and "Fvg" as three chips that filter identically would look
 * broken.
 */

export const MAX_TAG_LENGTH = 24;

/** Normalise one tag. Returns '' for anything that is not a usable tag. */
export function normalizeTag(raw: string): string {
  if (typeof raw !== 'string') return '';
  const cleaned = raw
    .trim()
    .replace(/^#+/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
  return cleaned.slice(0, MAX_TAG_LENGTH);
}

/** Normalise a list of tags: cleaned, de-duplicated, order preserved. */
export function normalizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const tag = normalizeTag(String(item ?? ''));
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/**
 * Split a free-text input into tags. Commas and newlines separate; spaces do
 * not, so "news release" stays one tag rather than becoming two useless ones.
 */
export function parseTagInput(input: string): string[] {
  if (!input) return [];
  return normalizeTags(input.split(/[,\n]/));
}

/** Tags of a trade, normalised. Safe on rows from an unmigrated database. */
export function tagsOf(trade: Pick<Trade, 'tags'>): string[] {
  return normalizeTags(trade?.tags ?? []);
}

export interface TagCount {
  tag: string;
  count: number;
}

/**
 * Every distinct tag in use, most frequent first.
 * Ties break alphabetically so the list does not reshuffle between renders.
 */
export function collectTags(trades: Trade[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const t of trades ?? []) {
    for (const tag of tagsOf(t)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => (b.count - a.count) || a.tag.localeCompare(b.tag));
}

export type TagMatchMode = 'any' | 'all';

export interface TradeFilter {
  /** Free text matched against pair, notes and tags. */
  query?: string;
  /** Selected tags. */
  tags?: string[];
  /** 'all' = every selected tag must be present; 'any' = at least one. */
  tagMode?: TagMatchMode;
  sessions?: string[];
  mentalStates?: string[];
  directions?: Array<'BUY' | 'SELL'>;
  timeframes?: string[];
  /** Monday-first weekday indexes (0 = Monday) on entry_time. */
  weekdays?: number[];
  /** Holding-time buckets as "min-max" in minutes, e.g. "30-60"; "240-" = 4h+. */
  holdingRanges?: string[];
  /** Inclusive bounds on the realised R multiple. */
  minR?: number | null;
  maxR?: number | null;
  /** 'win' | 'loss' | 'open' | 'all' */
  outcome?: 'win' | 'loss' | 'open' | 'all';
}

function matchesText(trade: Trade, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if ((trade.pair ?? '').toLowerCase().includes(q)) return true;
  if ((trade.notes ?? '').toLowerCase().includes(q)) return true;
  // Searching "tired" should find trades tagged tired, not just noted ones.
  return tagsOf(trade).some(tag => tag.includes(q));
}

/**
 * Apply a cross filter. Dimensions combine with AND (each narrows the set);
 * values inside one dimension combine with OR, except tags in 'all' mode.
 *
 * An empty dimension means "no constraint" rather than "match nothing" — the
 * opposite would make the default state show an empty journal.
 */
export function filterTrades(trades: Trade[], filter: TradeFilter): Trade[] {
  const list = trades ?? [];
  const {
    query = '',
    tags = [],
    tagMode = 'any',
    sessions = [],
    mentalStates = [],
    directions = [],
    timeframes = [],
    weekdays = [],
    holdingRanges = [],
    minR = null,
    maxR = null,
    outcome = 'all',
  } = filter ?? {};

  const wanted = normalizeTags(tags);

  return list.filter(t => {
    if (!matchesText(t, query)) return false;

    if (wanted.length > 0) {
      const own = tagsOf(t);
      const ok =
        tagMode === 'all'
          ? wanted.every(tag => own.includes(tag))
          : wanted.some(tag => own.includes(tag));
      if (!ok) return false;
    }

    if (sessions.length > 0 && !sessions.includes(t.session ?? '')) return false;
    if (mentalStates.length > 0 && !mentalStates.includes(t.mental_state ?? '')) {
      return false;
    }
    if (directions.length > 0 && !directions.includes(t.direction)) return false;
    if (timeframes.length > 0 && !timeframes.includes(t.timeframe ?? '')) return false;

    if (weekdays.length > 0) {
      const d = new Date(t.entry_time).getDay();
      if (!weekdays.includes(d === 0 ? 6 : d - 1)) return false;
    }

    if (holdingRanges.length > 0) {
      const mins =
        t.entry_time && t.exit_time
          ? (new Date(t.exit_time).getTime() - new Date(t.entry_time).getTime()) / 60000
          : -1;
      const ok = holdingRanges.some(range => {
        const [loStr, hiStr] = range.split('-');
        const lo = Number(loStr);
        const hi = hiStr === '' || hiStr === undefined ? Infinity : Number(hiStr);
        return mins >= lo && mins < hi;
      });
      if (!ok) return false;
    }

    if (outcome === 'win' && !((t.pnl ?? 0) > 0)) return false;
    if (outcome === 'loss' && !((t.pnl ?? 0) < 0)) return false;
    if (outcome === 'open' && t.pnl !== null && t.pnl !== undefined) return false;

    // R bounds only apply to trades that have an R multiple; a trade without
    // one is excluded rather than treated as 0, which would sit inside most
    // ranges and silently pad the results.
    if (minR !== null || maxR !== null) {
      const r = t.r_multiple;
      if (r === null || r === undefined || !Number.isFinite(r)) return false;
      if (minR !== null && r < minR) return false;
      if (maxR !== null && r > maxR) return false;
    }

    return true;
  });
}

/** True when the filter constrains anything at all. */
export function isFilterActive(filter: TradeFilter): boolean {
  if (!filter) return false;
  return Boolean(
    (filter.query ?? '').trim() ||
      (filter.tags ?? []).length ||
      (filter.sessions ?? []).length ||
      (filter.mentalStates ?? []).length ||
      (filter.directions ?? []).length ||
      (filter.timeframes ?? []).length ||
      filter.minR !== null && filter.minR !== undefined ||
      filter.maxR !== null && filter.maxR !== undefined ||
      (filter.outcome && filter.outcome !== 'all')
  );
}

export interface TagPerformance {
  tag: string;
  trades: number;
  wins: number;
  winRate: number;
  totalPnl: number;
  expectancy: number;
  avgR: number | null;
}

/**
 * Per-tag performance, so a tag is not just a label but an answer.
 *
 * Only closed trades count: an open position has no result to attribute.
 * Tags below `minTrades` are dropped — ranking a tag on two trades would
 * present noise as an insight, which is the failure mode this whole module
 * exists to avoid.
 */
export function tagPerformance(trades: Trade[], minTrades = 3): TagPerformance[] {
  const closed = (trades ?? []).filter(
    t => t && t.pnl !== null && t.pnl !== undefined && Number.isFinite(t.pnl)
  );

  const groups = new Map<string, Trade[]>();
  for (const t of closed) {
    for (const tag of tagsOf(t)) {
      const arr = groups.get(tag);
      if (arr) arr.push(t);
      else groups.set(tag, [t]);
    }
  }

  const out: TagPerformance[] = [];
  for (const [tag, list] of groups) {
    if (list.length < minTrades) continue;
    const wins = list.filter(t => (t.pnl ?? 0) > 0).length;
    const totalPnl = list.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const rs = list
      .map(t => t.r_multiple)
      .filter((r): r is number => r !== null && r !== undefined && Number.isFinite(r));

    out.push({
      tag,
      trades: list.length,
      wins,
      winRate: Math.round((wins / list.length) * 1000) / 10,
      totalPnl: Math.round(totalPnl * 100) / 100,
      expectancy: Math.round((totalPnl / list.length) * 100) / 100,
      avgR:
        rs.length > 0
          ? Math.round((rs.reduce((a, b) => a + b, 0) / rs.length) * 100) / 100
          : null,
    });
  }

  // Worst expectancy first: the point of tagging is to find what to stop doing.
  return out.sort((a, b) => a.expectancy - b.expectancy);
}
