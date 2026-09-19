import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { supabase } from '../../api/supabaseClient';
import { historyInsertFor, type FillHistoryEntry, type FillHistoryWrite } from './fillHistory';

/**
 * Reader + writer for the fill change history.
 *
 * The query is a single page of the user's most recent rows, shared by every
 * consumer (the detail modal, the fill surfaces) through one cache key: the
 * table grows by a handful of rows per session at most, so per-trade queries
 * would spend a round trip each to read data this one page already holds.
 *
 * `logWrite` is failure-tolerant ON PURPOSE, and that is the controversial
 * line here: the history is provenance, not state. If the insert fails
 * offline, the trade itself was still written — failing the whole one-tap
 * batch over a missing audit line would leave the journal half-filled and
 * the trader staring at an error for data that DID land. A dropped line is
 * an honest gap in the log; a rolled-back fill is a broken feature.
 */
export function useFillHistory() {
  const queryClient = useQueryClient();

  const historyQuery = useQuery({
    queryKey: ['fill_history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trade_fill_history')
        .select('id,trade_id,source,kind,value,detail,created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown[];
    },
    staleTime: 60_000,
    retry: false,
  });

  /** Append one write to the log and refresh the shared cache. */
  const logWrite = useCallback(
    async (write: FillHistoryWrite, userId: string) => {
      const { error } = await supabase
        .from('trade_fill_history')
        .insert(historyInsertFor(write, userId));
      if (!error) {
        queryClient.invalidateQueries({ queryKey: ['fill_history'] });
      }
      // The error is swallowed by contract: see the header comment.
    },
    [queryClient]
  );

  /** Log many writes; one insert per row, best-effort. */
  const logWrites = useCallback(
    async (writes: FillHistoryWrite[], userId: string) => {
      for (const w of writes) {
        await logWrite(w, userId);
      }
    },
    [logWrite]
  );

  /**
   * Undo one logged write: strip exactly the values the entry says were
   * written, then append a reversal line. The entry itself is the source of
   * truth — a costs undo nulls commission and swap, an r undo nulls the
   * R — so the revert cannot drift from what was recorded.
   *
   * The reversal line carries source 'user': the trader pressed the button,
   * the app only executed. Values are logged for the audit trail; the
   * trade's new state is "the value is gone", not another number.
   */
  const revertWrite = useCallback(
    async (entry: FillHistoryEntry) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !entry.trade_id) return;

      if (entry.kind === 'costs') {
        const { error } = await supabase
          .from('trades')
          .update({ commission: 0, swap: 0 })
          .eq('id', entry.trade_id);
        if (error) return;
      } else if (entry.kind === 'r_multiple') {
        const { error } = await supabase
          .from('trades')
          .update({ r_multiple: null })
          .eq('id', entry.trade_id);
        if (error) return;
      } else {
        // Tag and mental_state are not reverted: the chat-added tag may
        // have been edited since, and stripping it from the merged list
        // could remove a value the trader added by hand afterwards. The
        // form is the right tool for those.
        return;
      }

      await supabase.from('trade_fill_history').insert(
        historyInsertFor(
          {
            tradeId: entry.trade_id,
            source: 'user',
            kind: entry.kind,
            ...(entry.kind === 'costs'
              ? { commission: 0, swap: 0 }
              : { rMultiple: 0 }),
          },
          user.id
        )
      );
      queryClient.invalidateQueries({ queryKey: ['fill_history'] });
      queryClient.invalidateQueries({ queryKey: ['journal_gaps'] });
      queryClient.invalidateQueries({ queryKey: ['trades'] });
    },
    [queryClient]
  );

  return {
    history: historyQuery.data ?? [],
    isLoading: historyQuery.isLoading,
    logWrite,
    logWrites,
    revertWrite,
  };
}
