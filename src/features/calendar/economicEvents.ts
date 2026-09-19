/**
 * Normalising the ForexFactory calendar feed.
 *
 * Source: https://nfs.faireconomy.media/ff_calendar_thisweek.json — public,
 * no key, no account. Chosen over Finnhub (whose economic calendar is
 * premium-gated and whose free licence is non-commercial) and over the paid
 * scrapers that resell this very feed.
 *
 * It is UNOFFICIAL. ForexFactory publishes it for its community without
 * promising anything, so every field here is treated as untrusted: a shape
 * change must produce an empty list and an honest "unavailable", never a
 * crash or an invented event.
 *
 * Pure and network-free on purpose. The fetching, caching and failure
 * handling belong to the Edge Function; what deserves tests is the parsing,
 * the filtering and the time arithmetic — the parts that decide whether a
 * trader is warned before NFP or after it.
 */

/** Impact levels the feed emits. 'Holiday' exists and is not an event. */
export type EventImpact = 'High' | 'Medium' | 'Low' | 'Holiday';

export interface EconomicEvent {
  /** e.g. "Core CPI m/m". */
  title: string;
  /** ISO 4217-ish currency code as the feed writes it, e.g. "USD". */
  currency: string;
  /** Absolute instant, UTC. The feed sends US/Eastern offsets. */
  at: string;
  impact: EventImpact;
  forecast: string | null;
  previous: string | null;
}

/**
 * Currencies worth showing.
 *
 * The feed also carries "All" (global summits) and "CNY". Both are dropped:
 * "All" has no currency to position against, and nothing in this journal
 * trades the yuan. Keeping them would add noise to a band whose whole value
 * is being short.
 */
export const TRACKED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'JPY',
  'CAD',
  'AUD',
  'NZD',
  'CHF',
] as const;

export type TrackedCurrency = (typeof TRACKED_CURRENCIES)[number];

const IMPACTS: EventImpact[] = ['High', 'Medium', 'Low', 'Holiday'];

function asString(x: unknown, max = 120): string | null {
  if (typeof x !== 'string') return null;
  const v = x.trim();
  return v.length > 0 ? v.slice(0, max) : null;
}

/**
 * One raw row to a normalised event, or null when it cannot be trusted.
 *
 * Returning null rather than a partial event matters: a row with an
 * unparseable date would otherwise sort to 1970 and sit permanently at the
 * top of "what is coming".
 *
 * Accepts BOTH field conventions the pipeline has used: the raw feed's
 * (country, date) and the normalised one (currency, at). The Edge Function
 * returned its own normalised shape while this parser kept reading the raw
 * one, so every event was dropped and the dashboard band silently never
 * rendered. Tolerating both here is cheaper than coupling the deploy times.
 */
export function parseEvent(raw: unknown): EconomicEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const title = asString(r.title);
  // `country` is the raw feed's name for the currency, `currency` the
  // normalised one — accept either.
  const currency = asString(r.country, 8) ?? asString(r.currency, 8);
  // Same duality for the date: `date` raw (with offset), `at` normalised ISO.
  const dateStr = asString(r.date, 40) ?? asString(r.at, 40);
  if (!title || !currency || !dateStr) return null;

  const parsed = new Date(dateStr);
  if (Number.isNaN(parsed.getTime())) return null;

  const impactRaw = asString(r.impact, 16);
  const impact = IMPACTS.find(i => i.toLowerCase() === impactRaw?.toLowerCase());
  if (!impact) return null;

  return {
    title,
    currency: currency.toUpperCase(),
    at: parsed.toISOString(),
    impact,
    forecast: asString(r.forecast, 24),
    previous: asString(r.previous, 24),
  };
}

/** Parse a whole feed, discarding rows that do not survive parseEvent. */
export function parseFeed(payload: unknown): EconomicEvent[] {
  if (!Array.isArray(payload)) return [];
  return payload
    .map(parseEvent)
    .filter((e): e is EconomicEvent => e !== null)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export interface FilterOptions {
  /** Only these currencies. Defaults to TRACKED_CURRENCIES. */
  currencies?: readonly string[];
  /** Only this impact and above. Defaults to High. */
  minImpact?: 'High' | 'Medium';
}

/**
 * High-impact only, tracked currencies only.
 *
 * The feed carries roughly 550 events a week. Unfiltered that is a wall
 * nobody reads; filtered to High it is 20-40, which is the difference
 * between a band a trader glances at and one they learn to ignore.
 */
export function filterEvents(
  events: EconomicEvent[],
  opts: FilterOptions = {}
): EconomicEvent[] {
  const currencies = new Set(
    (opts.currencies ?? TRACKED_CURRENCIES).map(c => c.toUpperCase())
  );
  const allowMedium = opts.minImpact === 'Medium';

  return events.filter(e => {
    if (!currencies.has(e.currency)) return false;
    if (e.impact === 'High') return true;
    return allowMedium && e.impact === 'Medium';
  });
}

/** Events still ahead of `now`, soonest first. */
export function upcoming(
  events: EconomicEvent[],
  now: Date = new Date(),
  limit = 5
): EconomicEvent[] {
  const t = now.getTime();
  return events.filter(e => new Date(e.at).getTime() >= t).slice(0, limit);
}

/** Events sharing the local calendar day of `now`. */
export function onLocalDay(events: EconomicEvent[], now: Date = new Date()): EconomicEvent[] {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return events.filter(e => {
    const d = new Date(e.at);
    return d >= start && d < end;
  });
}

/**
 * Minutes until an event; negative once it has passed.
 *
 * Returned as a number rather than a formatted string so the caller owns the
 * wording — "in 2h" on the dashboard, "dans 2 h" in French, "now" inside a
 * five-minute window.
 */
export function minutesUntil(event: EconomicEvent, now: Date = new Date()): number {
  return Math.round((new Date(event.at).getTime() - now.getTime()) / 60000);
}

/**
 * The single event a one-line banner should show, if any.
 *
 * Prefers the next one still ahead; falls back to one that just happened,
 * because "CPI was 20 minutes ago" explains a chaotic chart better than
 * silence does. Anything further than 24h out is not actionable today.
 */
export function bannerEvent(
  events: EconomicEvent[],
  now: Date = new Date()
): EconomicEvent | null {
  const AHEAD_LIMIT = 24 * 60;
  const BEHIND_LIMIT = 60;

  let best: EconomicEvent | null = null;
  let bestScore = Infinity;

  for (const e of events) {
    const m = minutesUntil(e, now);
    if (m > AHEAD_LIMIT || m < -BEHIND_LIMIT) continue;
    // Upcoming events win over past ones at equal distance.
    const score = m >= 0 ? m : -m + AHEAD_LIMIT;
    if (score < bestScore) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}
