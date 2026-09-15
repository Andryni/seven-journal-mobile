/**
 * Session and timeframe inference for imported trades.
 *
 * Imported trades arrive with no session and no timeframe, and useAnalytics
 * buckets a null session as 'Over Session'. So a clean import silently claims
 * the trader takes every trade outside the main sessions, and the session
 * breakdown becomes noise. Inferring both from the timestamps the broker did
 * give us is strictly better than that -- and unlike the P&L figures, these
 * are labels, not money, so a reasonable inference is acceptable.
 *
 * Windows are expressed in UTC because sessions are tied to exchange clocks,
 * not to the phone's locale. They follow the usual FX convention:
 *   Asia    23:00-07:00 UTC (Tokyo)
 *   London  07:00-12:00 UTC
 *   NY      12:00-21:00 UTC (includes the London/NY overlap, where most of
 *           the volume actually trades)
 * Anything else is genuinely outside the main sessions.
 */

export type SessionId = 'Asia' | 'London' | 'New York' | 'Over Session';
export type TimeframeId = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

/** Infers the session from an ISO entry timestamp. */
export function detectSession(entryTimeIso: string): SessionId | null {
  const d = new Date(entryTimeIso);
  if (isNaN(d.getTime())) return null;

  const hour = d.getUTCHours();
  if (hour >= 23 || hour < 7) return 'Asia';
  if (hour < 12) return 'London';
  if (hour < 21) return 'New York';
  return 'Over Session';
}

/**
 * Infers the timeframe a trade was likely managed on, from how long it was held.
 *
 * This is a heuristic and deliberately coarse. A trade held four minutes was
 * not a daily-chart position; a trade held three days was not an M1 scalp.
 * Returns null for open trades rather than guessing from a missing exit.
 */
export function detectTimeframe(
  entryTimeIso: string,
  exitTimeIso: string | null,
): TimeframeId | null {
  if (!exitTimeIso) return null;

  const entry = new Date(entryTimeIso).getTime();
  const exit = new Date(exitTimeIso).getTime();
  if (isNaN(entry) || isNaN(exit)) return null;

  const minutes = (exit - entry) / 60000;
  // A negative or zero hold means the export's columns disagree; don't guess.
  if (minutes <= 0) return null;

  if (minutes < 5) return 'M1';
  if (minutes < 20) return 'M5';
  if (minutes < 90) return 'M15';
  if (minutes < 6 * 60) return 'H1';
  if (minutes < 36 * 60) return 'H4';
  return 'D1';
}
