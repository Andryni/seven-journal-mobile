/**
 * Economic calendar — Supabase Edge Function.
 *
 * Fetches the public ForexFactory JSON feed, keeps only high-impact events on
 * the currencies this journal trades, and caches the result in memory.
 *
 * CONTRACT: the emitted rows ARE the client's EconomicEvent shape
 * (title, currency, at, impact, forecast, previous — see
 * src/features/calendar/economicEvents.ts). This function once emitted its
 * own variant while the client parser kept reading the raw feed's field
 * names, so every event was dropped client-side and the dashboard band
 * silently never rendered. The client now tolerates both shapes, but do not
 * rename anything here without checking that file.
 *
 * Why server-side for a feed that needs no key:
 *
 *   1. One fetch serves every device. The feed is a courtesy from
 *      ForexFactory, not a product; hammering it from every phone that opens
 *      the dashboard is how a free feed stops being free.
 *   2. The shape is normalised here. When the upstream format changes -- and
 *      an unofficial feed will -- the app keeps showing "unavailable" while
 *      this function is fixed, instead of every installed copy breaking until
 *      users update.
 *   3. It filters 550 rows down to 20-40 before they cross the network.
 *
 * Honest failure is the contract: an unreachable or malformed feed returns
 * `{ events: [], stale: true }` with 200, never an error the dashboard has to
 * interpret. A calendar that cannot be loaded is information, not a fault.
 */

const FEED_THIS_WEEK = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json';
const FEED_NEXT_WEEK = 'https://nfs.faireconomy.media/ff_calendar_nextweek.json';

/**
 * Cache lifetime.
 *
 * The calendar is a schedule: entries are set days ahead and only `actual`
 * moves at release time, which this function does not surface. Thirty minutes
 * is far fresher than the data changes, and it keeps a whole user base to two
 * upstream requests an hour.
 */
const CACHE_MS = 30 * 60 * 1000;

/** Currencies worth showing. Mirrors TRACKED_CURRENCIES on the client. */
const CURRENCIES = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'NZD', 'CHF']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

interface CalendarEvent {
  title: string;
  currency: string;
  at: string;
  impact: string;
  forecast: string | null;
  previous: string | null;
}

let cache: { at: number; events: CalendarEvent[] } | null = null;

function str(x: unknown, max: number): string | null {
  if (typeof x !== 'string') return null;
  const v = x.trim();
  return v.length > 0 ? v.slice(0, max) : null;
}

/**
 * One raw row to an event, or null.
 *
 * Same discipline as every other function here: rebuild field by field
 * rather than forwarding whatever arrived. A row missing a usable date is
 * dropped, not defaulted -- a bad date sorts to 1970 and would pin itself to
 * the top of "what is next".
 */
function normalise(raw: unknown): CalendarEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;

  const title = str(r.title, 120);
  const currency = str(r.country, 8)?.toUpperCase();
  const dateStr = str(r.date, 40);
  const impact = str(r.impact, 16);
  if (!title || !currency || !dateStr || !impact) return null;

  // High impact only, tracked currencies only -- the filter that turns 550
  // rows a week into something a dashboard band can carry.
  if (impact.toLowerCase() !== 'high') return null;
  if (!CURRENCIES.has(currency)) return null;

  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;

  return {
    title,
    currency,
    at: d.toISOString(),
    impact: 'High',
    forecast: str(r.forecast, 24),
    previous: str(r.previous, 24),
  };
}

async function fetchFeed(url: string): Promise<CalendarEvent[]> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`upstream ${res.status}`);
  const payload = await res.json();
  if (!Array.isArray(payload)) throw new Error('unexpected shape');
  return payload.map(normalise).filter((e): e is CalendarEvent => e !== null);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  // The gateway verifies the JWT (verify_jwt stays true), so reaching here
  // already means an authenticated caller. No per-user data is involved.
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) {
    return json({ events: cache.events, cachedAt: cache.at, stale: false });
  }

  try {
    // Next week matters on a Friday: without it the band goes blank for the
    // weekend exactly when a trader is planning the week ahead.
    const [thisWeek, nextWeek] = await Promise.allSettled([
      fetchFeed(FEED_THIS_WEEK),
      fetchFeed(FEED_NEXT_WEEK),
    ]);

    const events = [
      ...(thisWeek.status === 'fulfilled' ? thisWeek.value : []),
      ...(nextWeek.status === 'fulfilled' ? nextWeek.value : []),
    ].sort((a, b) => a.at.localeCompare(b.at));

    if (thisWeek.status === 'rejected' && nextWeek.status === 'rejected') {
      throw new Error('both feeds failed');
    }

    cache = { at: now, events };
    return json({ events, cachedAt: now, stale: false });
  } catch (err) {
    console.error('calendar: feed failed', err);

    /**
     * Serve the stale cache rather than nothing.
     *
     * A schedule from an hour ago is still a correct schedule; the events
     * have not moved. `stale: true` lets the app say so instead of implying
     * freshness it cannot vouch for.
     */
    if (cache) {
      return json({ events: cache.events, cachedAt: cache.at, stale: true });
    }
    return json({ events: [], cachedAt: null, stale: true });
  }
});
