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
 * Formats a duration in minutes into a clean human-readable string.
 * e.g. 15m, 2h 30m, 1j 4h (FR) or 15m, 2h 30m, 1d 4h (EN)
 */
export function formatTradeDuration(minutes: number, lang: 'fr' | 'en' = 'fr'): string {
  if (minutes < 0 || isNaN(minutes)) return '—';
  if (minutes < 1) return '< 1m';

  const totalMins = Math.floor(minutes);
  if (totalMins < 60) {
    return `${totalMins}m`;
  }

  const hours = Math.floor(totalMins / 60);
  const remMins = totalMins % 60;

  if (hours < 24) {
    return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
  }

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  const dayUnit = lang === 'en' ? 'd' : 'j';
  return remHours > 0 ? `${days}${dayUnit} ${remHours}h` : `${days}${dayUnit}`;
}

export type TradeStyle = 'scalping' | 'intraday' | 'swing';

/**
 * Classifies a trade style based on its holding duration (in minutes).
 * - < 30 min -> Scalping
 * - 30 min to 24h -> Intraday
 * - > 24h -> Swing Trading
 */
export function classifyTradeStyle(durationMinutes: number): TradeStyle {
  if (durationMinutes < 30) return 'scalping';
  if (durationMinutes <= 24 * 60) return 'intraday';
  return 'swing';
}

/**
 * Automatically detects the trading session from a Date object based on UTC time.
 * - Asia: 00:00 - 07:00 UTC
 * - London: 07:00 - 13:00 UTC
 * - New York: 13:00 - 21:00 UTC
 * - Over Session: 21:00 - 00:00 UTC
 */
export function detectSessionFromDate(date: Date): 'Asia' | 'London' | 'New York' | 'Over Session' {
  const utcHours = date.getUTCHours();
  if (utcHours >= 0 && utcHours < 7) return 'Asia';
  if (utcHours >= 7 && utcHours < 13) return 'London';
  if (utcHours >= 13 && utcHours < 21) return 'New York';
  return 'Over Session';
}
