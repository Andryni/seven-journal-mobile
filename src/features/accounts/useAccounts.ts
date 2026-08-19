import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import type { TradingAccount } from '../../types/domain';

export function useAccounts() {
  const queryClient = useQueryClient();

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
      if ((newAccount as any).instrument_type) {
        payload.instrument_type = (newAccount as any).instrument_type;
      }

      const { data, error } = await supabase
        .from('trading_accounts')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<TradingAccount> & { id: string }) => {
      const { data, error } = await supabase
        .from('trading_accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
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
