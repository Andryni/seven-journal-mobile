import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import {
  isMissingColumnError,
  withoutPostReleaseColumns,
} from '../trades/postReleaseColumns';
import type { TradingAccount } from '../../types/domain';
import { deviceTimezone } from '../../utils/formatDate';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n';

export function useAccounts() {
  const queryClient = useQueryClient();
  const { showError } = useToast();
  const { t } = useT();

  const { data: accounts = [], isLoading } = useQuery<TradingAccount[]>({
    queryKey: ['trading_accounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trading_accounts')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  /**
   * Adopt the device timezone for accounts created before the column existed.
   *
   * They default to 'UTC', which would keep the daily-loss lock filing itself
   * under the wrong date for anyone not actually on UTC. Correct it once, in
   * the background: the value only matters to the server-side trigger, so a
   * silent failure here is not worth surfacing to the trader.
   */
  useEffect(() => {
    const tz = deviceTimezone();
    if (tz === 'UTC') return;

    const stale = accounts.filter(a => !a.timezone || a.timezone === 'UTC');
    if (stale.length === 0) return;

    let cancelled = false;
    (async () => {
      const { error } = await supabase
        .from('trading_accounts')
        .update({ timezone: tz })
        .in('id', stale.map(a => a.id));

      if (!error && !cancelled) {
        queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accounts, queryClient]);

  const createAccountMutation = useMutation({
    mutationFn: async (newAccount: Omit<TradingAccount, 'id' | 'user_id' | 'created_at'>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const payload: any = {
        name: newAccount.name,
        type: newAccount.type,
        balance: newAccount.balance,
        initial_balance: newAccount.initial_balance,
        currency: newAccount.currency,
        is_active: newAccount.is_active,
        max_daily_loss_limit: newAccount.max_daily_loss_limit,
        user_id: user.id,
        // The server groups trades into trading days to apply the daily-loss
        // lock. It must use the same day boundary the app does, which is the
        // device's local midnight -- not UTC.
        timezone: deviceTimezone(),
      };

      if (newAccount.max_drawdown_limit !== undefined && newAccount.max_drawdown_limit !== null) {
        payload.max_drawdown_limit = newAccount.max_drawdown_limit;
      }
      if (newAccount.drawdown_type) {
        payload.drawdown_type = newAccount.drawdown_type;
      }
      if (newAccount.profit_target !== undefined && newAccount.profit_target !== null) {
        payload.profit_target = newAccount.profit_target;
      }
      if (newAccount.consistency_rule_percent !== undefined && newAccount.consistency_rule_percent !== null) {
        payload.consistency_rule_percent = newAccount.consistency_rule_percent;
      }
      if (newAccount.instrument_type) {
        payload.instrument_type = newAccount.instrument_type;
      }
      if (newAccount.challenge_end_date) {
        payload.challenge_end_date = newAccount.challenge_end_date;
      }
      // Personal discipline rules. Sent only when set, so an unset rule stays
      // NULL ("no rule") rather than becoming 0, which the schema rejects.
      if (newAccount.max_trades_per_day) {
        payload.max_trades_per_day = newAccount.max_trades_per_day;
      }
      if (newAccount.max_consecutive_losses) {
        payload.max_consecutive_losses = newAccount.max_consecutive_losses;
      }
      if (newAccount.max_risk_per_trade_pct) {
        payload.max_risk_per_trade_pct = newAccount.max_risk_per_trade_pct;
      }
      if (newAccount.feed_mode) {
        payload.feed_mode = newAccount.feed_mode;
      }

      let { data, error } = await supabase
        .from('trading_accounts')
        .insert(payload)
        .select()
        .single();

      // An instance that has not run the latest schema.sql rejects the whole
      // statement; retry without the new columns so the account still saves.
      if (isMissingColumnError(error)) {
        ({ data, error } = await supabase
          .from('trading_accounts')
          .insert(withoutPostReleaseColumns(payload))
          .select()
          .single());
      }

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
    },
    onError: () => {
      showError(t('toastErrorAccountSave'));
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TradingAccount> & { id: string }) => {
      let { data, error } = await supabase
        .from('trading_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (isMissingColumnError(error)) {
        ({ data, error } = await supabase
          .from('trading_accounts')
          .update(withoutPostReleaseColumns(updates))
          .eq('id', id)
          .select()
          .single());
      }

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
    },
    onError: () => {
      showError(t('toastErrorAccountSave'));
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('trading_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
    },
    onError: () => {
      showError(t('toastErrorAccountDelete'));
    },
  });

  return {
    accounts,
    isLoading,
    createAccount: createAccountMutation.mutateAsync,
    updateAccount: updateAccountMutation.mutateAsync,
    deleteAccount: deleteAccountMutation.mutateAsync,
    isCreating: createAccountMutation.isPending,
    isUpdating: updateAccountMutation.isPending,
    isDeleting: deleteAccountMutation.isPending,
  };
}
