import { QueryClient, onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import type { Mutation } from '@tanstack/react-query';

/**
 * Offline writes, for real.
 *
 * The query cache was already persisted, so reads survived a tunnel; writes
 * did not. React Query pauses a mutation when it believes the device is
 * offline — but nothing ever told it, so `retry: 3` burned through, the toast
 * went red and the trade was lost. Three missing pieces:
 *
 * 1. `onlineManager.setEventListener(NetInfo)` — the client learns the truth
 *    about connectivity and pauses mutations while offline;
 * 2. `queryClient.setMutationDefaults` — each mutation carries a `mutationKey`
 *    so its `mutationFn` is registered HERE, on the client, and survives a
 *    full app restart (the persisted mutation queue replays it);
 * 3. `pendingOfflineWrites()` — one number for the banner, so the trader sees
 *    that nothing was lost ("2 en attente de sync").
 *
 * A mutation opts in by declaring a mutationKey that has defaults registered
 * here. Everything else keeps its inline mutationFn and behaves as before.
 */

const MUTATION_DEFAULTS: Array<
  [string, (vars: never) => Promise<unknown>]
> = [];

type RegisterFn = <TVars>(
  key: string,
  fn: (vars: TVars) => Promise<unknown>
) => void;

/**
 * Register a replayable mutation. Called at module scope by each feature hook
 * BEFORE its hook definition, so a mutation queued before a kill can replay
 * after relaunch even if the hook itself has not mounted again.
 *
 * The key is a string ('create-trade'); the stored mutation's key is
 * [key, 'queue'] — the suffix distinguishes queued writes from inline ones
 * and keeps the persisted payload self-describing.
 */
export const registerReplayableMutation: RegisterFn = (key, fn) => {
  MUTATION_DEFAULTS.push([key, fn as (vars: never) => Promise<unknown>]);
};

export function applyMutationDefaults(queryClient: QueryClient): void {
  for (const [key, fn] of MUTATION_DEFAULTS) {
    queryClient.setMutationDefaults([key, 'queue'], {
      mutationFn: fn as never,
      // Network failures must not consume the queue: a replay loop is driven
      // by connectivity, not by retries. Transient Supabase errors retry a
      // little; hard 4xx errors are dropped to keep the queue draining.
      retry: 2,
      retryDelay: attempt => Math.min(1000 * 2 ** attempt, 15000),
    });
  }
}

/** Replay mutations paused while offline, once connectivity returns. */
export function resumeQueuedMutations(queryClient: QueryClient): void {
  queryClient.resumePausedMutations().catch(() => {
    // Resume failures leave the queue intact; the next reconnect retries.
  });
}

export function installOnlineManager(queryClient: QueryClient): void {
  onlineManager.setEventListener(setOnline => {
    return NetInfo.addEventListener(state => {
      setOnline(!!state.isConnected && state.isInternetReachable !== false);
      if (state.isConnected) {
        resumeQueuedMutations(queryClient);
      }
    });
  });

  // Also resume at launch: a queue persisted while offline must replay on a
  // cold start even before NetInfo fires its first event.
  resumeQueuedMutations(queryClient);
}

/**
 * Number of trade-domain writes paused by offline mode. Paused ≠ pending:
 * a pending mutation is executing right now (the banner's "syncing" state);
 * a paused one is waiting for connectivity (the queue).
 */
export function pendingOfflineWrites(mutations: Mutation[]): number {
  return mutations.filter(
    m => m.state.isPaused && m.options.mutationKey?.[1] === 'queue'
  ).length;
}

/** True when a mutation carries the replayable-marker key shape. */
export function isQueuedMutation(m: Mutation): boolean {
  return Array.isArray(m.options.mutationKey) && m.options.mutationKey[1] === 'queue';
}
