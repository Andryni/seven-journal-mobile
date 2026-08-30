import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { useUIStore } from '../../store/uiStore';
import { useEffect } from 'react';
import type { DailySessionLock } from '../../types/domain';
import { localDayKey } from '../../utils/formatDate';

export function useDailyLock() {
  const queryClient = useQueryClient();
  const setDailySessionLocked = useUIStore((state) => state.setDailySessionLocked);
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

  return {
    lock,
    isLoading,
    isLocked: lock?.is_locked || false,
    lockSession: lockSessionMutation.mutateAsync,
    isLocking: lockSessionMutation.isPending,
  };
}
