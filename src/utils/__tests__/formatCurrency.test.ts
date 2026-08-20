import { formatCurrency } from '../formatCurrency';

describe('formatCurrency', () => {
  describe('basic formatting', () => {
    it('should format positive number with + prefix and $ symbol', () => {
      expect(formatCurrency(500)).toBe('+$500.00');
    });

    it('should format negative number with - prefix', () => {
      expect(formatCurrency(-500)).toBe('-$500.00');
    });

    it('should format zero without sign', () => {
      expect(formatCurrency(0)).toBe('$0.00');
    });

    it('should format small positive number', () => {
      expect(formatCurrency(0.5)).toBe('+$0.50');
    });

    it('should format small negative number', () => {
      expect(formatCurrency(-0.5)).toBe('-$0.50');
    });
  });

  describe('decimals option', () => {
    it('should default to 2 decimal places', () => {
      expect(formatCurrency(123.456)).toBe('+$123.46');
    });

    it('should format with 0 decimals', () => {
      expect(formatCurrency(500, { decimals: 0 })).toBe('+$500');
    });

    it('should format with 4 decimals', () => {
      expect(formatCurrency(1.2345, { decimals: 4 })).toBe('+$1.2345');
    });
  });

  describe('showPlus option', () => {
    it('should show + prefix by default', () => {
      expect(formatCurrency(500)).toBe('+$500.00');
    });

    it('should hide + prefix when showPlus is false', () => {
      expect(formatCurrency(500, { showPlus: false })).toBe('$500.00');
    });

    it('should still show - for negative when showPlus is false', () => {
      expect(formatCurrency(-500, { showPlus: false })).toBe('-$500.00');
    });
  });

  describe('thousandsSeparator option', () => {
    it('should not use thousands separator by default', () => {
      expect(formatCurrency(1234.56)).toBe('+$1234.56');
    });

    it('should use thousands separator when enabled', () => {
      expect(formatCurrency(1234.56, { thousandsSeparator: true })).toBe('+$1,234.56');
    });

    it('should handle large numbers with separator', () => {
      expect(formatCurrency(1234567.89, { thousandsSeparator: true })).toBe('+$1,234,567.89');
    });

    it('should handle negative large numbers with separator', () => {
      expect(formatCurrency(-1234567.89, { thousandsSeparator: true })).toBe('-$1,234,567.89');
    });
  });

  describe('compact option', () => {
    it('should format millions compactly', () => {
      expect(formatCurrency(1500000, { compact: true })).toBe('+$1.5M');
    });

    it('should format thousands compactly', () => {
      expect(formatCurrency(1200, { compact: true })).toBe('+$1.2k');
    });

    it('should not compact small numbers', () => {
      expect(formatCurrency(500, { compact: true })).toBe('+$500.00');
    });

    it('should format negative compactly', () => {
      expect(formatCurrency(-3400, { compact: true })).toBe('-$3.4k');
    });

    it('should format millions with 0 decimals compactly', () => {
      expect(formatCurrency(1500000, { compact: true, decimals: 0 })).toBe('+$1.5M');
    });
  });

  describe('symbol option', () => {
    it('should default to $', () => {
      expect(formatCurrency(500)).toBe('+$500.00');
    });

    it('should use custom symbol', () => {
      expect(formatCurrency(500, { symbol: '€' })).toBe('+€500.00');
    });

    it('should use custom symbol with compact', () => {
      expect(formatCurrency(1500000, { compact: true, symbol: '€' })).toBe('+€1.5M');
    });
  });

  describe('combined options', () => {
    it('should combine thousandsSeparator + decimals', () => {
      expect(formatCurrency(1234.5, { thousandsSeparator: true, decimals: 1 })).toBe('+$1,234.5');
    });

    it('should combine showPlus false + compact', () => {
      expect(formatCurrency(5000, { showPlus: false, compact: true })).toBe('$5.0k');
    });

    it('should combine custom symbol + thousandsSeparator', () => {
      expect(formatCurrency(12345, { symbol: '£', thousandsSeparator: true })).toBe('+£12,345.00');
    });
  });

  describe('edge cases', () => {
    it('should handle very small positive number', () => {
      expect(formatCurrency(0.01)).toBe('+$0.01');
    });

    it('should handle very small negative number', () => {
      expect(formatCurrency(-0.01)).toBe('-$0.01');
    });

    it('should handle exactly 1000 with compact', () => {
      expect(formatCurrency(1000, { compact: true })).toBe('+$1.0k');
    });

    it('should handle exactly 1000000 with compact', () => {
      expect(formatCurrency(1000000, { compact: true })).toBe('+$1.0M');
    });
  });
});
