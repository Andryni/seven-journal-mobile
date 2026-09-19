import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '../../api/supabaseClient';

/**
 * Broker-recorded costs, read from the sync staging table.
 *
 * The ingest contract stores commission and swap on every `sync_trades`
 * payload, and a promoted journal trade keeps `sync_source_id` → the staging
 * row still holds what the broker knew even when the journal row was created
 * without costs. This is the only place those figures can be recovered from
 * AFTER promotion, and it is client-side because the user confirms each fill.
 *
 * Returns a map keyed by journal trade id. Values are normalised to positive
 * magnitudes, the app-wide convention. The query fails soft: an unreachable
 * staging table (or the Jest render preset's placeholder client) yields an
 * empty map, which callers must treat as "no broker data", never as zero.
 */

export interface BrokerCosts {
  commission: number;
  swap: number;
}

const num = (x: unknown): number | null =>
  typeof x === 'number' && Number.isFinite(x) ? x : null;

export function useBrokerCostMap(tradeIds: string[]): {
  costs: Map<string, BrokerCosts>;
  isLoading: boolean;
} {
  const key = useMemo(() => [...new Set(tradeIds)].sort().join(','), [tradeIds]);

  const query = useQuery<BrokerCostsMap>({
    queryKey: ['broker_costs', key],
    enabled: key.length > 0,
    staleTime: 60 * 1000,
    retry: false,
    queryFn: async () => {
      const ids = key.split(',').filter(Boolean);
      const { data, error } = await supabase
        .from('sync_trades')
        .select('resolved_trade_id, payload')
        .in('resolved_trade_id', ids)
        .limit(200);
      if (error) throw error;

      const map: BrokerCostsMap = {};
      for (const row of data ?? []) {
        if (!row.resolved_trade_id) continue;
        const payload = (row.payload ?? {}) as Record<string, unknown>;
        const c = num(payload.commission);
        const s = num(payload.swap);
        if (c === null && s === null) continue;
        map[row.resolved_trade_id] = {
          commission: Math.abs(c ?? 0),
          swap: Math.abs(s ?? 0),
        };
      }
      return map;
    },
  });

  const costs = useMemo(() => {
    const map = new Map<string, BrokerCosts>();
    for (const [id, v] of Object.entries(query.data ?? {})) map.set(id, v);
    return map;
  }, [query.data]);

  return { costs, isLoading: query.isLoading };
}

/** Plain object form keeps the react-query cache serialisable. */
type BrokerCostsMap = Record<string, BrokerCosts>;
