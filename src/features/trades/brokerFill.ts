import type { Trade } from '../../types/domain';
import type { BrokerCosts } from '../sync/useBrokerCosts';
import { rPatchFor } from '../../utils/rDerivation';

/**
 * One-tap completion: what a "fill from broker" press would write.
 *
 * The card names it "Compléter avec le broker" and the user confirms ONCE for
 * the whole batch, so the rules here are the ones that make that single tap
 * safe:
 *
 *   1. Costs come from the broker's own staging record, never estimated. A
 *      trade the broker says nothing about is not touched — even though the
 *      button's promise is "everything available", not "everything".
 *   2. Nothing is ever overwritten. A trade with ANY recorded cost was
 *      touched by the trader or the bridge; a stored R wins by the same
 *      logic (rPatchFor already returns null for it).
 *   3. The R half reuses rPatchFor verbatim, so the button, the chat action
 *      and the edit form derive the identical number by construction.
 *
 * Order matters for the summary the confirmation shows: costs first (the
 * broker data is the scarce, authoritative part), then the derived R.
 *
 * Pure and dependency-light so the refusals stay unit-testable.
 */

export interface BrokerFillPatch {
  tradeId: string;
  /** Present when the broker costs were written. */
  commission?: number;
  swap?: number;
  /** Present when an R was derived from the trade's own prices. */
  rMultiple?: number;
}

export interface BrokerFillPlan {
  patches: BrokerFillPatch[];
  costsCount: number;
  rCount: number;
}

export function fillPatchFor(
  trades: Trade[],
  brokerCosts: Map<string, BrokerCosts> | null
): BrokerFillPlan {
  const patches: BrokerFillPatch[] = [];

  for (const trade of trades) {
    const patch: BrokerFillPatch = { tradeId: trade.id };

    // Costs: only from the broker map, only onto a trade that has none.
    const costs = brokerCosts?.get(trade.id);
    if (costs && trade.commission == null && trade.swap == null) {
      patch.commission = Math.abs(costs.commission);
      patch.swap = Math.abs(costs.swap);
    }

    // R: the shared derivation, which is a no-op when R is already stored
    // or not derivable from the prices.
    const r = rPatchFor(trade);
    if (r) patch.rMultiple = r.r_multiple!;

    if (patch.commission === undefined && patch.rMultiple === undefined) continue;
    patches.push(patch);
  }

  return {
    patches,
    costsCount: patches.filter(p => p.commission !== undefined).length,
    rCount: patches.filter(p => p.rMultiple !== undefined).length,
  };
}
