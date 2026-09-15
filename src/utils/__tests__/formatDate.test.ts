import { localDayKey, localDayStartISO, isSameLocalDay, formatShortDate, deviceTimezone,
  formatDuration,
} from '../formatDate';

describe('localDayKey', () => {
  it('returns YYYY-MM-DD based on LOCAL time, not UTC', () => {
    // 23:30 local on Jan 15 — UTC key could differ, local must stay Jan 15
    const d = new Date(2025, 0, 15, 23, 30, 0);
    expect(localDayKey(d)).toBe('2025-01-15');
  });

  it('pads month and day', () => {
    const d = new Date(2025, 2, 5, 10, 0, 0);
    expect(localDayKey(d)).toBe('2025-03-05');
  });

  it('handles first minutes of the local day', () => {
    const d = new Date(2025, 11, 31, 0, 5, 0);
    expect(localDayKey(d)).toBe('2025-12-31');
  });
});

describe('localDayStartISO', () => {
  it('returns an ISO timestamp equal to local midnight', () => {
    const d = new Date(2025, 5, 10, 14, 45, 0);
    const iso = localDayStartISO(d);
    const parsed = new Date(iso);
    expect(parsed.getFullYear()).toBe(2025);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(10);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
  });
});

describe('isSameLocalDay', () => {
  it('matches a timestamp from the same local day', () => {
    const ref = new Date(2025, 3, 20, 18, 0, 0);
    const sameDay = new Date(2025, 3, 20, 1, 0, 0).toISOString();
    expect(isSameLocalDay(sameDay, ref)).toBe(true);
  });

  it('rejects a timestamp from another local day', () => {
    const ref = new Date(2025, 3, 20, 18, 0, 0);
    const otherDay = new Date(2025, 3, 19, 23, 59, 0).toISOString();
    expect(isSameLocalDay(otherDay, ref)).toBe(false);
  });

  it('handles null / invalid input safely', () => {
    expect(isSameLocalDay(null)).toBe(false);
    expect(isSameLocalDay(undefined)).toBe(false);
    expect(isSameLocalDay('not-a-date')).toBe(false);
  });
});

describe('formatShortDate', () => {
  it('formats FR as DD/MM/YY', () => {
    expect(formatShortDate(new Date(2025, 7, 12), 'fr')).toBe('12/08/25');
  });
  it('formats EN as M/D/YY', () => {
    expect(formatShortDate(new Date(2025, 7, 12), 'en')).toBe('8/12/25');
  });
});

describe('deviceTimezone', () => {
  it('returns a usable IANA zone name', () => {
    const tz = deviceTimezone();
    expect(typeof tz).toBe('string');
    expect(tz.length).toBeGreaterThan(0);
    // Must be accepted by Intl, since the server stores it verbatim and
    // Postgres will reject an unknown zone at AT TIME ZONE evaluation.
    expect(() =>
      new Intl.DateTimeFormat('en', { timeZone: tz }).format(new Date())
    ).not.toThrow();
  });

  it('falls back to UTC when the runtime cannot resolve a zone', () => {
    const original = Intl.DateTimeFormat;
    // @ts-expect-error -- deliberately breaking the global for this test
    Intl.DateTimeFormat = () => {
      throw new Error('no zone');
    };
    try {
      expect(deviceTimezone()).toBe('UTC');
    } finally {
      Intl.DateTimeFormat = original;
    }
  });
});

describe('formatDuration', () => {
  const at = (iso: string) => `2026-03-02T${iso}:00.000Z`;

  it('returns null when either end is missing', () => {
    // An open trade has no exit yet: the row must render blank, not "0 min".
    expect(formatDuration(at('09:00'), null)).toBeNull();
    expect(formatDuration(null, at('09:00'))).toBeNull();
    expect(formatDuration(undefined, undefined)).toBeNull();
  });

  it('formats minutes under an hour', () => {
    expect(formatDuration(at('09:00'), at('09:05'))).toBe('5 min');
    expect(formatDuration(at('09:00'), at('09:59'))).toBe('59 min');
  });

  it('formats hours and minutes under a day', () => {
    expect(formatDuration(at('09:00'), at('11:00'))).toBe('2 h');
    expect(formatDuration(at('09:00'), at('11:30'))).toBe('2 h 30 min');
  });

  it('formats days beyond 24 hours', () => {
    expect(formatDuration('2026-03-01T09:00:00.000Z', '2026-03-04T09:00:00.000Z')).toBe('3 j');
    expect(formatDuration('2026-03-01T09:00:00.000Z', '2026-03-04T15:00:00.000Z')).toBe('3 j 6 h');
  });

  it('uses the English day unit when asked', () => {
    expect(formatDuration('2026-03-01T09:00:00.000Z', '2026-03-04T09:00:00.000Z', 'en')).toBe('3 d');
  });

  it('handles the 74-hour case as days, not a huge hour count', () => {
    // 74 h is 3 days and 2 hours; "74 h" is technically true but unreadable.
    expect(formatDuration('2026-03-01T09:00:00.000Z', '2026-03-04T11:00:00.000Z')).toBe('3 j 2 h');
  });

  it('collapses a sub-minute scalp instead of showing 0', () => {
    expect(formatDuration(at('09:00'), '2026-03-02T09:00:20.000Z')).toBe('< 1 min');
  });

  it('returns null for a corrupt row where exit precedes entry', () => {
    expect(formatDuration(at('11:00'), at('09:00'))).toBeNull();
  });

  it('returns null for unparseable input', () => {
    expect(formatDuration('not-a-date', at('09:00'))).toBeNull();
  });
});
