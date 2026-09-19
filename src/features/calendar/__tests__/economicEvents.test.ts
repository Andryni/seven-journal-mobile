import {
  parseEvent,
  parseFeed,
  filterEvents,
  upcoming,
  onLocalDay,
  minutesUntil,
  bannerEvent,
  TRACKED_CURRENCIES,
} from '../economicEvents';

/**
 * The feed is unofficial, so most of these tests are about surviving it
 * rather than consuming it: a shape change must yield an empty list and an
 * honest "unavailable", never a crash or an invented event.
 *
 * Rows below are copied verbatim from a live response.
 */

const row = (over: Record<string, unknown> = {}) => ({
  title: 'Core CPI m/m',
  country: 'USD',
  date: '2026-09-16T08:30:00-04:00',
  impact: 'High',
  forecast: '0.2%',
  previous: '0.3%',
  ...over,
});

describe('parseEvent — trusting nothing', () => {
  it('parses a real row', () => {
    const e = parseEvent(row())!;
    expect(e.title).toBe('Core CPI m/m');
    expect(e.currency).toBe('USD');
    expect(e.impact).toBe('High');
    expect(e.forecast).toBe('0.2%');
  });

  it('converts the feed US/Eastern offset to a UTC instant', () => {
    // 08:30 -04:00 is 12:30 UTC. Getting this wrong would show NFP four
    // hours early, which is worse than not showing it.
    expect(parseEvent(row())!.at).toBe('2026-09-16T12:30:00.000Z');
  });

  it('drops a row with an unparseable date rather than defaulting it', () => {
    // A bad date would sort to 1970 and sit permanently atop "what is next".
    expect(parseEvent(row({ date: 'soon' }))).toBeNull();
    expect(parseEvent(row({ date: '' }))).toBeNull();
  });

  it('drops a row with an unknown impact', () => {
    expect(parseEvent(row({ impact: 'Critical' }))).toBeNull();
  });

  it('accepts the Holiday level the feed really emits', () => {
    expect(parseEvent(row({ impact: 'Holiday' }))!.impact).toBe('Holiday');
  });

  it('accepts the normalised shape the Edge Function emits (currency/at)', () => {
    // The function was emitting its own normalised variant while this parser
    // kept reading the raw feed's field names: every event was dropped and
    // the dashboard band silently never rendered. This is the regression
    // test for that bug.
    const e = parseEvent({
      title: 'Core CPI m/m',
      currency: 'USD',
      at: '2026-09-16T12:30:00.000Z',
      impact: 'High',
      forecast: '0.2%',
      previous: '0.3%',
    })!;
    expect(e).not.toBeNull();
    expect(e.currency).toBe('USD');
    expect(e.at).toBe('2026-09-16T12:30:00.000Z');
  });

  it('still prefers the raw fields when both shapes are present', () => {
    // `date` with offset and `at` ISO describe the same instant; whichever
    // is parsed, the event must survive.
    const e = parseEvent(
      row({ currency: 'EUR', at: '2026-09-16T12:30:00.000Z' })
    )!;
    expect(e.currency).toBe('USD');
  });

  it('treats blank forecast and previous as absent, not empty strings', () => {
    const e = parseEvent(row({ forecast: '', previous: '' }))!;
    expect(e.forecast).toBeNull();
    expect(e.previous).toBeNull();
  });

  it('survives junk of every shape', () => {
    for (const junk of [null, undefined, 42, 'string', [], {}, { title: 'x' }]) {
      expect(() => parseEvent(junk)).not.toThrow();
      expect(parseEvent(junk)).toBeNull();
    }
  });
});

describe('parseFeed', () => {
  it('returns an empty list when the payload is not an array', () => {
    // A shape change must degrade to "unavailable", not throw.
    for (const junk of [null, undefined, {}, 'nope', 7]) {
      expect(parseFeed(junk)).toEqual([]);
    }
  });

  it('keeps the good rows and discards the bad ones', () => {
    const feed = [row(), { title: 'broken' }, row({ country: 'EUR' }), null];
    expect(parseFeed(feed)).toHaveLength(2);
  });

  it('sorts chronologically', () => {
    const feed = [
      row({ date: '2026-09-18T08:30:00-04:00', title: 'later' }),
      row({ date: '2026-09-16T08:30:00-04:00', title: 'sooner' }),
    ];
    expect(parseFeed(feed).map(e => e.title)).toEqual(['sooner', 'later']);
  });
});

