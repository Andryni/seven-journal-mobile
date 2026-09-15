import { parseCsv, parseCsvRecords, detectDelimiter, csvEscape, parseLooseNumber } from '../csv';

describe('parseCsv', () => {
  it('keeps a quoted comma inside its field', () => {
    // The bug that motivated this module: split(',') shifted every later
    // column left, so prices landed in the size column.
    const rows = parseCsv('a,b,c\n1,"Long, scaled in",3');
    expect(rows[1]).toEqual(['1', 'Long, scaled in', '3']);
  });

  it('unescapes doubled quotes', () => {
    const rows = parseCsv('note\n"He said ""hello"""');
    expect(rows[1][0]).toBe('He said "hello"');
  });

  it('supports newlines inside a quoted field', () => {
    const rows = parseCsv('a,b\n1,"line one\nline two"');
    expect(rows).toHaveLength(2);
    expect(rows[1][1]).toBe('line one\nline two');
  });

  it('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('strips a UTF-8 BOM so the first header is still matchable', () => {
    const rows = parseCsv('\uFEFFdate,price\n2026-01-01,10');
    expect(rows[0][0]).toBe('date');
  });

  it('ignores blank trailing lines', () => {
    expect(parseCsv('a,b\n1,2\n\n')).toHaveLength(2);
  });

  it('preserves intentional whitespace inside quotes but trims bare fields', () => {
    const rows = parseCsv('a,b\n  x  ,"  y  "');
    expect(rows[1]).toEqual(['x', '  y  ']);
  });
});

describe('detectDelimiter', () => {
  it('detects semicolons, the default on French/German Windows', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('defaults to a comma', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
  });

  it('is not fooled by delimiters inside quoted text', () => {
    // Three real commas, many semicolons but all quoted.
    expect(detectDelimiter('a,b,c,d\n1,"x;y;z;w;v;u",3,4')).toBe(',');
  });
});

describe('parseCsvRecords', () => {
  it('keys rows by lowercased header', () => {
    const recs = parseCsvRecords('Symbol,Profit\nXAUUSD,150');
    expect(recs[0]).toEqual({ symbol: 'XAUUSD', profit: '150' });
  });

  it('returns nothing for a header-only file', () => {
    expect(parseCsvRecords('a,b')).toEqual([]);
  });

  it('fills missing trailing cells with empty strings', () => {
    const recs = parseCsvRecords('a,b,c\n1,2');
    expect(recs[0].c).toBe('');
  });
});

describe('parseLooseNumber', () => {
  it('parses a plain decimal', () => {
    expect(parseLooseNumber('1234.56')).toBeCloseTo(1234.56);
  });

  it('parses the anglo thousands format', () => {
    // parseFloat('1,234.56') returns 1 -- a 1234 dollar profit imported as 1.
    expect(parseLooseNumber('1,234.56')).toBeCloseTo(1234.56);
  });

  it('parses the european format', () => {
    expect(parseLooseNumber('1.234,56')).toBeCloseTo(1234.56);
    expect(parseLooseNumber('1 234,56')).toBeCloseTo(1234.56);
  });

  it('treats a lone comma as a decimal separator', () => {
    expect(parseLooseNumber('12,5')).toBeCloseTo(12.5);
  });

  it('treats a grouped comma as thousands', () => {
    expect(parseLooseNumber('12,500')).toBe(12500);
  });

  it('reads accounting parentheses as negative', () => {
    expect(parseLooseNumber('(150.00)')).toBe(-150);
  });

  it('strips currency symbols and non-breaking spaces', () => {
    expect(parseLooseNumber('$1,200.00')).toBe(1200);
    expect(parseLooseNumber('1\u00A0200,50')).toBeCloseTo(1200.5);
  });

  it('handles negatives and zero', () => {
    expect(parseLooseNumber('-42.5')).toBeCloseTo(-42.5);
    expect(parseLooseNumber('0')).toBe(0);
  });

  it('returns null rather than NaN for unusable input', () => {
    expect(parseLooseNumber('')).toBeNull();
    expect(parseLooseNumber(null)).toBeNull();
    expect(parseLooseNumber('n/a')).toBeNull();
  });
});

describe('csvEscape', () => {
  it('leaves a plain value alone', () => {
    expect(csvEscape('XAUUSD')).toBe('XAUUSD');
  });

  it('quotes values containing a delimiter or newline', () => {
    expect(csvEscape('Long, scaled')).toBe('"Long, scaled"');
    expect(csvEscape('a;b')).toBe('"a;b"');
    expect(csvEscape('line\nbreak')).toBe('"line\nbreak"');
  });

  it('doubles embedded quotes', () => {
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
  });
});
