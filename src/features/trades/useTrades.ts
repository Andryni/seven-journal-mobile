import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { useUIStore } from '../../store/uiStore';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n';
import type { Trade, TradingAccount } from '../../types/domain';
import { formatCurrency } from '../../utils/formatCurrency';

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

  // Helper check for daily stop losses & maximum daily loss limits
  const checkAndApplyDailyLock = async (userId: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    const { data: todayTrades, error: fetchError } = await supabase
      .from('trades')
      .select('*')
      .eq('user_id', userId)
      .gte('entry_time', `${todayStr}T00:00:00Z`);

    const { data: accounts } = await supabase
      .from('trading_accounts')
      .select('*')
      .eq('user_id', userId);

    if (!fetchError && todayTrades && accounts) {
      let dailyLossExceeded = false;
      let exceededAccountName = '';
      let exceededAmount = 0;
      let limitAmount = 0;

      for (const acc of (accounts as TradingAccount[])) {
        const effectiveLimitUsd = (acc.max_daily_loss_limit !== null && acc.max_daily_loss_limit !== undefined && acc.max_daily_loss_limit > 0)
          ? acc.max_daily_loss_limit
          : (acc.initial_balance ? acc.initial_balance * 0.01 : 1000);

        const accTodayTrades = (todayTrades as Trade[]).filter((t: Trade) => t.account_id === acc.id);
        const todayPnl = accTodayTrades.reduce((sum: number, t: Trade) => sum + (t.pnl || 0), 0);
        
        if (todayPnl < 0 && Math.abs(todayPnl) >= effectiveLimitUsd) {
          dailyLossExceeded = true;
          exceededAccountName = acc.name;
          exceededAmount = Math.abs(todayPnl);
          limitAmount = effectiveLimitUsd;
          break;
        }
      }

      if (dailyLossExceeded) {
        const reason = `Limite de perte quotidienne ($ / %) atteinte sur ${exceededAccountName} (${formatCurrency(-exceededAmount)} / max ${formatCurrency(limitAmount)}). Session verrouillée.`;

        await supabase.from('daily_session_locks').upsert({
          user_id: userId,
          date: todayStr,
          sl_count: (todayTrades as Trade[]).filter((t: Trade) => (t.pnl || 0) < 0).length,
          is_locked: true,
          locked_at: new Date().toISOString(),
          lock_reason: reason,
        }, {
          onConflict: 'user_id,date'
        });
        
        queryClient.invalidateQueries({ queryKey: ['daily_lock', todayStr] });
      }
    }
  };

  // Create trade mutation
  const createTradeMutation = useMutation({
    mutationFn: async (newTrade: Omit<Trade, 'id' | 'user_id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const payload = {
        ...newTrade,
        user_id: user.id,
      };

      const { data, error } = await supabase
        .from('trades')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;

      await checkAndApplyDailyLock(user.id);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
      showSuccess(t('toastTradeCreated'));
    },
    onError: () => {
      showError(t('toastErrorCreate'));
    },
  });

  // Update trade mutation
  const updateTradeMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Trade> & { id: string }) => {
      const { data, error } = await supabase
        .from('trades')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await checkAndApplyDailyLock(user.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
      showSuccess(t('toastTradeUpdated'));
    },
    onError: () => {
      showError(t('toastErrorUpdate'));
    },
  });

  // Delete trade mutation
  const deleteTradeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('trades')
        .delete()
        .eq('id', id);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await checkAndApplyDailyLock(user.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trades'] });
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
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
