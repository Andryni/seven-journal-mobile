import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import type { TradeExit } from '../../types/domain';

/**
 * Partial exits for one trade.
 *
 * The query is disabled without a trade id so opening the detail modal on a
 * trade that has none does not fire a pointless request.
 *
 * A missing `trade_exits` table (an instance that has not run the latest
 * schema.sql) resolves to an empty list rather than throwing: the rest of the
 * trade detail must stay readable, and exits are additive detail by design.
 */
export function useTradeExits(tradeId: string | null) {
  const queryClient = useQueryClient();
  const key = ['trade_exits', tradeId];

  const { data: exits = [], isLoading } = useQuery<TradeExit[]>({
    queryKey: key,
    enabled: !!tradeId,
    queryFn: async () => {
      if (!tradeId) return [];
      const { data, error } = await supabase
        .from('trade_exits')
        .select('*')
        .eq('trade_id', tradeId)
        .order('exit_time', { ascending: true });

      if (error) {
        // 42P01 = undefined_table, PGRST205 = table missing from the schema
        // cache. Both mean "not migrated yet", not "something went wrong".
        const code = (error as { code?: string }).code;
        if (code === '42P01' || code === 'PGRST205') return [];
        throw error;
      }
      return data ?? [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    // The trade list shows scale-out state, so it has to refresh too.
    queryClient.invalidateQueries({ queryKey: ['trades'] });
  };

  const addExit = useMutation({
    mutationFn: async (exit: Omit<TradeExit, 'id' | 'user_id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const { data, error } = await supabase
        .from('trade_exits')
        .insert({ ...exit, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteExit = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('trade_exits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    exits,
    isLoading,
    addExit: addExit.mutateAsync,
    isAdding: addExit.isPending,
    deleteExit: deleteExit.mutateAsync,
  };
}
