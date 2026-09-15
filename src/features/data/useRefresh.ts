import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Pull-to-refresh, shared by every screen that shows server data.
 *
 * Two problems this replaces. Only Trades and Accounts had a RefreshControl at
 * all, so on the Dashboard, Calendar, Analytics and Playbook the only way to
 * see a change made on another device was to kill the app. And the two that
 * did have one invalidated a single query key, so pulling on the trades list
 * left the account balances and the day's lock state stale underneath it --
 * the screen looked refreshed while half of it was not.
 *
 * Every refresh now invalidates the whole server cache. These are small,
 * per-user tables; the correctness of showing one consistent picture is worth
 * far more than the handful of requests saved by being clever about which key
 * changed.
 */
export function useRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      /**
       * refetchType 'active' refetches what is mounted right now and marks the
       * rest stale, so a screen the user has not opened yet does not fire a
       * request it may never need -- it just will not serve a stale value when
       * they get there.
       */
      await queryClient.invalidateQueries({ refetchType: 'active' });
    } catch (err) {
      // A failed refresh must not leave the spinner turning forever.
      console.warn('refresh failed', err);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient]);

  return { refreshing, onRefresh };
}
