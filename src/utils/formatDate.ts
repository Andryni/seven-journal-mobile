/**
 * Formats a date string or Date object to short format.
 *
 * FR: DD/MM/YY (e.g. 12/08/25)
 * EN: M/D/YY   (e.g. 8/12/25)
 *
 * @param input - Date string or Date object
 * @param lang  - 'fr' | 'en' (default: 'fr')
 */
export function formatShortDate(input: string | Date, lang: 'fr' | 'en' = 'fr'): string {
  const toDate = (val: string | Date): Date => {
    if (val instanceof Date) return val;
    const s = val.trim();
    // Try ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
    // Try DD/MM or DD/MM/YY
    if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(s)) {
      const parts = s.split('/');
      const dd = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10) - 1;
      const yy = parts[2] ? 2000 + parseInt(parts[2].slice(-2), 10) : new Date().getFullYear();
      const d = new Date(yy, mm, dd);
      if (!isNaN(d.getTime())) return d;
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
    return new Date();
  };

  const d = toDate(input);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = String(d.getFullYear()).slice(-2);

  if (lang === 'en') {
    // EN format: M/D/YY (no leading zeros)
    return `${month}/${day}/${year}`;
  }
  // FR format: DD/MM/YY
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
}

/**
 * Formats a date to short DD/MM or M/D format (no year).
 * Used when year is not needed on chart labels.
 */
export function formatShortDateNoYear(input: string | Date, lang: 'fr' | 'en' = 'fr'): string {
  const full = formatShortDate(input, lang);
  const parts = full.split('/');
  if (parts.length === 3) {
    if (lang === 'en') {
      return `${parts[0]}/${parts[1]}`;
    }
    return `${parts[0]}/${parts[1]}`;
  }
  return full;
}

/**
 * Local trading-day key (YYYY-MM-DD) based on the DEVICE timezone,
 * not UTC. Prop-firm daily limits reset on the trader's local day —
 * using toISOString() would shift the day for anyone not on UTC.
 */
export function localDayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** ISO timestamp of local midnight (start of the local trading day). */
export function localDayStartISO(d: Date = new Date()): string {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  return start.toISOString();
}

/** True when the given ISO timestamp falls on the local trading day of `ref`. */
export function isSameLocalDay(iso: string | null | undefined, ref: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return localDayKey(d) === localDayKey(ref);
}
