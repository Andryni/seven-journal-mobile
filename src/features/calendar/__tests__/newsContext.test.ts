import type { EconomicEvent } from '../economicEvents';
import { NEWS_WARN_MIN, formatNewsOffset, newsContextAt, newsWarningAt } from '../newsContext';

/**
 * What the journal records about the macro context of a trade.
 *
 * The distinction the tests defend: BEFORE a release and AFTER it are
 * different behaviours, and a trade taken twenty minutes after CPI is still
 * "at CPI" while one taken twenty minutes before is a different decision
 * entirely. When this arithmetic is wrong the statistics stay plausible and
 * the conclusion is wrong — the worst kind of bug in a measuring tool.
 */
const ev = (over: Partial<EconomicEvent>): EconomicEvent => ({
  title: 'Core CPI m/m',
  currency: 'USD',
  at: '2026-09-15T12:30:00Z',
  impact: 'High',
  forecast: null,
  previous: null,
  ...over,
});

describe('newsContextAt', () => {
  it('records the signed offset, before and after', () => {
    const events = [ev({})];
    expect(newsContextAt('2026-09-15T12:27:00Z', events)?.offsetMin).toBe(-3);
    expect(newsContextAt('2026-09-15T12:42:00Z', events)?.offsetMin).toBe(12);
    expect(newsContextAt('2026-09-15T12:30:00Z', events)?.offsetMin).toBe(0);
  });

  it('keeps the event identity, not just the offset', () => {
    const ctx = newsContextAt('2026-09-15T12:28:00Z', [ev({ currency: 'EUR', title: 'ECB Press Conference' })]);
    expect(ctx).toEqual({ event: 'ECB Press Conference', currency: 'EUR', offsetMin: -2 });
  });

  it('says nothing outside the window', () => {
    const events = [ev({})];
    expect(newsContextAt('2026-09-15T12:59:00Z', events)?.offsetMin).toBe(29);
    expect(newsContextAt('2026-09-15T13:00:00Z', events)?.offsetMin).toBe(30); // boundary kept
    expect(newsContextAt('2026-09-15T13:01:00Z', events)).toBeNull(); // +31 out
    expect(newsContextAt('2026-09-15T11:59:00Z', events)).toBeNull(); // -31 out
    expect(newsContextAt('2026-09-15T12:00:00Z', events)?.offsetMin).toBe(-30); // boundary kept
  });

  it('ignores medium and low impact releases', () => {
    // The band is filtered to High for the same reason: a context line that
    // fires on every minor print says nothing.
    expect(newsContextAt('2026-09-15T12:30:00Z', [ev({ impact: 'Medium' })])).toBeNull();
    expect(newsContextAt('2026-09-15T12:30:00Z', [ev({ impact: 'Low' })])).toBeNull();
  });

  it('picks the NEAREST event, not the first in the list', () => {
    const events = [
      ev({ title: 'NFP', at: '2026-09-15T13:00:00Z' }),
      ev({ title: 'Core CPI m/m', at: '2026-09-15T12:30:00Z' }),
    ];
    // Four minutes after CPI, in a list where NFP comes first.
    expect(newsContextAt('2026-09-15T12:34:00Z', events)?.event).toBe('Core CPI m/m');
    expect(newsContextAt('2026-09-15T12:56:00Z', events)?.event).toBe('NFP');
  });

  it('breaks an exact tie towards the release that already happened', () => {
    const events = [
      ev({ title: 'After', at: '2026-09-15T12:25:00Z' }),
      ev({ title: 'Before', at: '2026-09-15T12:35:00Z' }),
    ];
    // Midway between the two: the price was showing the effect of the one
    // that already printed.
    const ctx = newsContextAt('2026-09-15T12:30:00Z', events);
    expect(ctx?.event).toBe('After');
    expect(ctx?.offsetMin).toBe(5);
  });

  it('refuses an unusable instant or window', () => {
    expect(newsContextAt('not a date', [ev({})])).toBeNull();
    expect(newsContextAt('2026-09-15T12:30:00Z', [ev({})], -1)).toBeNull();
  });

  it('survives a malformed event date', () => {
    expect(newsContextAt('2026-09-15T12:30:00Z', [ev({ at: 'garbage' })])).toBeNull();
  });
});

describe('newsWarningAt', () => {
  it('is much tighter than the recorded window', () => {
    const events = [ev({})];
    expect(newsWarningAt('2026-09-15T12:27:00Z', events)).not.toBeNull();
    // Still recorded as context, but no longer worth interrupting the entry.
    expect(newsContextAt('2026-09-15T12:50:00Z', events)).not.toBeNull();
    expect(newsWarningAt('2026-09-15T12:50:00Z', events)).toBeNull();
    expect(NEWS_WARN_MIN).toBeLessThan(30);
  });
});

describe('formatNewsOffset', () => {
  it('reads correctly in both languages, sign included', () => {
    expect(formatNewsOffset(-3, 'fr')).toBe('dans 3 min');
    expect(formatNewsOffset(12, 'fr')).toBe('il y a 12 min');
    expect(formatNewsOffset(0, 'fr')).toBe('à la publication');
    expect(formatNewsOffset(-3, 'en')).toBe('in 3 min');
    expect(formatNewsOffset(12, 'en')).toBe('12 min ago');
    expect(formatNewsOffset(0, 'en')).toBe('at the release');
  });
});
