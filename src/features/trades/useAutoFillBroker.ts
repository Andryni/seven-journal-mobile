import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTrades } from './useTrades';
import { useFillHistory } from './useFillHistory';
import { useBrokerCostMap } from '../sync/useBrokerCosts';
import { fillPatchFor } from './brokerFill';
import { fillCandidates, seedFillSignatures } from './brokerArrivals';
import { supabase } from '../../api/supabaseClient';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n';
import type { Trade } from '../../types/domain';
import type { FillHistoryWrite } from './fillHistory';

/**
 * Background completion after each bridge sync.
 *
 * The one-tap button fills what the trader can see; a bridge keeps DELIVERING
 * closed trades while the trader is doing anything else, and every delivery
 * used to re-open the same gap the button had just closed. This hook closes
 * it automatically, in two cases (see brokerArrivals.ts): a NEW broker-fed
 * trade, and an existing one whose prices just changed enough for its R to
 * become derivable — which is what the terminal's answer to a back-fill
 * request looks like. Both run the same fill plan as the button: broker costs
 * onto trades with none, R derived on the device from the trade's own prices,
 * each write recorded in the change history with source 'auto'.
 *
 * Safety rails, all structural:
 *
 *   - Reuses fillPatchFor verbatim: trades the user already filled (any
 *     recorded cost) are never overwritten, and the R derivation is the
 *     shared device-side one — the background path cannot diverge from the
 *     button.
 *   - No dialog. The user opted in by connecting the bridge; the fill writes
 *     only what the data licenses, and the history records 'auto' so the
 *     provenance stays honest. A toast makes it visible without demanding
 *     attention.
 *   - The seen-map is a ref seeded at mount from the trades already present,
 *     so app START does not replay the whole history — only changes after
 *     mount. A re-render cannot double-fire it (the map advances inside
 *     fillCandidates, so a write cannot re-trigger itself); the running flag
 *     keeps two overlapping syncs from interleaving their writes (the fill
 *     itself is idempotent, the toast is not).
 *   - Logging stays best-effort after the journal writes, exactly like the
 *     button path: a failed audit line must never roll back a filled trade.
 */
export function useAutoFillBroker(): void {
  const { trades } = useTrades();
  const { logWrites } = useFillHistory();
  // Only broker-fed trades can have staging rows; keep the query narrow.
  const syncIds = useMemo(
    () => trades.filter(x => x.sync_source_id).map(x => x.id),
    [trades]
  );
  const { costs: brokerCosts } = useBrokerCostMap(syncIds);
  const { showSuccess } = useToast();
  const { t } = useT();

  /**
   * Signature of every broker-fed trade already offered to the fill, seeded at
   * mount. The VALUE matters now, not just presence: a changed signature is how
   * a broker back-fill announces itself on a trade that already existed.
   */
  const seen = useRef<Map<string, string> | null>(null);
  const running = useRef(false);

  const toastFor = useCallback((n: number) => {
    showSuccess(t('gapsAutoDone').replace('{n}', String(n)));
  }, [showSuccess, t]);

  useEffect(() => {
    // First pass: adopt what already exists; changes only from now on.
    if (seen.current === null) {
      seen.current = seedFillSignatures(trades);
      return;
    }

    // A run in flight defers the scan entirely rather than consuming it: the
    // map must not advance past a candidate nobody processed. The next render
    // after the run re-detects the same change (idempotent by construction),
    // and by then the fields it just wrote no longer look like candidates.
    if (running.current) return;

    const arrivals = fillCandidates(trades, seen.current);
    if (arrivals.length === 0) return;

    running.current = true;

    void runFill(arrivals, brokerCosts, logWrites, toastFor).finally(() => {
      running.current = false;
    });
    // brokerCosts is deliberately not a dependency: re-running on its
    // refetches would re-fire the effect on every query paint. A trade whose
    // costs are absent from the map at arrival simply gets no cost write —
    // the R half is price-only, and the button covers anything left over.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades]);
}

async function runFill(
  arrivals: Trade[],
  brokerCosts: Map<string, { commission: number; swap: number }>,
  logWrites: (writes: FillHistoryWrite[], userId: string) => Promise<void>,
  toastFor: (n: number) => void
): Promise<void> {
  // The plan is computed from the arrival list with the cost map as-is; a
  // trade missing from the map just gets no cost write (R is price-only).
  const plan = fillPatchFor(arrivals, brokerCosts);
  if (plan.patches.length === 0) return;

  let filled = 0;
  const logged: FillHistoryWrite[] = [];
  for (const p of plan.patches) {
    const fields: { commission?: number; swap?: number; r_multiple?: number } = {};
    if (p.commission !== undefined) {
      fields.commission = p.commission;
      fields.swap = p.swap ?? 0;
    }
    if (p.rMultiple !== undefined) fields.r_multiple = p.rMultiple;
    if (Object.keys(fields).length === 0) continue;

    const { error } = await supabase
      .from('trades')
      .update(fields)
      .eq('id', p.tradeId);
    if (error) {
      // Best-effort by contract: the trade keeps its gaps, the button remains
      // for a manual pass, and the next arrival batch is unaffected.
      console.warn('auto-fill write failed', error.message);
      continue;
    }
    filled += 1;
    // One history line per written field, mirroring the patch exactly —
    // same discipline as the button and chat paths.
    if (p.commission !== undefined) {
      logged.push({
        tradeId: p.tradeId,
        source: 'auto',
        kind: 'costs',
        commission: p.commission,
        swap: p.swap ?? 0,
      });
    }
    if (p.rMultiple !== undefined) {
      logged.push({
        tradeId: p.tradeId,
        source: 'auto',
        kind: 'r_multiple',
        rMultiple: p.rMultiple,
      });
    }
  }

  if (filled > 0) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user && logged.length > 0) await logWrites(logged, user.id);
    toastFor(filled);
  }
}
