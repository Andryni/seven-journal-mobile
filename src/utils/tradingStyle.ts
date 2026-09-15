/**
 * Trading style inferred from how long a position was actually held.
 *
 * Self-reported style is unreliable: traders describe themselves as swing
 * traders and then close everything within the hour. Hold time is the one
 * honest signal, and the journal already records both timestamps.
 *
 * Thresholds follow common usage rather than any standard:
 *   scalping     < 30 min
 *   day trading  < 1 day and closed the same calendar day
 *   swing        anything held overnight or longer
 *
 * Kept separate from sessionDetect's timeframe inference: that one guesses
 * which chart was used, this one names the trader's approach. They answer
 * different questions and are allowed to disagree.
 */

export type TradingStyle = 'scalping' | 'day' | 'swing';

export interface TradeDurationInfo {
  /** Held time in minutes. Null when the trade is still open. */
  minutes: number | null;
  style: TradingStyle | null;
  /** Short human form, e.g. "4m", "2h 15m", "3d". */
  label: string | null;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;

  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h` : `${days}d`;
}

export function detectTradingStyle(
  entryTimeIso: string | null | undefined,
  exitTimeIso: string | null | undefined,
): TradeDurationInfo {
  const empty: TradeDurationInfo = { minutes: null, style: null, label: null };
  if (!entryTimeIso || !exitTimeIso) return empty;

  const entry = new Date(entryTimeIso);
  const exit = new Date(exitTimeIso);
  if (isNaN(entry.getTime()) || isNaN(exit.getTime())) return empty;

  const minutes = (exit.getTime() - entry.getTime()) / 60000;
  // A non-positive hold means the two fields contradict each other; refuse to
  // label it rather than reporting "0m scalping".
  if (minutes <= 0) return empty;

  let style: TradingStyle;
  if (minutes < 30) {
    style = 'scalping';
  } else if (
    minutes < 24 * 60 &&
    entry.getFullYear() === exit.getFullYear() &&
    entry.getMonth() === exit.getMonth() &&
    entry.getDate() === exit.getDate()
  ) {
    // Same calendar day and under a day: a position opened at 23:50 and closed
    // at 00:30 was held overnight, so it is not day trading.
    style = 'day';
  } else {
    style = 'swing';
  }

  return { minutes, style, label: formatDuration(minutes) };
}
