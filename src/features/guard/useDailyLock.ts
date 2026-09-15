import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { useUIStore } from '../../store/uiStore';
import { useEffect } from 'react';
import type { DailySessionLock } from '../../types/domain';
import { localDayKey } from '../../utils/formatDate';
import { useT } from '../../i18n';
import { formatCurrency, currencySymbol } from '../../utils/formatCurrency';
import { useAccounts } from '../accounts/useAccounts';

export function useDailyLock() {
  const queryClient = useQueryClient();
  const setDailySessionLocked = useUIStore((state) => state.setDailySessionLocked);
  const { t } = useT();
  const { accounts } = useAccounts();
  // Local trading day (device timezone), consistent with checkAndApplyDailyLock
  const todayStr = localDayKey();

  const { data: lock, isLoading } = useQuery<DailySessionLock | null>({
    queryKey: ['daily_lock', todayStr],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('daily_session_locks')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', todayStr)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (lock) {
      setDailySessionLocked(lock.is_locked);
    } else {
      setDailySessionLocked(false);
    }
  }, [lock, setDailySessionLocked]);

  const lockSessionMutation = useMutation({
    mutationFn: async ({ reason, slCount }: { reason: string; slCount: number }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const { data, error } = await supabase
        .from('daily_session_locks')
        .upsert({
          user_id: user.id,
          date: todayStr,
          sl_count: slCount,
          is_locked: true,
          locked_at: new Date().toISOString(),
          lock_reason: reason,
        }, {
          onConflict: 'user_id,date'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily_lock', todayStr] });
    },
  });

  /**
   * The rule engine stores a structured code; the sentence is built here so
   * it follows the user's language. Falls back to any legacy stored string.
   */
  const lockReason = (() => {
    if (!lock) return null;
    if (lock.lock_code === 'DAILY_LOSS_LIMIT' && lock.lock_params) {
      const { account, loss, limit } = lock.lock_params;
      // The engine locks a specific account, so the amounts are in that
      // account's currency -- not necessarily dollars.
      const sym = currencySymbol(
        accounts.find(a => a.name === account)?.currency
      );
      return t(
        'lockReasonDailyLoss',
        account ?? '',
        formatCurrency(-(loss ?? 0), { symbol: sym }),
        formatCurrency(limit ?? 0, { symbol: sym })
      );
    }
    return lock.lock_reason ?? null;
  })();

  return {
    lock,
    lockReason,
    isLoading,
    isLocked: lock?.is_locked || false,
    lockSession: lockSessionMutation.mutateAsync,
    isLocking: lockSessionMutation.isPending,
  };
}
