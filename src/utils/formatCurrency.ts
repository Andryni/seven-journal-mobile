export interface FormatCurrencyOptions {
  /** Number of decimal places (default: 2) */
  decimals?: number;
  /** Show a '+' prefix for positive values (default: true) */
  showPlus?: boolean;
  /** Use thousands separators, e.g. 1,234.56 (default: false) */
  thousandsSeparator?: boolean;
  /** Compact format, e.g. $1.2k / $3.4M (default: false) */
  compact?: boolean;
  /** Currency symbol (default: '$') */
  symbol?: string;
}

/**
 * Formats a numeric amount as a currency string with the sign placed
 * BEFORE the currency symbol:
 *
 *   formatCurrency(500)      -> "+$500.00"
 *   formatCurrency(-500)     -> "-$500.00"
 *   formatCurrency(0)        -> "$0.00"
 *
 * Supported options:
 *   decimals: 0   -> "+$500"
 *   showPlus: false -> "$500.00"
 *   thousandsSeparator: true -> "+$1,234.56"
 *   compact: true -> "+$1.2k" / "-$3.4M"
 *   symbol: '€'   -> "-€500.00"
 */
export function formatCurrency(amount: number, options: FormatCurrencyOptions = {}): string {
  const {
    decimals = 2,
    showPlus = true,
    thousandsSeparator = false,
    compact = false,
    symbol = '$',
  } = options;

  const abs = Math.abs(amount);
  // Guard against "-$0.00": if the value rounds to zero at the requested
  // precision, render it unsigned.
  const roundsToZero = Number(abs.toFixed(compact ? Math.max(decimals, 1) : decimals)) === 0 && abs < 1000;
  const sign = roundsToZero ? '' : amount > 0 ? (showPlus ? '+' : '') : amount < 0 ? '-' : '';

  if (compact) {
    if (abs >= 1000000) return `${sign}${symbol}${(abs / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
    return `${sign}${symbol}${abs.toFixed(decimals)}`;
  }

  const num = thousandsSeparator
    ? abs.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : abs.toFixed(decimals);

  return `${sign}${symbol}${num}`;
}
