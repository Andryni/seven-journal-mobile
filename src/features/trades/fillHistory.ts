/**
 * Change history for values the app writes on the trader's behalf.
 *
 * Two writer surfaces exist and both act FOR the trader: the one-tap
 * "complete from broker" button (per-row fill and batch), and the chat's
 * confirmed actions. A figure written by either must be traceable to its
 * origin — qui a rempli quoi, quand — because a journal stat computed from
 * an auto-filled value should be as auditable as a value typed by hand.
 *
 * Hand edits in the trade form are deliberately NOT logged: they carry no
 * provenance problem, and logging every keystroke-equivalent write would
 * drown the signal this table exists to carry.
 *
 * Pure module: no supabase import, so the shapes and the display tokens
 * stay unit-testable and the hook below keeps all I/O.
 */

/** The surfaces that write on the trader's behalf (auto = background fill after a bridge sync, user = an undo they pressed). */
export type FillSource = 'app_button' | 'chat' | 'auto' | 'user';

/** What kind of value was written. */
export type FillKind = 'costs' | 'r_multiple' | 'tag' | 'mental_state';

export interface FillHistoryRow {
  id: string;
  trade_id: string;
  source: FillSource;
  kind: FillKind;
  /** Numeric magnitude: |commission|+|swap| for costs, the R for r_multiple, 0 for text kinds. */
  value: number;
  /** The written text when the kind is textual (tag, mental state). */
  detail: string | null;
  created_at: string;
}

export type FillHistoryEntry = FillHistoryRow;

/**
 * One write the fill/chat path just made. Built at the write site from the
 * same values the patch applied, so the log cannot drift from the write.
 */
export interface FillHistoryWrite {
  tradeId: string;
  source: FillSource;
  kind: FillKind;
  /** Commission and swap as positive magnitudes; used only for costs. */
  commission?: number;
  swap?: number;
  /** The derived R; used only for r_multiple. */
  rMultiple?: number;
  /** The written text; used only for tag and mental_state. */
  detail?: string;
}

/** Insert payload for one logged write. */
export function historyInsertFor(w: FillHistoryWrite, userId: string) {
  const value =
    w.kind === 'costs'
      ? Math.abs(w.commission ?? 0) + Math.abs(w.swap ?? 0)
      : w.kind === 'r_multiple'
        ? Math.abs(w.rMultiple ?? 0)
        : 0;
  return {
    user_id: userId,
    trade_id: w.tradeId,
    source: w.source,
    kind: w.kind,
    value,
    detail: w.detail ?? null,
  };
}

function asString(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return s.length > 0 ? s.slice(0, max) : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  return v;
}

/**
 * Server rows to display rows. A row that arrives mangled (unknown source or
 * kind, non-finite value) is dropped rather than half-rendered: history that
 * cannot be trusted is worse than history not shown.
 */
export function parseHistoryRow(raw: unknown): FillHistoryEntry | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const id = asString(r.id, 64);
  const tradeId = asString(r.trade_id, 64);
  if (!id || !tradeId) return null;

  const source = r.source;
  if (source !== 'app_button' && source !== 'chat' && source !== 'auto' && source !== 'user') return null;

  const kind = r.kind;
  if (kind !== 'costs' && kind !== 'r_multiple' && kind !== 'tag' && kind !== 'mental_state') {
    return null;
  }

  const value = asNumber(r.value);
  if (value === null) return null;

  return {
    id,
    trade_id: tradeId,
    source,
    kind,
    value,
    detail: asString(r.detail, 60),
    created_at: asString(r.created_at, 40) ?? '',
  };
}

/** Entries for one trade, newest first, capped to what a modal can show. */
export function historyForTrade(rows: unknown[], tradeId: string, limit = 8): FillHistoryEntry[] {
  const parsed = rows
    .map(parseHistoryRow)
    .filter((e): e is FillHistoryEntry => e !== null)
    .filter(e => e.trade_id === tradeId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return parsed.slice(0, limit);
}

/**
 * Per-trade summary for the detail modal: counts by kind plus the most
 * recent write of each writer surface. The trader's mental model is "the
 * button did it" or "the coach did it", so provenance is displayed by
 * surface name, not by an abstract source id.
 */
export interface TradeFillInfo {
  counts: { costs: number; r: number; other: number };
  /** Most recent app_button write, or null. */
  lastButton: FillHistoryEntry | null;
  /** Most recent chat write, or null. */
  lastChat: FillHistoryEntry | null;
  /** Most recent background (post-sync) write, or null. */
  lastAuto: FillHistoryEntry | null;
}

const EMPTY_INFO: TradeFillInfo = {
  counts: { costs: 0, r: 0, other: 0 },
  lastButton: null,
  lastChat: null,
  lastAuto: null,
};

export function fillInfoForTrade(rows: unknown[], tradeId: string): TradeFillInfo {
  const mine = historyForTrade(rows, tradeId, 50);
  if (mine.length === 0) return EMPTY_INFO;

  const counts = { costs: 0, r: 0, other: 0 };
  let lastButton: FillHistoryEntry | null = null;
  let lastChat: FillHistoryEntry | null = null;
  let lastAuto: FillHistoryEntry | null = null;
  for (const e of mine) {
    if (e.kind === 'costs') counts.costs += 1;
    else if (e.kind === 'r_multiple') counts.r += 1;
    else counts.other += 1;
    // historyForTrade sorts newest-first, so the first hit is the latest.
    if (!lastButton && e.source === 'app_button') lastButton = e;
    if (!lastChat && e.source === 'chat') lastChat = e;
    if (!lastAuto && e.source === 'auto') lastAuto = e;
  }
  return { counts, lastButton, lastChat, lastAuto };
}

/** ISO date the caller can feed to toLocaleString; '' when unparsable. */
export function historyWhen(entry: FillHistoryEntry): string {
  if (!entry.created_at) return '';
  const d = new Date(entry.created_at);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
