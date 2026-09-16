import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  isMissingColumnError,
  withoutPostReleaseColumns,
} from './postReleaseColumns';
import { supabase } from '../../api/supabaseClient';
import { registerReplayableMutation } from '../../api/offlineQueue';
import { useUIStore } from '../../store/uiStore';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n';
import type { Trade } from '../../types/domain';
import { localDayKey } from '../../utils/formatDate';
import { hapticSuccess, hapticError } from '../../utils/haptics';

/* ── Replayable write functions ─────────────────────────────────────────────
 * Registered at module scope so a write queued offline and persisted with the
 * mutation queue still has its mutationFn after a full app restart.
 * Each takes the exact payload the UI built, so the queue replays byte-for-byte.
 */

async function insertTrade(newTrade: Omit<Trade, 'id' | 'user_id' | 'created_at'>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const payload = { ...newTrade, user_id: user.id };

  let { data, error } = await supabase
    .from('trades')
    .insert(payload)
    .select()
    .single();

  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('trades')
      .insert(withoutPostReleaseColumns(payload))
      .select()
      .single());
  }
  if (error) throw error;
  return data;
}

async function patchTrade({ id, ...updates }: Partial<Trade> & { id: string }) {
  let { data, error } = await supabase
    .from('trades')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('trades')
      .update(withoutPostReleaseColumns(updates))
      .eq('id', id)
      .select()
      .single());
  }
  if (error) throw error;
  return data;
}

async function removeTrade(id: string) {
  const { error } = await supabase.from('trades').delete().eq('id', id);
  if (error) throw error;
}

registerReplayableMutation('create-trade', insertTrade);
registerReplayableMutation('update-trade', patchTrade);
registerReplayableMutation('delete-trade', removeTrade);

export function useTrades() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { t } = useT();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);

  // Fetch trades
  const { data: trades = [], isLoading } = useQuery<Trade[]>({
    queryKey: ['trades', activeAccountId],
    queryFn: async () => {
      let query = supabase.from('trades').select('*').order('entry_time', { ascending: false });
      
      if (activeAccountId) {
        query = query.eq('account_id', activeAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  /**
   * Daily-loss enforcement now lives in Postgres (see
   * supabase/migrations/20260915_prop_firm_rule_engine.sql). The trigger runs
   * inside the same transaction as the write, so the lock cannot be bypassed
   * and we no longer refetch every account + trade on each mutation.
   * We only need to refresh the cached lock afterwards.
   */
  const refreshDailyLock = () => {
    queryClient.invalidateQueries({ queryKey: ['daily_lock', localDayKey()] });
  };

  // Create trade mutation

  const createTradeMutation = useMutation({
    // Keyed mutations take their mutationFn from the offline queue registry
    // (setMutationDefaults), so a write paused offline is replayed on reconnect
    // — and even after a full restart.
    mutationKey: ['create-trade', 'queue'],
    networkMode: 'offlineFirst',
    mutationFn: insertTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
      refreshDailyLock();
      hapticSuccess();
      showSuccess(t('toastTradeCreated'));
    },
    onError: () => {
      hapticError();
      showError(t('toastErrorCreate'));
    },
  });

  // Update trade mutation
  const updateTradeMutation = useMutation({
    mutationKey: ['update-trade', 'queue'],
    networkMode: 'offlineFirst',
    mutationFn: patchTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
      refreshDailyLock();
      hapticSuccess();
      showSuccess(t('toastTradeUpdated'));
    },
    onError: () => {
      hapticError();
      showError(t('toastErrorUpdate'));
    },
  });

  // Delete trade mutation
  const deleteTradeMutation = useMutation({
    mutationKey: ['delete-trade', 'queue'],
    networkMode: 'offlineFirst',
    mutationFn: removeTrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
      refreshDailyLock();
      showSuccess(t('toastTradeDeleted'));
    },
    onError: () => {
      showError(t('toastErrorDelete'));
    },
  });

  return {
    trades,
    isLoading,
    createTrade: createTradeMutation.mutateAsync,
    updateTrade: updateTradeMutation.mutateAsync,
    deleteTrade: deleteTradeMutation.mutateAsync,
    isCreating: createTradeMutation.isPending,
    isUpdating: updateTradeMutation.isPending,
    isDeleting: deleteTradeMutation.isPending,
  };
}
