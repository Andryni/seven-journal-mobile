import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { normalizeBars, type CandleBar } from '../../utils/candleChart';

/**
 * The candles of one trade, and the request that asks the terminal for them.
 *
 * The trade-off this encodes: the journal shows a replay only when the
 * terminal has actually answered. There is no market data provider behind it,
 * no key, no subscription — the prices come from the same MT5 the trade came
 * from, on demand, once. So the states are "have them", "asked", "cannot ask",
 * and never "here is a chart of something else".
 */

export interface TradeCandles {
  bars: CandleBar[];
  timeframe: string;
  /** The terminal had to cap the window; the chart says so. */
  truncated: boolean;
  fetchedAt: string;
}

export function useTradeCandles(
  tradeId: string | null,
  options: { enabled: boolean; pollMs?: number }
) {
  const query = useQuery<TradeCandles | null>({
    queryKey: ['trade_candles', tradeId],
    enabled: options.enabled && !!tradeId,
    // Bars are immutable once fetched — unless the trade is still open, in
    // which case the terminal will answer again with a longer window. The
    // polling case is therefore opt-in and short-lived (while waiting for a
    // request to be served).
    staleTime: 10 * 60 * 1000,
    retry: false,
    refetchInterval: options.pollMs,
    queryFn: async (): Promise<TradeCandles | null> => {
      const { data, error } = await supabase
        .from('trade_candles')
        .select('bars, timeframe, truncated, fetched_at')
        .eq('trade_id', tradeId as string)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // A missing table (database not migrated to SECTION 9) and "no answer
      // yet" are the same thing from here: no replay. Neither is an error the
      // trader should be shown.
      if (error || !data) return null;

      const bars = normalizeBars(data.bars);
      if (bars.length === 0) return null;

      return {
        bars,
        timeframe: data.timeframe ?? 'M1',
        truncated: data.truncated === true,
        fetchedAt: data.fetched_at ?? new Date().toISOString(),
      };
    },
  });

  return {
    candles: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

/**
 * Ask the terminal for a trade's candles.
 *
 * The RPC dedupes while a request is still pending, so a double tap costs the
 * EA nothing. It returns the number of requests actually queued — 0 means "one
 * is already on its way", which the UI reports as waiting rather than failure.
 */
export function useRequestCandles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tradeId: string): Promise<number> => {
      const { data, error } = await supabase.rpc('request_candles', {
        p_trade_ids: [tradeId],
        p_timeframe: 'M1',
      });
      if (error) throw new Error(error.message);
      return (data as number) ?? 0;
    },
    onSuccess: () => {
      // The connector card counts pending requests; keep it truthful.
      queryClient.invalidateQueries({ queryKey: ['sync_requests'] });
    },
  });
}
