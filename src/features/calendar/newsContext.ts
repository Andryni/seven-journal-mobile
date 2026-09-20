import type { EconomicEvent } from './economicEvents';

/**
 * The macro context a trade was taken in.
 *
 * The calendar was already in the app — fetched, filtered to high-impact
 * events, shown as a band on the dashboard — and it was the only piece of
 * context that evaporated the moment a trade was saved. So the journal could
 * tell you your win rate by hour, by session, by mental state… and not by
 * "traded into CPI", which is the one a discretionary trader actually loses
 * money on.
 *
 * Recorded at write time, from the calendar already in cache: a trade logged
 * three days later cannot recover what the trader knew at the time, and
 * re-deriving it later would be inventing history. When the cache is empty,
 * nothing is recorded — NULL means "unknown", never "nothing happened".
 *
 * Pure: no network, no cache, no clock beyond the instant passed in.
 */

export interface NewsContext {
  /** Event title as published, e.g. "Core CPI m/m". */
  event: string;
  /** Currency the event belongs to, e.g. "USD". */
  currency: string;
  /**
   * Signed minutes from the release: negative BEFORE it, positive after.
   * The sign is the point — entering three minutes early and three minutes
   * late are different behaviours, and a magnitude would erase the difference.
   */
  offsetMin: number;
}

/** How far either side of a release a trade still counts as "at the news". */
export const NEWS_WINDOW_MIN = 30;

/**
 * The nearest high-impact event to `at`, within the window, or null.
 *
 * Nearest, not first: an entry 4 minutes after CPI must be attributed to CPI
 * even if NFP is 26 minutes away. Ties (equidistant before and after) resolve
 * to the event that has already happened, because that is the one whose effect
 * the price was showing.
 */
export function newsContextAt(
  at: string | number | Date,
  events: readonly EconomicEvent[],
  windowMin: number = NEWS_WINDOW_MIN
): NewsContext | null {
  const t = new Date(at).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(windowMin) || windowMin < 0) return null;

  let best: NewsContext | null = null;
  let bestDistance = Infinity;

  for (const e of events) {
    if (e.impact !== 'High') continue;

    const eventMs = new Date(e.at).getTime();
    if (!Number.isFinite(eventMs)) continue;

    const offsetMin = Math.round((t - eventMs) / 60000);
    const distance = Math.abs(offsetMin);
    if (distance > windowMin) continue;

    if (distance < bestDistance || (distance === bestDistance && offsetMin > 0)) {
      bestDistance = distance;
      best = { event: e.title, currency: e.currency, offsetMin };
    }
  }

  return best;
}

/**
 * Whether the moment is close enough to a release to warn before saving.
 *
 * Deliberately tighter than NEWS_WINDOW_MIN: the windows answer different
 * questions. The recorded context may reasonably include a trade twenty
 * minutes after a release, while a warning that fires on it would be noise —
 * the number on screen is a caution, and a caution that is always there is not
 * read.
 */
export const NEWS_WARN_MIN = 5;

export function newsWarningAt(
  at: string | number | Date,
  events: readonly EconomicEvent[],
  windowMin: number = NEWS_WARN_MIN
): NewsContext | null {
  return newsContextAt(at, events, windowMin);
}

/** "USD Core CPI m/m · dans 3 min" / "il y a 12 min". */
export function formatNewsOffset(offsetMin: number, lang: string): string {
  const n = Math.abs(offsetMin);
  const en = lang === 'en';
  if (n === 0) return en ? 'at the release' : 'à la publication';
  if (offsetMin < 0) {
    return en ? `in ${n} min` : `dans ${n} min`;
  }
  return en ? `${n} min ago` : `il y a ${n} min`;
}
