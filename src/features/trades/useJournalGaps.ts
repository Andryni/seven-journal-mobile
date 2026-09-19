import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { supabase } from '../../api/supabaseClient';
import { useTrades } from '../trades/useTrades';
import { useBrokerCostMap, type BrokerCosts } from '../sync/useBrokerCosts';
import { buildJournalGapsReport, type JournalGapsReport } from './journalGaps';
import { fillPatchFor } from './brokerFill';
import { useFillHistory } from './useFillHistory';
import type { FillHistoryWrite } from './fillHistory';

/**
 * Journal gaps + the broker costs that can back-fill them.
 *
 * The report is computed on the device from the journal itself. The costs
 * lookup reads `sync_trades.payload` directly: the ingest contract stores
 * commission and swap on every staging row, and a promoted journal trade
 * carries `sync_source_id` pointing back at it. Rows whose costs the broker
 * knows but the journal does not are exactly the ones the card can offer to
 * fill — the user confirms, the app writes, nothing is automatic.
 *
 * The staging query is bounded (only the trades the report rows point at)
 * and failure-tolerant: an unreachable staging table degrades to "no broker
 * data", which is the honest answer for a manual journal anyway.
 *
 * The one-tap completion (`fillAllFromBroker`) writes ONLY what the data
 * licenses: broker-recorded costs onto trades with none, and R-multiples
 * derived on the device from the trade's own prices. It runs from a user
 * press — a write with no explicit press behind it would be the app
 * editing its own journal.
 */

/** Broker-recorded costs for journal trades that lack them, keyed by trade id. */
export type BrokerCostRow = BrokerCosts;

/** What the one-tap fill would write, for the confirmation dialog. */
export interface FillPlanSummary {
  /** Trades that would receive at least one value. */
  trades: number;
  /** Broker-cost writes (commission + swap together). */
  costs: number;
  /** Derived-R writes. */
  r: number;
}

export interface UseJournalGapsResult {
  report: JournalGapsReport;
  /** Broker-recorded costs for journal trades that lack them, by trade id. */
  brokerCosts: Map<string, BrokerCosts>;
  isLoading: boolean;
  /** Write confirmed costs onto a journal trade (positive magnitudes). */
  applyCosts: (tradeId: string, commission: number, swap: number) => Promise<void>;
  /** Trades that the one-tap fill would actually change (all accounts). */
  fillableCount: number;
  /** The confirmation's numbers: what a press would write, by kind. */
  fillPlanSummary: FillPlanSummary;
  /**
   * One-press completion: costs from the broker record, then R derived on
   * the device. Idempotent — a second press writes nothing.
   */
  fillAllFromBroker: () => Promise<number>;
}

const EMPTY_REPORT: JournalGapsReport = {
  audited: 0,
  incomplete: 0,
  counts: {
    r: 0, rFillable: 0, stop: 0, target: 0, exit: 0,
    costs: 0, excursions: 0, excursionsFillable: 0, notes: 0,
  },
  rows: [],
};

