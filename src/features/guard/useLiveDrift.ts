import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { useT } from '../../i18n';
import { useNotifications } from '../notifications/useNotifications';
import { evaluateLiveDrift, type DriftAlert } from './liveDrift';
import type { SyncTradeRow } from '../sync/normalize';
import type { Trade, TradingAccount } from '../../types/domain';

/**
 * Watches the broker's open positions against the trader's own rules.
 *
 * The guard in the entry forms fires when a trade is written down, which is
 * after the position is open. This one fires while it is running -- the only
 * moment the warning can still change anything.
 *
 * Polls rather than subscribes: the bridge writes to sync_trades from an EA,
 * and a 60s poll of a handful of rows costs less complexity than a realtime
 * channel that has to survive backgrounding, token refresh and reconnection.
 * A minute is well inside the window where a warning still matters.
 */

const POLL_MS = 60 * 1000;

export function useLiveDrift(params: {
  trades: Trade[];
  account: TradingAccount | null;
  /** Off when the account is not bridge-fed: there are no live positions. */
  enabled?: boolean;
}) {
  const { trades, account, enabled = true } = params;
  const { t } = useT();
  const { notifyLiveDrift } = useNotifications();

  const active = enabled && Boolean(account);

  const { data: staging = [] } = useQuery<SyncTradeRow[]>({
    queryKey: ['live_positions', account?.id ?? null],
    enabled: active,
    refetchInterval: POLL_MS,
    staleTime: POLL_MS,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_trades')
        .select('id, external_id, payload, is_open, open_time, close_time, status, created_at')
        .eq('is_open', true)
        .limit(50);
      // A missing table (unmigrated database) must not surface as an error
      // here; the feature simply does not apply yet.
      if (error) return [];
      return (data ?? []) as SyncTradeRow[];
    },
  });

  const alert: DriftAlert | null = useMemo(
    () => (active ? evaluateLiveDrift({ trades, staging, account }) : null),
    [active, trades, staging, account]
  );

  /**
   * One notification per distinct fact.
   *
   * The key encodes the day, the rule and the count, so crossing four then
   * five trades speaks twice while a poll repeating "four" stays quiet. Held
   * in a ref rather than state: re-rendering on it would do nothing but cost
   * a render, and it must not reset when the component re-mounts mid-session.
   */
  const announced = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!alert) return;
    if (announced.current.has(alert.key)) return;
    announced.current.add(alert.key);

    const title =
      alert.code === 'MAX_TRADES_PER_DAY'
        ? t('driftTradesTitle')
        : t('driftLossesTitle');

    const body = (
      alert.code === 'MAX_TRADES_PER_DAY' ? t('driftTradesBody') : t('driftLossesBody')
    )
      .replace('{count}', String(alert.count))
      .replace('{limit}', String(alert.limit));

    void notifyLiveDrift(title, body);
  }, [alert, notifyLiveDrift, t]);

  return { alert, openCount: staging.length };
}
