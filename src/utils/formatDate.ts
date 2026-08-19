/**
 * Formats a date string or Date object to short format: DD/MM/YY
 *
 * Examples:
 *   formatShortDate('2025-08-12')       → '12/08/25'
 *   formatShortDate('2025-08-12T14:30') → '12/08/25'
 *   formatShortDate(new Date(...))      → '12/08/25'
 *   formatShortDate('8/12')             → '12/08/25' (US M/D)
 *   formatShortDate('12 août')          → '12/08'    (FR short month → keeps DD/MM)
 */
export function formatShortDate(input: string | Date): string {
  if (input instanceof Date) {
    const dd = String(input.getDate()).padStart(2, '0');
    const mm = String(input.getMonth() + 1).padStart(2, '0');
    const yy = String(input.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  const s = input.trim();

  // Already DD/MM or DD/MM/YY
  if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(s)) {
    const parts = s.split('/');
    const dd = parts[0].padStart(2, '0');
    const mm = parts[1].padStart(2, '0');
    const yy = parts[2] ? parts[2].slice(-2) : '';
    return yy ? `${dd}/${mm}/${yy}` : `${dd}/${mm}`;
  }

  // YYYY-MM-DD or YYYY-MM-DDTHH:mm
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const parts = s.split('T')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0].slice(-2)}`;
  }

  // US M/D or M/D/YY
  if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(s)) {
    const parts = s.split('/');
    const dd = parts[1].padStart(2, '0');
    const mm = parts[0].padStart(2, '0');
    const yy = parts[2] ? parts[2].slice(-2) : '';
    return yy ? `${dd}/${mm}/${yy}` : `${dd}/${mm}`;
  }

  // Try to parse as Date
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }

  // Fallback: return as-is
  return s;
}

/**
 * Formats a date to short DD/MM format (no year).
 * Used when year is not needed on chart labels.
 */
export function formatShortDateNoYear(input: string | Date): string {
  const full = formatShortDate(input);
  // Remove /YY suffix if present
  const parts = full.split('/');
  if (parts.length === 3) {
    return `${parts[0]}/${parts[1]}`;
  }
  return full;
}
