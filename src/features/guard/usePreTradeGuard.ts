import { useMemo } from 'react';
import type { Trade, TradingAccount } from '../../types/domain';
import { isSameLocalDay } from '../../utils/formatDate';

export type GuardStatus = 'ok' | 'warning' | 'blocked';

export interface PreTradeGuardResult {
  status: GuardStatus;
  /** Currency still riskable today before the daily loss limit is hit. */
  remaining: number;
  /** The effective daily loss limit in currency. */
  limit: number;
  /** Today's realised P&L on the account. */
  todayPnL: number;
  /** Fraction of the allowance already consumed, 0..1. */
  consumed: number;
}

/**
 * Pre-trade guard — turns the "Lock Guard sacré" principle into something the
 * trader sees BEFORE entering a position, not after the damage is done.
 *
 * `plannedRisk` is the loss the candidate trade would take at its stop. When it
 * exceeds what is left of today's allowance we surface a warning; when the
 * session is already locked we block outright.
 */
export function usePreTradeGuard(
  trades: Trade[],
  account: TradingAccount | null,
  isLocked: boolean,
  plannedRisk: number | null
): PreTradeGuardResult {
  return useMemo(() => {
    const limit =
      account?.max_daily_loss_limit && account.max_daily_loss_limit > 0
        ? account.max_daily_loss_limit
        : account?.initial_balance
        ? account.initial_balance * 0.01
        : 0;

    const scoped = account ? trades.filter(t => t.account_id === account.id) : trades;
    const todayPnL = scoped
      .filter(t => isSameLocalDay(t.entry_time))
      .reduce((sum, t) => sum + (t.pnl || 0), 0);

    // Only realised losses eat into the allowance; a green day leaves it whole.
    const used = todayPnL < 0 ? Math.abs(todayPnL) : 0;
    const remaining = Math.max(0, limit - used);
    const consumed = limit > 0 ? Math.min(1, used / limit) : 0;

    let status: GuardStatus = 'ok';
    if (isLocked || (limit > 0 && remaining <= 0)) {
      status = 'blocked';
    } else if (plannedRisk !== null && limit > 0 && plannedRisk > remaining) {
      status = 'warning';
    }

    return { status, remaining, limit, todayPnL, consumed };
  }, [trades, account, isLocked, plannedRisk]);
}
