/**
 * Can this terminal answer a completion request?
 *
 * The app asks the EA to re-send the levels it never captured (SL/TP, MAE/MFE)
 * and then shows that promise to the trader. Whether the terminal can honour it
 * depends entirely on which EA build is attached — and until now the app had no
 * way to know, so a request could sit unanswered forever with nothing on screen
 * explaining why.
 *
 * The heartbeat carries `ea_version` from v1.16 onward (the build that also
 * fixed rebuilding a STILL-OPEN position). Absence is therefore itself a
 * statement: the attached EA predates the field, so it is at most v1.15.
 *
 * Two thresholds, because the capability landed in two steps:
 *   - v1.15 implemented the answer path at all (heartbeat request -> rebuild ->
 *     resend).
 *   - v1.16 made that answer correct for a position that is still OPEN, which
 *     is the common case for a trade promoted while live.
 *
 * Pure and dependency-light (a structural input), so the comparison — numeric,
 * never lexical: "1.9" is older than "1.15" — stays unit-tested.
 */

/** Only the facts the policy reads: any ingest row is structurally assignable. */
export interface EaVersionFacts {
  /** Version reported by the heartbeat, or null when it reported none. */
  ea_version: string | null;
  /** Null until the terminal beats once: there is nothing to judge before that. */
  last_sync_at: string | null;
  /**
   * True when the row came from a fallback column set, i.e. on a database the
   * latest schema.sql has not been re-run on. The version was then never even
   * QUERIED, and "no version" there says nothing about the terminal — warning
   * about an outdated EA because of a missing column would be a lie the trader
   * would chase for an hour.
   */
  schema_partial?: boolean;
}

/** First build that can answer a completion request at all. */
export const EA_MIN_ANSWER = { major: 1, minor: 15 } as const;

/** First build that answers correctly for a position that is still open. */
export const EA_MIN_LIVE_ANSWER = { major: 1, minor: 16 } as const;

/**
 * First build that can answer a candle request (the trade replay).
 *
 * Its own threshold, not folded into the one above: a terminal that can resend
 * levels cannot necessarily draw a chart, and the app must not offer a button
 * the attached build will ignore. Absence of a version means older than the
 * field, which is older than this capability — so "unreported" is a no.
 */
export const EA_MIN_CANDLES = { major: 1, minor: 17 } as const;

/**
 * The build this APP SHIPS (assets/ea/SevenJournalSync.mq5), and therefore the
 * one a trader gets from the connector sheet's "get the EA file" action.
 *
 * It has to be at least EA_MIN_LIVE_ANSWER — handing out a file older than the
 * capability the same screen promises would be a bug that only shows up a week
 * later on someone's VPS. shippedEa.test.ts asserts it against the bundled
 * source, so the constant cannot drift from the file.
 */
export const EA_SHIPPED_VERSION = { major: 1, minor: 17 } as const;

/** "v1.16" — what the download button says. */
export const EA_SHIPPED_LABEL = `v${EA_SHIPPED_VERSION.major}.${EA_SHIPPED_VERSION.minor}`;

export type EaSupport =
  /**
   * Say nothing: either the terminal never beat, or the database does not have
   * the column yet. Both mean the app has nothing to judge.
   */
  | 'never'
  /** Heartbeats, no version field: an EA older than v1.16, of unknown build. */
  | 'unreported'
  /** Older than v1.15: cannot answer a completion request. */
  | 'legacy'
  /** v1.15: answers, but only for positions the broker has already closed. */
  | 'partial'
  /** v1.16 or newer: answers, live positions included. */
  | 'current';

interface ParsedVersion {
  major: number;
  minor: number;
}

/**
 * "1.16", "v1.16", "1.16.2 — build 4" all parse; anything without two leading
 * numbers does not, and an unreadable version must never be treated as a good
 * one.
 */
export function parseEaVersion(raw: string | null | undefined): ParsedVersion | null {
  if (typeof raw !== 'string') return null;
  const m = raw.match(/(\d+)\s*\.\s*(\d+)/);
  if (!m) return null;
  const major = Number(m[1]);
  const minor = Number(m[2]);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return { major, minor };
}

function atLeast(v: ParsedVersion, min: ParsedVersion): boolean {
  if (v.major !== min.major) return v.major > min.major;
  return v.minor >= min.minor;
}

/** What the reported version allows, most useful verdict last. */
export function eaSupport(facts: EaVersionFacts): EaSupport {
  if (!facts.last_sync_at || facts.schema_partial) return 'never';

  const parsed = parseEaVersion(facts.ea_version);
  if (!parsed) return 'unreported';
  if (!atLeast(parsed, EA_MIN_ANSWER)) return 'legacy';
  if (!atLeast(parsed, EA_MIN_LIVE_ANSWER)) return 'partial';
  return 'current';
}

/**
 * Whether the attached build can answer a candle request.
 *
 * Stricter than eaSupport() on purpose: candle requests arrive in their own
 * heartbeat array ("candle_requests"), which an older EA does not read at all —
 * it would simply never answer, and the request would sit pending forever with
 * the trader tapping a button that does nothing.
 */
export function eaSupportsCandles(facts: EaVersionFacts): boolean {
  if (!facts.last_sync_at || facts.schema_partial) return false;

  const parsed = parseEaVersion(facts.ea_version);
  if (!parsed) return false;

  return atLeast(parsed, EA_MIN_CANDLES);
}

/** The version as the trader should read it ("v1.16"), or null when unheard. */
export function eaVersionLabel(raw: string | null | undefined): string | null {
  const parsed = parseEaVersion(raw);
  return parsed ? `v${parsed.major}.${parsed.minor}` : null;
}