describe('filterEvents', () => {
  const feed = parseFeed([
    row({ impact: 'High', country: 'USD', title: 'NFP' }),
    row({ impact: 'Medium', country: 'EUR', title: 'Lagarde' }),
    row({ impact: 'Low', country: 'GBP', title: 'HPI' }),
    row({ impact: 'High', country: 'CNY', title: 'China GDP' }),
    row({ impact: 'High', country: 'All', title: 'BRICS Summit' }),
    row({ impact: 'High', country: 'JPY', title: 'BOJ' }),
  ]);

  it('keeps only high impact by default', () => {
    expect(filterEvents(feed).map(e => e.title)).toEqual(['NFP', 'BOJ']);
  });

  it('drops currencies this journal does not trade', () => {
    // "All" has nothing to position against; CNY is not traded here.
    const titles = filterEvents(feed).map(e => e.title);
    expect(titles).not.toContain('China GDP');
    expect(titles).not.toContain('BRICS Summit');
  });

  it('covers every major the user asked for', () => {
    const all = parseFeed(
      TRACKED_CURRENCIES.map(c => row({ country: c, title: c, impact: 'High' }))
    );
    expect(filterEvents(all)).toHaveLength(TRACKED_CURRENCIES.length);
  });

  it('can include medium impact on request', () => {
    expect(filterEvents(feed, { minImpact: 'Medium' }).map(e => e.title)).toEqual([
      'NFP',
      'Lagarde',
      'BOJ',
    ]);
  });
});

describe('time helpers', () => {
  const now = new Date('2026-09-16T12:00:00.000Z');
  const at = (iso: string, title = 't') =>
    parseEvent({ ...row(), date: iso, title })!;

  it('measures minutes until an event, negative once past', () => {
    expect(minutesUntil(at('2026-09-16T14:00:00.000Z'), now)).toBe(120);
    expect(minutesUntil(at('2026-09-16T11:30:00.000Z'), now)).toBe(-30);
  });

  it('upcoming keeps only what is still ahead', () => {
    const events = [
      at('2026-09-16T09:00:00.000Z', 'past'),
      at('2026-09-16T14:00:00.000Z', 'next'),
      at('2026-09-17T09:00:00.000Z', 'later'),
    ];
    expect(upcoming(events, now).map(e => e.title)).toEqual(['next', 'later']);
  });

  it('upcoming respects its limit', () => {
    const events = Array.from({ length: 10 }, (_, i) =>
      at(`2026-09-16T1${i % 10}:00:00.000Z`, `e${i}`)
    );
    expect(upcoming(events, now, 3).length).toBeLessThanOrEqual(3);
  });
});

describe('bannerEvent', () => {
  const now = new Date('2026-09-16T12:00:00.000Z');
  const at = (iso: string, title: string) => parseEvent({ ...row(), date: iso, title })!;

  it('picks the nearest upcoming event', () => {
    const events = [
      at('2026-09-16T18:00:00.000Z', 'far'),
      at('2026-09-16T13:00:00.000Z', 'soon'),
    ];
    expect(bannerEvent(events, now)!.title).toBe('soon');
  });

  it('falls back to one that just happened', () => {
    // "CPI was 20 minutes ago" explains a chaotic chart; silence does not.
    const events = [at('2026-09-16T11:40:00.000Z', 'just gone')];
    expect(bannerEvent(events, now)!.title).toBe('just gone');
  });

  it('prefers an upcoming event over a past one', () => {
    const events = [
      at('2026-09-16T11:50:00.000Z', 'past'),
      at('2026-09-16T12:30:00.000Z', 'ahead'),
    ];
    expect(bannerEvent(events, now)!.title).toBe('ahead');
  });

  it('ignores events beyond a day out', () => {
    expect(bannerEvent([at('2026-09-20T12:00:00.000Z', 'next week')], now)).toBeNull();
  });

  it('forgets an event an hour after it passed', () => {
    expect(bannerEvent([at('2026-09-16T10:00:00.000Z', 'old')], now)).toBeNull();
  });

  it('returns null on an empty feed rather than a placeholder', () => {
    expect(bannerEvent([], now)).toBeNull();
  });
});

describe('onLocalDay', () => {
  it('keeps only events on the same local calendar day', () => {
    const now = new Date(2026, 8, 16, 12, 0, 0);
    const sameDay = parseEvent({
      ...row(),
      date: new Date(2026, 8, 16, 20, 0, 0).toISOString(),
    })!;
    const nextDay = parseEvent({
      ...row(),
      date: new Date(2026, 8, 17, 9, 0, 0).toISOString(),
    })!;
    expect(onLocalDay([sameDay, nextDay], now)).toHaveLength(1);
  });
});
