import type { Trade } from '../types/domain';

/**
 * Trading costs: commission, swap, and what they do to an edge.
 *
 * The app stored a single `pnl` with no way to tell whether it was gross or
 * net, and the MT4/MT5 importer parsed broker reports that *contain*
 * commission and swap columns and threw them away.
 *
 * Why this matters more than it looks: costs are roughly constant per trade
 * while edge scales with holding time. A scalper taking 20 trades a day pays
 * them 20 times; at $7 a round turn that is $140 daily, or several R a week.
 * An expectancy computed without them can be positive while the account
 * bleeds — the app would be actively confirming a losing strategy.
 *
 * CONVENTION, and it is the important part:
 *   - `pnl` is NET. It always was, and nothing here re-subtracts costs from it.
 *   - `commission` / `swap` are stored as POSITIVE magnitudes.
 *   - Gross is therefore derived: gross = net + costs.
 *
 * Choosing net as the source of truth means historical rows stay correct with
 * costs at 0, and no screen silently changes value when the migration lands.
 */

/** Positive total cost of a trade, or 0 when nothing was recorded. */
export function tradeCost(trade: Pick<Trade, 'commission' | 'swap'>): number {
  const commission = Number(trade.commission ?? 0);
  const swap = Number(trade.swap ?? 0);
  // A broker exporting costs as negatives is common; normalise so the sign
  // convention can never double-count or cancel out.
  const c = Number.isFinite(commission) ? Math.abs(commission) : 0;
  const s = Number.isFinite(swap) ? Math.abs(swap) : 0;
  return round2(c + s);
}

/** True when this trade carries any recorded cost. */
export function hasCost(trade: Pick<Trade, 'commission' | 'swap'>): boolean {
  return tradeCost(trade) > 0;
}

/** Result before costs. Null for an open trade, like `pnl` itself. */
export function grossPnl(
  trade: Pick<Trade, 'pnl' | 'commission' | 'swap'>
): number | null {
  if (trade.pnl === null || trade.pnl === undefined || !Number.isFinite(trade.pnl)) {
    return null;
  }
  return round2(trade.pnl + tradeCost(trade));
}

export interface CostSummary {
  /** Number of closed trades examined. */
  trades: number;
  /** How many of them actually carry cost data. */
  tradesWithCost: number;
  totalCommission: number;
  totalSwap: number;
  totalCost: number;
  /** Net P&L — what the account really made. */
  netPnl: number;
  /** P&L before costs. */
  grossPnl: number;
  /** Mean cost per closed trade. */
  avgCostPerTrade: number;
  /** Net expectancy per trade. */
  netExpectancy: number;
  /** Expectancy the app would show if costs were ignored. */
  grossExpectancy: number;
  /**
   * Share of gross profit consumed by costs, as a percentage. Null when gross
   * is not positive: "costs ate 140% of a loss" is not a meaningful sentence.
   */
  costRatioPct: number | null;
  /**
   * The finding that justifies this whole module: gross is profitable, net is
   * not. The edge is real but entirely eaten by fees.
   */
  profitableBeforeCostsOnly: boolean;
}

export function summarizeCosts(trades: Trade[]): CostSummary {
  const closed = trades.filter(t => t.pnl !== null && Number.isFinite(t.pnl as number));

  let totalCommission = 0;
  let totalSwap = 0;
  let netPnl = 0;
  let tradesWithCost = 0;

  for (const t of closed) {
    const c = Math.abs(Number(t.commission ?? 0)) || 0;
    const s = Math.abs(Number(t.swap ?? 0)) || 0;
    totalCommission += c;
    totalSwap += s;
    netPnl += t.pnl as number;
    if (c + s > 0) tradesWithCost++;
  }

  const totalCost = round2(totalCommission + totalSwap);
  const gross = round2(netPnl + totalCost);
  const n = closed.length;

  return {
    trades: n,
    tradesWithCost,
    totalCommission: round2(totalCommission),
    totalSwap: round2(totalSwap),
    totalCost,
    netPnl: round2(netPnl),
    grossPnl: gross,
    avgCostPerTrade: n > 0 ? round2(totalCost / n) : 0,
    netExpectancy: n > 0 ? round2(netPnl / n) : 0,
    grossExpectancy: n > 0 ? round2(gross / n) : 0,
    costRatioPct: gross > 0 ? round2((totalCost / gross) * 100) : null,
    profitableBeforeCostsOnly: gross > 0 && round2(netPnl) <= 0,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
