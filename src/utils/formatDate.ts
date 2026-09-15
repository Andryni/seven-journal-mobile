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

/**
 * The device's IANA timezone, e.g. 'Indian/Antananarivo'.
 *
 * Stored on the account so the server can bucket trades into the same trading
 * days the client does. Falls back to UTC on the rare runtime without a
 * resolved timezone, which matches the column default.
 */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Human-readable holding time between two timestamps.
 *
 * Trade duration is one of the few numbers that tells a trader something about
 * their behaviour rather than their results: scalps that quietly became swing
 * trades are how accounts die. It was computable from the data but never
 * displayed anywhere.
 *
 * Granularity adapts to magnitude, because "0.08 h" and "4380 min" are both
 * unreadable. Under an hour: minutes. Under a day: hours and minutes. Beyond:
 * days and hours.
 */
export function formatDuration(
  start: string | Date | null | undefined,
  end: string | Date | null | undefined,
  lang: 'fr' | 'en' = 'fr'
): string | null {
  if (!start || !end) return null;

  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  // A negative span means the row is corrupt (exit before entry). Showing
  // "-3 h" invites the user to trust it; showing nothing prompts a fix.
  const ms = b - a;
  if (ms < 0) return null;

  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return lang === 'fr' ? "< 1 min" : '< 1 min';

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const dUnit = lang === 'fr' ? 'j' : 'd';

  if (days > 0) {
    return hours > 0 ? `${days} ${dUnit} ${hours} h` : `${days} ${dUnit}`;
  }
  if (hours > 0) {
    return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
  }
  return `${minutes} min`;
}
