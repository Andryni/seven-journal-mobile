/**
 * RFC 4180 CSV parsing.
 *
 * The importers used `line.split(',')`, which breaks on the very first quoted
 * field containing a comma -- and broker exports are full of them ("Long,
 * scaled in"). Every column after the quote shifts left by one, so prices land
 * in the size column and the row imports as plausible but wrong numbers. That
 * is worse than a rejected file: the trader cannot see it happened.
 *
 * Also handles quoted newlines, escaped quotes ("" inside a quoted field), a
 * UTF-8 BOM, and semicolon delimiters (the default CSV separator on
 * French/German Windows, which is where a lot of MT4 reports come from).
 */

export interface CsvOptions {
  /** Defaults to auto-detection between ',' and ';'. */
  delimiter?: string;
}

/** Detects the delimiter by counting candidates outside quoted regions. */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 4000);
  let inQuotes = false;
  const counts: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };

  for (let i = 0; i < sample.length; i++) {
    const c = sample[i];
    if (c === '"') {
      if (inQuotes && sample[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && c in counts) {
      counts[c]++;
    }
  }

  let best = ',';
  for (const d of Object.keys(counts)) {
    if (counts[d] > counts[best]) best = d;
  }
  return best;
}

/** Parses a whole CSV document into rows of raw string cells. */
export function parseCsv(text: string, options: CsvOptions = {}): string[][] {
  // Strip a UTF-8 BOM, which otherwise becomes part of the first header name
  // and makes a 'date' column lookup silently miss.
  const input = text.replace(/^\uFEFF/, '');
  const delimiter = options.delimiter ?? detectDelimiter(input);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;

  const endField = () => {
    row.push(fieldWasQuoted ? field : field.trim());
    field = '';
    fieldWasQuoted = false;
  };

  const endRow = () => {
    endField();
    // Skip rows that are entirely empty, which trailing newlines produce.
    if (row.some(c => c !== '')) rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const c = input[i];

    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      fieldWasQuoted = true;
    } else if (c === delimiter) {
      endField();
    } else if (c === '\n') {
      endRow();
    } else if (c === '\r') {
      // handled by the \n that follows; lone \r also ends a row
      if (input[i + 1] !== '\n') endRow();
    } else {
      field += c;
    }
  }

  if (field !== '' || row.length > 0) endRow();

  return rows;
}

/**
 * Parses into objects keyed by lowercased header name.
 * Duplicate headers keep the first occurrence, matching spreadsheet behaviour.
 */
export function parseCsvRecords(text: string, options: CsvOptions = {}): Record<string, string>[] {
  const rows = parseCsv(text, options);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(cols => {
    const rec: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (!(h in rec)) rec[h] = cols[i] ?? '';
    });
    return rec;
  });
}

/** Quotes a value for CSV output only when it needs it. */
export function csvEscape(value: string): string {
  if (/[",;\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Parses a number written in either decimal convention.
 *
 * Broker exports localise: "1 234,56" (fr), "1,234.56" (en), "1234.56".
 * parseFloat("1,234.56") returns 1 -- silently importing a 1234 dollar profit
 * as 1 dollar.
 */
export function parseLooseNumber(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Drop currency symbols, spaces (incl. non-breaking) and thousands marks.
  s = s.replace(/[\s\u00A0\u202F]/g, '').replace(/[$€£]/g, '');

  // Parentheses denote a negative in accounting exports: (150.00)
  let negative = false;
  if (/^\((.*)\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever comes last is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // A lone comma: decimal separator unless it looks like a thousands group.
    const after = s.length - lastComma - 1;
    s = after === 3 && /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}
