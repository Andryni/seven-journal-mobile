import type { Trade } from '../../types/domain';

/**
 * What indiscipline costs, in money.
 *
 * `computeInsights` already attributes a currency amount to each finding it
 * makes — but each finding is computed on its own, over its own set of trades.
 * Adding those amounts up would count the same losing trade twice whenever two
 * rules point at it (a revenge entry taken right after a loss in a tilt state
 * is three findings and one trade), and a total that double counts is a total
 * that exaggerates. In a discipline tool, exaggerating is not a cosmetic
 * problem: the number exists to change behaviour, and a number the trader can
 * disprove by hand is a number they will dismiss along with the next one.
 *
 * So the trades are bucketed EXCLUSIVELY, by priority:
 *
 *   1. tilt      — mental_state is revenge / fomo / greedy (self-reported, so
 *                  it wins over anything the app could infer);
 *   2. off-plan  — no setup recorded: the trade cannot be attributed to any
 *                  written plan;
 *   3. revenge   — entered within 30 minutes of a losing exit;
 *   4. clean     — everything else, which is the BASELINE.
 *
 * The cost of a bucket is what it lost *relative to the trader's own clean
 * trades*, not relative to zero: a losing bucket is not the same thing as a
 * bucket that loses, and a comparison against the trader's own behaviour is
 * the only one they cannot argue with.
 */

export type BehaviourId = 'tilt' | 'off-plan' | 'revenge';

/** Taken from the same list the insight engine counts as tilt. */
const TILT_STATES = ['revenge', 'fomo', 'greedy'];

/** Same window as the revenge-trading insight: half an hour. */
const REVENGE_WINDOW_MS = 30 * 60 * 1000;

/** Below this, a baseline is noise and the card says nothing at all. */
export const MIN_TRADES_FOR_COST = 20;
/** Minimum clean trades to have a baseline worth comparing against. */
const MIN_CLEAN = 5;

export interface BehaviourCost {
  id: BehaviourId;
  /** Trades assigned to this bucket. */
  count: number;
  /** Their total P&L. */
  pnl: number;
  /** What they cost versus the clean baseline, floored at 0. */
  cost: number;
  /** The bucket's average P&L — what the trader actually did here. */
  avg: number;
}

export interface DisciplineCost {
  /** Sum of the bucket costs. Never negative: a bucket that pays is 0. */
  total: number;
  /** Costliest first; only buckets with a cost > 0 are listed. */
  byBehaviour: BehaviourCost[];
  cleanCount: number;
  cleanAvg: number;
  closedCount: number;
  /** Realised P&L of the period, for the "share of gross" line. */
  gross: number;
  /** Cost as a share of the period's gross P&L, when there is one. */
  shareOfGross: number | null;
}

function chronological(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
  );
}

export function disciplineCost(trades: Trade[]): DisciplineCost | null {
  const closed = trades.filter(t => t.pnl !== null);
  if (closed.length < MIN_TRADES_FOR_COST) return null;

  const seq = chronological(closed);
  const buckets: Record<BehaviourId | 'clean', Trade[]> = {
    tilt: [],
    'off-plan': [],
    revenge: [],
    clean: [],
  };

  for (let i = 0; i < seq.length; i++) {
    const trade = seq[i];

    if (TILT_STATES.includes(trade.mental_state)) {
      buckets.tilt.push(trade);
      continue;
    }

    // No setup recorded: the trade cannot be tied to the plan at all.
    if ((trade.setup_structures ?? []).length === 0) {
      buckets['off-plan'].push(trade);
      continue;
    }

    const prev = seq[i - 1];
    if (prev) {
      const gap =
        new Date(trade.entry_time).getTime() -
        new Date(prev.exit_time ?? prev.entry_time).getTime();
      if ((prev.pnl ?? 0) < 0 && gap >= 0 && gap <= REVENGE_WINDOW_MS) {
        buckets.revenge.push(trade);
        continue;
      }
    }

    buckets.clean.push(trade);
  }

  if (buckets.clean.length < MIN_CLEAN) return null;

  const avg = (list: Trade[]) =>
    list.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / Math.max(1, list.length);

  const cleanAvg = avg(buckets.clean);
  const gross = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const byBehaviour: BehaviourCost[] = (['tilt', 'off-plan', 'revenge'] as BehaviourId[])
    .map(id => {
      const list = buckets[id];
      const pnl = list.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
      const bucketAvg = list.length > 0 ? pnl / list.length : 0;
      return {
        id,
        count: list.length,
        pnl,
        avg: bucketAvg,
        // Floored at zero: a "bad" bucket that outperforms the trader's own
        // baseline is not a cost, and reporting it as one would be the tool
        // flattering its own thesis.
        cost: Math.max(0, (cleanAvg - bucketAvg) * list.length),
      };
    })
    .filter(b => b.count > 0)
    .sort((a, b) => b.cost - a.cost);

  const total = byBehaviour.reduce((sum, b) => sum + b.cost, 0);

  return {
    total,
    byBehaviour,
    cleanCount: buckets.clean.length,
    cleanAvg,
    closedCount: closed.length,
    gross,
    shareOfGross: gross !== 0 ? total / Math.abs(gross) : null,
  };
}
