import type { Trade, TradingAccount } from '../../types/domain';

/**
 * Account scoping — pure helpers shared by Dashboard and Analytics.
 *
 * Both screens independently got this wrong in the same way: they aggregated
 * trades across every account while taking the currency symbol, the prop-firm
 * limits and the risk parameters from one arbitrary account. Centralising the
 * rules means a third screen cannot reinvent the same bug.
 */

/** Trades belonging to the selected account, or all of them when none is. */
export function scopeTrades(trades: Trade[], activeAccountId: string | null): Trade[] {
  if (!activeAccountId) return trades;
  return trades.filter(t => t.account_id === activeAccountId);
}

/** Accounts that actually have trades in the given list. */
export function accountsWithTrades(
  trades: Trade[],
  accounts: TradingAccount[]
): TradingAccount[] {
  const ids = new Set(trades.map(t => t.account_id));
  return accounts.filter(a => ids.has(a.id));
}

/**
 * True when figures combine several accounts.
 *
 * Dormant accounts do not count: owning three accounts and trading one is a
 * single-account view, and should not trigger aggregate warnings.
 */
export function isAggregateScope(
  trades: Trade[],
  accounts: TradingAccount[],
  activeAccountId: string | null
): boolean {
  if (activeAccountId) return false;
  return accountsWithTrades(trades, accounts).length > 1;
}

/**
 * True when a combined total would add different currencies together.
 *
 * Summing EUR into USD and printing one symbol produces a number that is not
 * a quantity of anything. Callers must warn instead of rendering it plainly.
 */
export function hasMixedCurrencies(
  trades: Trade[],
  accounts: TradingAccount[],
  activeAccountId: string | null
): boolean {
  if (activeAccountId) return false;
  const inScope = accountsWithTrades(trades, accounts);
  return new Set(inScope.map(a => a.currency || 'USD')).size > 1;
}
