import { detectSession, detectTimeframe } from '../sessionDetect';

const at = (utcHour: number, minute = 0) =>
  new Date(Date.UTC(2026, 0, 13, utcHour, minute)).toISOString();

describe('detectSession', () => {
  it('maps the Tokyo window to Asia, across midnight', () => {
    expect(detectSession(at(23))).toBe('Asia');
    expect(detectSession(at(2))).toBe('Asia');
    expect(detectSession(at(6, 59))).toBe('Asia');
  });

  it('maps the morning window to London', () => {
    expect(detectSession(at(7))).toBe('London');
    expect(detectSession(at(11, 59))).toBe('London');
  });

  it('maps the afternoon window, including the overlap, to New York', () => {
    expect(detectSession(at(12))).toBe('New York');
    expect(detectSession(at(20, 59))).toBe('New York');
  });

  it('calls the late gap what it is', () => {
    expect(detectSession(at(21))).toBe('Over Session');
    expect(detectSession(at(22, 59))).toBe('Over Session');
  });

  it('is exhaustive: every hour of the day resolves to a session', () => {
    for (let h = 0; h < 24; h++) {
      expect(detectSession(at(h))).not.toBeNull();
    }
  });

  it('returns null for an unparseable timestamp instead of a wrong bucket', () => {
    expect(detectSession('not a date')).toBeNull();
  });

  it('uses UTC, not the local clock', () => {
    // Same instant expressed with an offset must land in the same session.
    expect(detectSession('2026-01-13T09:00:00.000Z')).toBe('London');
    expect(detectSession('2026-01-13T11:00:00+02:00')).toBe('London');
  });
});

describe('detectTimeframe', () => {
  const hold = (minutes: number) =>
    detectTimeframe(at(9), new Date(Date.UTC(2026, 0, 13, 9, minutes)).toISOString());

  it('maps hold time to a plausible chart', () => {
    expect(hold(3)).toBe('M1');
    expect(hold(12)).toBe('M5');
    expect(hold(45)).toBe('M15');
    expect(hold(180)).toBe('H1');
    expect(hold(12 * 60)).toBe('H4');
    expect(hold(72 * 60)).toBe('D1');
  });

  it('returns null for an open trade rather than inventing one', () => {
    expect(detectTimeframe(at(9), null)).toBeNull();
  });

  it('returns null when the exit precedes the entry', () => {
    expect(detectTimeframe(at(10), at(9))).toBeNull();
  });

  it('returns null on unparseable input', () => {
    expect(detectTimeframe('nope', at(9))).toBeNull();
  });
});
