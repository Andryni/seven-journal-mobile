import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTrades } from './useTrades';
import { useFillHistory } from './useFillHistory';
import { useBrokerCostMap } from '../sync/useBrokerCosts';
import { fillPatchFor } from './brokerFill';
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
 * it automatically: whenever the trade list sees a NEW broker-fed trade
 * (`sync_source_id` present, never seen before), the same fill plan as the
 * button runs in the background — broker costs onto trades with none, R
 * derived on the device from the trade's own prices — and the change history
 * records each write with source 'auto'.
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
 *   - The seen-set is a ref seeded at mount from the trades already present,
 *     so app START does not replay the whole history — only arrivals after
 *     mount. A re-render cannot double-fire it; the running flag keeps two
 *     overlapping syncs from interleaving their writes (the fill itself is
 *     idempotent, the toast is not).
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

  /** Broker-fed trade ids already offered to the fill (seeded at mount). */
  const seen = useRef<Set<string> | null>(null);
  const running = useRef(false);

  const toastFor = useCallback((n: number) => {
    showSuccess(t('gapsAutoDone').replace('{n}', String(n)));
  }, [showSuccess, t]);

  useEffect(() => {
    // First pass: adopt what already exists; arrivals only from now on.
    if (seen.current === null) {
      seen.current = new Set(trades.filter(x => x.sync_source_id).map(x => x.id));
      return;
    }

    const arrivals = trades.filter(x => x.sync_source_id && !seen.current!.has(x.id));
    if (arrivals.length === 0 || running.current) return;

    running.current = true;
    for (const a of arrivals) seen.current!.add(a.id);

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