export function useJournalGaps(): UseJournalGapsResult {
  const { trades, isLoading: tradesLoading, updateTrade } = useTrades();
  const queryClient = useQueryClient();
  const { logWrites } = useFillHistory();

  /**
   * The report is derived state, not server state — but routing it through a
   * query gives the card a single loading story and keeps the key stable for
   * the invalidations below.
   */
  const reportQuery = useQuery<JournalGapsReport>({
    queryKey: ['journal_gaps', trades.length],
    queryFn: async () => buildJournalGapsReport(trades),
    staleTime: 0,
    gcTime: 0,
  });

  const incompleteRows = useMemo(() => reportQuery.data?.rows ?? [], [reportQuery.data]);

  // Broker costs of the visible worst rows, through the shared staging
  // reader — one implementation for the card, the chat action and any
  // future surface, so they can never disagree about what the broker knew.
  const { costs } = useBrokerCostMap(
    useMemo(() => incompleteRows.map(r => r.trade.id), [incompleteRows])
  );
  const brokerCosts = costs;

  /**
   * The one-tap fill works on the account-scoped list the card displays, so
   * the confirmation and the writes cover exactly what the screen shows.
   */
  const scopedTrades = useMemo(
    () => incompleteRows.map(r => r.trade),
    [incompleteRows]
  );

  const fillPlan = useMemo(
    () => fillPatchFor(scopedTrades, brokerCosts),
    [scopedTrades, brokerCosts]
  );

  /**
   * The single write path, from a press. `patch` is applied verbatim — the
   * plan was computed from the same trade list the confirmation described.
   */
  const writePatch = useCallback(
    async (patch: { id: string; commission?: number; swap?: number; r_multiple?: number }) => {
      const { id, ...fields } = patch;
      await updateTrade({ id, ...fields } as never);
    },
    [updateTrade]
  );

  /**
   * The audit lines mirror the writes exactly: one costs line and one
   * r_multiple line per touched trade, each carrying the value that landed.
   * Logged best-effort AFTER the journal writes succeed — a failed log must
   * never roll back a write the trader confirmed (see useFillHistory).
   */
  const logFillHistory = useCallback(
    async (plan: { patches: { tradeId: string; commission?: number; swap?: number; rMultiple?: number }[] }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const writes: FillHistoryWrite[] = [];
      for (const p of plan.patches) {
        if (p.commission !== undefined) {
          writes.push({ tradeId: p.tradeId, source: 'app_button', kind: 'costs', commission: p.commission, swap: p.swap ?? 0 });
        }
        if (p.rMultiple !== undefined) {
          writes.push({ tradeId: p.tradeId, source: 'app_button', kind: 'r_multiple', rMultiple: p.rMultiple });
        }
      }
      if (writes.length > 0) await logWrites(writes, user.id);
    },
    [logWrites]
  );

  /** Write confirmed costs onto one journal trade (positive magnitudes). */
  const applyCosts = useCallback(
    async (tradeId: string, commission: number, swap: number) => {
      await writePatch({ id: tradeId, commission: Math.abs(commission), swap: Math.abs(swap) });
      await logFillHistory({
        patches: [{ tradeId, commission: Math.abs(commission), swap: Math.abs(swap) }],
      }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['journal_gaps'] });
      queryClient.invalidateQueries({ queryKey: ['broker_costs'] });
    },
    [writePatch, logFillHistory, queryClient]
  );

  /**
   * The one-tap completion. Sequenced, not parallel: a hundred mutations
   * would hammer the queue, and `useTrades` invalidates ['trades'] on every
   * success — interleaved writes would race the refetch. The returned count
   * feeds the toast; 0 means every fillable value was already written.
   */
  const fillAllFromBroker = useCallback(async () => {
    const plan = fillPatchFor(scopedTrades, brokerCosts);
    let written = 0;
    const applied: { tradeId: string; commission?: number; swap?: number; rMultiple?: number }[] = [];
    for (const p of plan.patches) {
      const fields: { commission?: number; swap?: number; r_multiple?: number } = {};
      if (p.commission !== undefined) {
        fields.commission = p.commission;
        fields.swap = p.swap ?? 0;
      }
      if (p.rMultiple !== undefined) fields.r_multiple = p.rMultiple;
      if (Object.keys(fields).length === 0) continue;
      await writePatch({ id: p.tradeId, ...fields });
      applied.push(p);
      written += 1;
    }
    // Only the writes that actually landed are logged: a plan entry skipped
    // mid-batch leaves no line, so the history never claims more than the
    // journal holds.
    await logFillHistory({ patches: applied }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['journal_gaps'] });
    queryClient.invalidateQueries({ queryKey: ['broker_costs'] });
    return written;
  }, [scopedTrades, brokerCosts, writePatch, logFillHistory, queryClient]);

  return {
    report: reportQuery.data ?? EMPTY_REPORT,
    brokerCosts,
    applyCosts,
    fillableCount: fillPlan.patches.length,
    fillPlanSummary: {
      trades: fillPlan.patches.length,
      costs: fillPlan.costsCount,
      r: fillPlan.rCount,
    },
    fillAllFromBroker,
    isLoading: tradesLoading || reportQuery.isLoading,
  };
}
