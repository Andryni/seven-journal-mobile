/**
 * A failed sync RPC, turned into a sentence the trader can act on.
 *
 * Two facts about the shape of a Supabase failure made the queue's first
 * "show the real error" attempt useless on the device:
 *
 * 1. PostgREST does NOT throw. `supabase.rpc(...)` resolves `{ data, error }`
 *    where `error` is a PLAIN OBJECT — `{ message, details, hint, code }`. A
 *    PostgrestError instance is only constructed when `throwOnError` is set,
 *    and a failed fetch is normalised into that very same shape. Code that
 *    guarded on `err instanceof Error` therefore found no message at all and
 *    fell through to the generic "Échec — réessayez" toast — which is exactly
 *    the toast that hid why promotion was failing.
 * 2. The raw text is written for a DBA: 'no target account for staging <uuid>',
 *    'staging row not pending', 'new row for relation "trades" violates check
 *    constraint "trades_result_check"'. Each of those has one obvious next
 *    action, so the ones we recognise are translated; anything else is passed
 *    through verbatim rather than replaced by a generic lie.
 *
 * Pure and dependency-free (a type-only import of `TFunction`), so the logic
 * tests run in the node project next to the other sync helpers.
 */

import type { TFunction } from '../../i18n';

/**
 * Text that names a SQL object the caller's database is missing or carrying in
 * an older version (unknown function, missing column, older check constraint).
 * The message itself means nothing on a phone; the actionable version is
 * "re-run the schema", which the caller appends.
 */
const SCHEMA_ISSUE_RE =
  /does not exist|schema cache|could not find the function|could not find the rpc|violates check constraint/i;

/**
 * Server failures with exactly one sensible next move, keyed by the text the
 * server raises. Matched in order; the first hit wins.
 */
const KNOWN_FAILURES = [
  [/no target account for staging/i, 'syncErrNoRouting'],
  [/bad target account for staging/i, 'syncErrBadAccount'],
  [/staging row not pending|trade not found/i, 'syncErrNotPending'],
  [/unauthenticated|not authenticated|invalid claim|\bjwt\b/i, 'syncErrAuth'],
  [
    /network request failed|failed to fetch|fetcherror|networkerror|abort|timeout/i,
    'syncErrNetwork',
  ],
] as const;

export type KnownFailureKey = (typeof KNOWN_FAILURES)[number][1];

/**
 * The message carried by anything we might have been handed: an Error, the
 * `{ message, details, hint }` object PostgREST resolves, a bare string, or
 * nothing at all.
 *
 * A PL/pgSQL `raise exception` puts its own SQLSTATE prefix in the text
 * ('P0001: …'), which is noise on a phone screen — stripped here, once.
 */
export function errorText(err: unknown): string {
  let raw = '';
  if (typeof err === 'string') {
    raw = err;
  } else if (err instanceof Error) {
    raw = err.message;
  } else if (typeof err === 'object' && err !== null) {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown };
    // message first: details can be the whole failing row, so it only fills a
    // gap message left empty (a 5xx with no body, for instance).
    const found = [e.message, e.details, e.hint].find(
      (v): v is string => typeof v === 'string' && v.trim() !== '',
    );
    raw = found ?? '';
  } else if (err != null) {
    raw = String(err);
  }
  return raw.replace(/^P0001:\s*/, '').trim();
}

/** True when the server is telling us its schema is missing or outdated. */
export function needsSchema(raw: string): boolean {
  return SCHEMA_ISSUE_RE.test(raw);
}

/**
 * The i18n key for a recognised server failure, or null when the text is not
 * one we can translate. Exported so the mapping is covered by tests without
 * mounting the hook.
 */
export function knownFailureKey(raw: string): KnownFailureKey | null {
  for (const [pattern, key] of KNOWN_FAILURES) {
    if (pattern.test(raw)) return key;
  }
  return null;
}

/**
 * What the toast should say: the translated next step when we recognise the
 * failure, the server's own words (plus the schema hint) when we do not, and
 * the caller's fallback when there is nothing at all to show.
 */
export function failureText(err: unknown, t: TFunction, fallback: string): string {
  const raw = errorText(err);
  if (!raw) return fallback;
  const key = knownFailureKey(raw);
  if (key) return t(key);
  return needsSchema(raw) ? `${raw} — ${t('syncSchemaHint')}` : raw;
}
