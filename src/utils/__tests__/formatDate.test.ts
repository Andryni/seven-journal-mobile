import { localDayKey, localDayStartISO, isSameLocalDay, formatShortDate } from '../formatDate';

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
