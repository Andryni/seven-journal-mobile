import type { Trade } from '../../types/domain';
import { derivableR } from '../../utils/rDerivation';

/**
 * Which broker-fed trades deserve a completion pass, and why.
 *
 * The background fill used to fire on ARRIVALS only: a trade id never seen
 * before. That covers a fresh sync, and misses the case this journal now
 * depends on — the trader asks the coach to recover missing levels, the
 * terminal answers at its next heartbeat, and the stop/take-profit/exit land on
 * a trade that has existed for days. No new row appears, so nothing ran, and
 * the R the coach had promised to make derivable stayed null until the trader
 * went looking for it.
 *
 * So the trigger is no longer "a new row" but "a row whose FILLABLE facts just
 * changed". A signature over exactly the fields the fill reads decides that,
 * and the seen-map is advanced as candidates are produced — so the write the
 * fill performs cannot feed back into another pass.
 *
 * Pure (no React, no Supabase) so the loop-prevention is unit-testable: this
 * runs on every trade-list change, and a false positive here is an infinite
 * write loop rather than a missed convenience.
 */

/**
 * The fields the fill plan depends on.
 *
 * Deliberately narrow: adding anything the trader edits by hand (notes, tags,
 * mental state) would make every edit look like a broker arrival.
 */
export function tradeFillSignature(trade: Trade): string {
  return [
    trade.stop_loss ?? '',
    trade.take_profit ?? '',
    trade.exit_price ?? '',
    trade.pnl ?? '',
    trade.r_multiple ?? '',
    trade.commission ?? '',
    trade.swap ?? '',
  ].join('|');
}

/**
 * Trades to complete now. `seen` is updated IN PLACE: every trade examined is
 * remembered with its current signature, whether or not it became a candidate.
 *
 * Two cases qualify:
 *   1. An id never seen — a trade the bridge just delivered.
 *   2. An id whose prices changed and whose R is still missing but is NOW
 *      derivable — the terminal answered a back-fill request. A stop that
 *      arrives without an exit price changes the signature but cannot produce
 *      an R, so it is remembered and skipped, ready for the exit that follows.
 */
export function fillCandidates(trades: Trade[], seen: Map<string, string>): Trade[] {
  const candidates: Trade[] = [];

  for (const trade of trades) {
    if (!trade.sync_source_id) continue;

    const signature = tradeFillSignature(trade);
    const previous = seen.get(trade.id);
    if (previous === signature) continue;
    seen.set(trade.id, signature);

    if (previous === undefined) {
      candidates.push(trade);
      continue;
    }
    if (trade.r_multiple == null && derivableR(trade) !== null) {
      candidates.push(trade);
    }
  }

  return candidates;
}

/** Seed the seen-map from what already exists, without treating it as new. */
export function seedFillSignatures(trades: Trade[]): Map<string, string> {
  const seen = new Map<string, string>();
  for (const trade of trades) {
    if (!trade.sync_source_id) continue;
    seen.set(trade.id, tradeFillSignature(trade));
  }
  return seen;
}
