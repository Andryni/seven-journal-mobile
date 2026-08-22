import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { useUIStore } from '../../store/uiStore';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n';
import type { Trade, TradingAccount } from '../../types/domain';
import { formatCurrency } from '../../utils/formatCurrency';

/** Core columns used across screens — excludes heavy screenshot URLs & bookmap text */
const TRADE_LIST_COLUMNS =
  'id, user_id, account_id, pair, direction, entry_price, exit_price, stop_loss, take_profit, size, entry_time, exit_time, pnl, r_multiple, timeframe, setup_structures, setup_fvg, setup_ob, setup_liquidity_sweep, mental_state, cookie_jar_ref, rule_40_percent, notes, result, session, created_at' as const;

/** Full columns including screenshots — only for detail modals */
const TRADE_FULL_COLUMNS = '*' as const;

/** Max trades per page (Supabase max is 1000) */
const PAGE_SIZE = 500;

export function useTrades() {
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { t } = useT();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);

  // Fetch trades — lightweight columns for list views
  const { data: trades = [], isLoading } = useQuery<Trade[]>({
    queryKey: ['trades', activeAccountId],
    queryFn: async () => {
      let query = supabase
        .from('trades')
        .select(TRADE_LIST_COLUMNS)
        .order('entry_time', { ascending: false })
        .range(0, PAGE_SIZE - 1);

      if (activeAccountId) {
        query = query.eq('account_id', activeAccountId);
      }

      const { data, error } = await query;
      if (error) throw error;
      // Cast to Trade[] — missing screenshot/bookmap columns only used in detail modal
      return (data || []) as unknown as Trade[];
    },
    staleTime: 30_000, // 30s — don't refetch on every tab switch
  });

  /** Fetch full trade data (with screenshots) for detail modal */
  const fetchTradeFull = async (tradeId: string): Promise<Trade | null> => {
    const { data, error } = await supabase
      .from('trades')
      .select(TRADE_FULL_COLUMNS)
      .eq('id', tradeId)
      .single();
    if (error) return null;
    return data;
  };

  // Helper check for daily stop losses & maximum daily loss limits
  const checkAndApplyDailyLock = async (userId: string) => {
    const todayStr = new Date().toISOString().split('T')[0];

    const { data: todayTrades, error: fetchError } = await supabase
      .from('trades')
      .select('id, account_id, pnl')
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
    fetchTradeFull,
    createTrade: createTradeMutation.mutateAsync,
    updateTrade: updateTradeMutation.mutateAsync,
    deleteTrade: deleteTradeMutation.mutateAsync,
    isCreating: createTradeMutation.isPending,
    isUpdating: updateTradeMutation.isPending,
    isDeleting: deleteTradeMutation.isPending,
  };
}
