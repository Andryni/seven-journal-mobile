import { formatShortDate } from '../formatDate';

describe('formatShortDate', () => {
  it('should format date in French as DD/MM/YY', () => {
    const date = new Date('2026-08-21T12:00:00Z');
    const result = formatShortDate(date, 'fr');
    expect(result).toBe('21/08/26');
  });

  it('should format date in English as M/D/YY', () => {
    const date = new Date('2026-08-21T12:00:00Z');
    const result = formatShortDate(date, 'en');
    expect(result).toBe('8/21/26');
  });

  it('should handle January', () => {
    const date = new Date('2026-01-15T12:00:00Z');
    expect(formatShortDate(date, 'en')).toBe('1/15/26');
    expect(formatShortDate(date, 'fr')).toBe('15/01/26');
  });

  it('should handle December', () => {
    const date = new Date('2026-12-25T12:00:00Z');
    expect(formatShortDate(date, 'en')).toBe('12/25/26');
    expect(formatShortDate(date, 'fr')).toBe('25/12/26');
  });

  it('should handle string input', () => {
    const result = formatShortDate('2026-03-10', 'en');
    expect(result).toBe('3/10/26');
  });
});
