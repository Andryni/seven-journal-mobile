import { useCallback, useMemo } from 'react';
import { useAccounts } from './useAccounts';
import { useUIStore } from '../../store/uiStore';
import { currencySymbol, formatCurrency } from '../../utils/formatCurrency';
import type { FormatCurrencyOptions } from '../../utils/formatCurrency';
import type { TradingAccount } from '../../types/domain';

export type MoneyFormatter = (amount: number, options?: FormatCurrencyOptions) => string;

/**
 * Currency formatter bound to the active account's denomination.
 *
 * Every screen used to call formatCurrency directly, which defaults to '$'.
 * Since accounts can be EUR or GBP, a funded EUR account displayed its balance,
 * its drawdown and its daily limit all in dollars. Binding the symbol once here
 * means a new display site cannot forget it.
 *
 * An explicit `symbol` in options still wins, for the rare cross-account view.
 */
export function useMoney(account?: TradingAccount | null): MoneyFormatter {
  const { accounts } = useAccounts();
  const activeAccountId = useUIStore(s => s.activeAccountId);

  const symbol = useMemo(() => {
    if (account !== undefined) return currencySymbol(account?.currency);
    const active = accounts.find(a => a.id === activeAccountId) ?? accounts[0];
    return currencySymbol(active?.currency);
  }, [account, accounts, activeAccountId]);

  return useCallback(
    (amount: number, options: FormatCurrencyOptions = {}) =>
      formatCurrency(amount, { symbol, ...options }),
    [symbol]
  );
}

/** Symbol of the active account's currency, for charts that take a prefix. */
export function useCurrencySymbol(account?: TradingAccount | null): string {
  const { accounts } = useAccounts();
  const activeAccountId = useUIStore(s => s.activeAccountId);
  return useMemo(() => {
    if (account !== undefined) return currencySymbol(account?.currency);
    const active = accounts.find(a => a.id === activeAccountId) ?? accounts[0];
    return currencySymbol(active?.currency);
  }, [account, accounts, activeAccountId]);
}
