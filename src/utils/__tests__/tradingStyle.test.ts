import { detectTradingStyle, formatDuration } from '../tradingStyle';

const iso = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo, d, h, mi).toISOString();

describe('detectTradingStyle', () => {
  it('calls a sub-30-minute trade scalping', () => {
    const r = detectTradingStyle(iso(2026, 0, 13, 9, 0), iso(2026, 0, 13, 9, 12));
    expect(r.style).toBe('scalping');
    expect(r.minutes).toBe(12);
    expect(r.label).toBe('12m');
  });

  it('calls a same-day multi-hour trade day trading', () => {
    const r = detectTradingStyle(iso(2026, 0, 13, 9, 0), iso(2026, 0, 13, 15, 30));
    expect(r.style).toBe('day');
    expect(r.label).toBe('6h 30m');
  });

  it('calls a multi-day hold swing', () => {
    const r = detectTradingStyle(iso(2026, 0, 13, 9, 0), iso(2026, 0, 16, 9, 0));
    expect(r.style).toBe('swing');
    expect(r.label).toBe('3d');
  });

  it('treats an overnight hold as swing even when it is short', () => {
    // 23:50 -> 00:30 is 40 minutes but crosses the date: not day trading.
    const r = detectTradingStyle(iso(2026, 0, 13, 23, 50), iso(2026, 0, 14, 0, 30));
    expect(r.style).toBe('swing');
  });

  it('still calls a short overnight trade scalping under 30 minutes', () => {
    const r = detectTradingStyle(iso(2026, 0, 13, 23, 50), iso(2026, 0, 14, 0, 10));
    expect(r.style).toBe('scalping');
  });

  it('returns nothing for an open trade', () => {
    expect(detectTradingStyle(iso(2026, 0, 13, 9, 0), null).style).toBeNull();
    expect(detectTradingStyle(null, iso(2026, 0, 13, 9, 0)).style).toBeNull();
  });

  it('refuses to label a trade whose exit precedes its entry', () => {
    const r = detectTradingStyle(iso(2026, 0, 13, 10, 0), iso(2026, 0, 13, 9, 0));
    expect(r.style).toBeNull();
    expect(r.label).toBeNull();
  });

  it('returns nothing on unparseable input', () => {
    expect(detectTradingStyle('nope', iso(2026, 0, 13, 9, 0)).style).toBeNull();
  });
});

describe('formatDuration', () => {
  it('formats minutes, hours and days', () => {
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(135)).toBe('2h 15m');
    expect(formatDuration(60 * 24)).toBe('1d');
    expect(formatDuration(60 * 26)).toBe('1d 2h');
  });
});
