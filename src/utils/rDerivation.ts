import type { Trade } from '../types/domain';

/**
 * Deriving the R-multiple on the DEVICE, from prices the trade already
 * carries — never from anything the model says.
 *
 * Why this module exists: `r_multiple` is null on exactly the trades the
 * trader did not hand-type (imports), and the user has asked the chat to
 * close that gap. The arithmetic is trivial; the danger is elsewhere:
 *
 *   1. A model doing this maths would violate the one rule the chat stands
 *      on ("the model interprets; the app counts"). So the coach only NAMES
 *      the trades, and the computation happens here, at confirm time.
 *   2. Bad data must not feed the ratio. A stop of 0 (schema default = "no
 *      stop"), a stop on the wrong side of the entry, or a missing exit each
 *      return null instead of a plausible-looking number — same discipline
 *      as excursions.ts and the guarded SQL in apply_broker_close.
 *   3. The SIGN comes from the money direction (entry vs exit), not from the
 *      stored pnl, so a BE-labelled partial cannot flip it; and it stays
 *      consistent with the broker-close path that signs R by pnl.
 *
 * Pure and dependency-free so the refusals are unit-testable.
 */

function isNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * The R-multiple this trade WOULD get if its R were derived, or null when
 * the prices do not allow it.
 *
 * Entry and exit must be real prices, the stop must sit on the losing side
 * of the entry, and the stop distance must be strictly positive. Returns
 * null rather than a fabricated value in every refused case — the caller
 * must treat null as "cannot be derived", never fall back to a guess.
 */
export function derivableR(trade: Trade): number | null {
  const entry = trade.entry_price;
  const exit = trade.exit_price;
  const stop = trade.stop_loss;

  if (!isNum(entry) || !isNum(exit) || !isNum(stop)) return null;
  if (stop === 0) return null;
  // The stop must be on the losing side: below a BUY's entry, above a SELL's.
  if (trade.direction === 'SELL' ? stop <= entry : stop >= entry) return null;

  const risk = Math.abs(entry - stop);
  if (!Number.isFinite(risk) || risk <= 0) return null;

  const moved = trade.direction === 'BUY' ? exit - entry : entry - exit;
  const r = moved / risk;
  return Number.isFinite(r) ? round2(r) : null;
}

/**
 * The patch `set_r_multiple` would apply: the derived R, or null when there
 * is nothing to write (already stored, or not derivable).
 */
export function rPatchFor(trade: Trade): Partial<Trade> | null {
  if (trade.r_multiple != null && Number.isFinite(trade.r_multiple)) return null;
  const r = derivableR(trade);
  return r === null ? null : { r_multiple: r };
}
