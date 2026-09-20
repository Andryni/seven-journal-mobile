/**
 * Pure helpers for the auto-journal sync feature.
 *
 * Mirrors, in TypeScript for the app, what the Edge Function and the SQL
 * enforce server-side: symbol canonicalisation and the human-facing shape of
 * a queue row. Kept free of Supabase imports so the logic tests run in plain
 * node (jest logic project), like the rest of src/features.
 *
 * Schema: supabase/schema.sql SECTION 4. Design: docs/auto-journal-sync.md.
 */

export type SyncStatus = 'pending' | 'promoted' | 'linked' | 'dismissed' | 'stale';
export type SyncResolution = 'created' | 'linked' | 'dismissed';
export type CloseReason = 'TP' | 'SL' | 'BE' | 'CLOSED';

/** One pending row of the validation queue, as read through PostgREST. */
export interface SyncTradeRow {
  id: string;
  external_id: string;
  payload: SyncPayload | null;
  is_open: boolean;
  open_time: string | null;
  close_time: string | null;
  status: SyncStatus;
  /**
   * How the row was decided. An OPEN position is promoted while still open, so
   * its row deliberately stays `pending` (the close event has to complete the
   * journal trade) — which means `status` alone cannot tell "not decided yet"
   * from "already created in the journal". A non-null resolution does.
   */
  resolution?: SyncResolution | null;
  created_at: string;
}

/** The payload the Edge Function normalised (see parseEvent there). */
export interface SyncPayload {
  external_id?: string;
  symbol?: string;
  direction?: 'BUY' | 'SELL';
  size?: number;
  entry_price?: number;
  entry_time?: string;
  is_open?: boolean;
  close_time?: string | null;
  pnl?: number | null;
  commission?: number | null;
  swap?: number | null;
  close_reason?: CloseReason | null;
  stop_loss?: number | null;
  take_profit?: number | null;
  exits?: { size: number; price: number; exit_time: string; pnl?: number | null }[];
  pnl_gap?: number | null;
}

/**
 * Broker symbol -> canonical pair, same rule as the SQL `normalize_pair()`:
 * EURUSD.m, EURUSDm, eurusd-pro fold to EURUSD. Used for display and for the
 * client-side candidate hints; the server re-derives it at match time.
 */
export function normalizePair(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .trim()
    .toUpperCase()
    // Optional separator: EURUSD.m, EURUSDm, eurusd-pro, GBPJPY-cash all fold.
    .replace(/[.\-]?(RAW|CASH|PRO|M|C|A)$/, '');
}

/**
 * i18n key for the broker close reason. Returns translation keys (typed
 * against the dictionary) rather than raw words, so the caller can do
 * t(closeReasonLabel(reason)) with no further mapping.
 */
export function closeReasonLabel(
  reason: CloseReason | null | undefined,
): 'syncReasonTP' | 'syncReasonSL' | 'syncReasonBE' | 'syncReasonCLOSED' {
  switch (reason) {
    case 'TP':
      return 'syncReasonTP';
    case 'SL':
      return 'syncReasonSL';
    case 'BE':
      return 'syncReasonBE';
    default:
      return 'syncReasonCLOSED';
  }
}

/**
 * The display shape of a queue card. Computed once per row so the screen
 * stays a dumb renderer; every field is optional because the queue must
 * render even a malformed payload rather than crash on it.
 */
export interface QueueCard {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  size: number | null;
  entryPrice: number | null;
  entryTime: string | null;
  isOpen: boolean;
  closeTime: string | null;
  pnl: number | null;
  closeReason: CloseReason | null;
  exitsCount: number;
  /** |journal pnl - broker pnl| recorded at link time, surfaced on the card. */
  pnlGap: number | null;
  /**
   * An open position the heartbeat no longer sees: the terminal closed the
   * app, moved on, or the row predates a connector's re-install. Recoverable
   * by design (the bridge re-sends it on sight), so it shows as its own
   * quiet state instead of polluting the pending count.
   */
  isStale?: boolean;
  /**
   * Already created in the journal (position promoted while still open, its
   * trade completed when the broker closes it). The row is waiting on the
   * broker, not on the human: promoting it again would insert a SECOND trade
   * for the same position, so the card states the decision instead of
   * offering it a second time.
   */
  alreadyJournaled: boolean;
}

/**
 * True when a queue row still waits on the human. Only `pending` rows can be
 * promoted/linked/dismissed (every server RPC guards on that status), and a
 * row that already carries a resolution is a decision already made: promoting
 * it again would create a second journal trade, dismissing it would strand
 * the one the broker still has to close.
 */
export function isActionable(row: SyncTradeRow): boolean {
  return row.status === 'pending' && row.resolution == null;
}

export function toQueueCard(row: SyncTradeRow): QueueCard {
  const p = row.payload ?? {};
  const num = (x: unknown): number | null =>
    typeof x === 'number' && isFinite(x) ? x : null;

  return {
    id: row.id,
    symbol: normalizePair(p.symbol),
    direction: p.direction === 'SELL' ? 'SELL' : 'BUY',
    size: num(p.size),
    entryPrice: num(p.entry_price),
    entryTime: row.open_time ?? p.entry_time ?? null,
    isOpen: row.is_open === true,
    closeTime: row.close_time ?? p.close_time ?? null,
    pnl: num(p.pnl),
    closeReason: (p.close_reason as CloseReason) ?? null,
    exitsCount: Array.isArray(p.exits) ? p.exits.length : 0,
    pnlGap: num(p.pnl_gap),
    isStale: row.status === 'stale',
    alreadyJournaled: row.resolution != null,
  };
}
