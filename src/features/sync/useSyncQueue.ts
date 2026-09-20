import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n';
import { failureText } from './rpcError';
import { isActionable } from './normalize';
import type { SyncTradeRow } from './normalize';

/**
 * Auto-journal validation queue.
 *
 * Reads pending staging rows plus the connector statuses, and exposes typed
 * wrappers around the server RPCs. Every mutation invalidates the whole sync
 * namespace: the queue, the connectors card and the pending-count badge move
 * together, and a second device sees the change on its next focus.
 *
 * The queue is read-only by nature: trades reach the journal only through
 * promote/link, and both are server-revalidated RPCs — the hook is a thin,
 * honest client of that contract.
 */

export interface IngestAccountRow {
  id: string;
  platform: string;
  label: string;
  is_active: boolean;
  account_id: string | null;
  last_sync_at: string | null;
  last_sync_status: 'ok' | 'error' | 'empty' | null;
  last_error: string | null;
  /**
   * Broker-reported state from the v1.14 heartbeat. Null on an older EA or a
   * connector that has never beaten — which is why the reconciliation card
   * distinguishes "unknown" from "matches".
   */
  broker_balance: number | null;
  broker_equity: number | null;
  broker_currency: string | null;
  broker_state_at: string | null;
  /**
   * Which EA build the terminal reports (v1.16+), or null when it reports
   * none — which means the attached EA predates the field. Drives the app's
   * decision to promise a completion request or to ask for an upgrade; see
   * eaVersion.ts.
   */
  ea_version: string | null;
  /**
   * True when this row was read through a fallback column set, i.e. on a
   * database the latest schema.sql has not been re-run on. The newest columns
   * were never queried, so their nulls mean "not asked for", not "not
   * reported".
   */
  schema_partial?: boolean;
}

export interface StagingWithConnector extends SyncTradeRow {
  connector_label: string | null;
  routed_account_id: string | null;
  routed_account_name: string | null;
}

const QUEUE_KEY = ['sync_queue'] as const;
const CONNECTORS_KEY = ['sync_connectors'] as const;
const LINKED_ACCOUNTS_KEY = ['sync_linked_accounts'] as const;
const REQUESTS_KEY = ['sync_requests'] as const;

/**
 * Back-fill requests still waiting for the terminal, per connector.
 *
 * The chat can ask the broker for the levels it never captured, and the answer
 * only arrives at the next heartbeat — so without this count the app shows a
 * promise ("envoyé au terminal") that the trader has no way to verify, and the
 * queue for it is invisible. Reading it makes the round trip legible: N
 * requests pending here means the terminal has not answered yet.
 */
export function usePendingFillRequests(): Map<string, number> {
  const { data } = useQuery<Record<string, number>>({
    queryKey: REQUESTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_requests')
        .select('ingest_account_id')
        .eq('status', 'pending');
      // Same reasoning as useBrokerCostMap: a database that has not been
      // migrated yet (no sync_requests table) must degrade to "no request
      // waiting", never to a retry storm on a screen that works otherwise.
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) {
        counts[row.ingest_account_id] = (counts[row.ingest_account_id] ?? 0) + 1;
      }
      return counts;
    },
    staleTime: 30 * 1000,
    retry: false,
  });

  return new Map(Object.entries(data ?? {}));
}

/**
 * Journal accounts currently fed by at least one connector.
 *
 * The Accounts screen badges these as "synchronised"; a dedicated tiny query
 * keeps that screen decoupled from the queue machinery while sharing the
 * invalidation namespace.
 */
export function useSyncedAccountIds() {
  const { data } = useQuery<string[]>({
    queryKey: LINKED_ACCOUNTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sync_account_links')
        .select('trading_account_id');
      if (error) throw error;
      return Array.from(new Set((data ?? []).map((r) => r.trading_account_id)));
    },
  });
  return data ?? [];
}

export function useSyncQueue() {
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useToast();
  const { t } = useT();

  const queueQuery = useQuery<StagingWithConnector[]>({
    queryKey: QUEUE_KEY,
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('sync_trades')
        .select(
          'id, external_id, payload, is_open, open_time, close_time, status, resolution, created_at, ingest_account_id',
        )
        // stale rides along: an open position the heartbeat no longer sees
        // is a RECOVERABLE state (the bridge re-sends it on sight), not a
        // decision the user has to make — but hiding it made the queue lie
        // about what the bridge knows.
        .in('status', ['pending', 'stale'])
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;

      // One join query for labels: the queue renders connector names, and N
      // per-row lookups would be the classic waterfall. A second lookup maps
      // routed accounts to their names — once a connector is linked, the
      // account it feeds IS the human-readable provenance of a queued trade.
      const ids = Array.from(new Set((rows ?? []).map((r) => r.ingest_account_id)));
      const { data: connectors } = await supabase
        .from('sync_ingest_accounts')
        .select('id, label, account_id')
        .in('id', ids.length > 0 ? ids : ['00000000-0000-0000-0000-000000000000']);

      const routedIds = Array.from(
        new Set((connectors ?? []).map((c) => c.account_id).filter((x): x is string => !!x)),
      );
      const { data: routedAccounts } = await supabase
        .from('trading_accounts')
        .select('id, name')
        .in('id', routedIds.length > 0 ? routedIds : ['00000000-0000-0000-0000-000000000000']);

      const byId = new Map((connectors ?? []).map((c) => [c.id, c]));
      const nameById = new Map((routedAccounts ?? []).map((a) => [a.id, a.name]));
      return (rows ?? []).map((r) => {
        const c = byId.get(r.ingest_account_id);
        return {
          ...r,
          connector_label: c?.label ?? null,
          routed_account_id: c?.account_id ?? null,
          routed_account_name: c?.account_id ? nameById.get(c.account_id) ?? null : null,
        };
      });
    },
  });

  const connectorsQuery = useQuery<IngestAccountRow[]>({
    queryKey: CONNECTORS_KEY,
    queryFn: async () => {
      /**
       * Columns newest-first, one set per schema generation.
       *
       * Same reasoning as POST_RELEASE_COLUMNS for trades: a user who has not
       * run the latest schema.sql must not lose the whole connectors panel over
       * a feature they have not enabled yet. Each set falls back to the one
       * below it, and the missing columns are then filled with null — which the
       * readers already treat as "not reported yet".
       */
      const COLUMN_SETS = [
        'id, platform, label, is_active, account_id, last_sync_at, last_sync_status, last_error, broker_balance, broker_equity, broker_currency, broker_state_at, ea_version',
        // v1.14 columns only: reconciliation, no reported EA version.
        'id, platform, label, is_active, account_id, last_sync_at, last_sync_status, last_error, broker_balance, broker_equity, broker_currency, broker_state_at',
        'id, platform, label, is_active, account_id, last_sync_at, last_sync_status, last_error',
      ];

      let lastError: unknown = null;
      for (let i = 0; i < COLUMN_SETS.length; i++) {
        const { data, error } = await supabase
          .from('sync_ingest_accounts')
          .select(COLUMN_SETS[i])
          .order('created_at', { ascending: true });
        if (!error) {
          // The row shape depends on which set succeeded, so it is read as an
          // open record and closed back into IngestAccountRow below: defaults
          // first, then the row. A column a fallback set could not request
          // lands as null, which every reader already treats as "not reported
          // yet" (never as zero, never as agreement) — and schema_partial says
          // the difference between "reported nothing" and "never asked".
          const partial = i > 0;
          const rows = (data ?? []) as unknown as Record<string, unknown>[];
          return rows.map((row) => ({
            broker_balance: null,
            broker_equity: null,
            broker_currency: null,
            broker_state_at: null,
            ea_version: null,
            schema_partial: partial,
            ...row,
          } as unknown as IngestAccountRow));
        }
        lastError = error;
      }
      throw lastError;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    queryClient.invalidateQueries({ queryKey: CONNECTORS_KEY });
    queryClient.invalidateQueries({ queryKey: LINKED_ACCOUNTS_KEY });
    // Rotation invalidates the back-fill queue's meaning too: the requests
    // queued under the old secret stay queued, and the counter must not keep
    // showing them as if the terminal were about to answer.
    queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
  };

  /**
   * One place where a failed RPC becomes a toast. `failureText` is what reads
   * the reason out of whatever shape the client resolved — a PostgREST failure
   * is a PLAIN OBJECT (`{ message, details, hint, code }`), never an Error, and
   * checking `instanceof Error` is what used to leave every failure showing
   * the generic "Échec — réessayez".
   */
  const reportFailure = (err: unknown) => showError(failureText(err, t, t('syncToastError')));

  // A link flow opens a picker of manual-trade candidates for ONE staging row.
  // Declared before the queries that read it.
  const [stagingIdForMatch, setStagingIdForMatch] = useState<string | null>(null);

  // ------------------------------------------------------------------ actions

  const promoteMutation = useMutation({
    mutationFn: async (batch: { staging_id: string; overrides?: Record<string, unknown> }[]) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      const { data, error } = await supabase.rpc('promote_sync_trades', {
        p_batch: batch.map((b) => ({
          staging_id: b.staging_id,
          overrides: b.overrides ?? {},
        })),
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      showSuccess(t('syncToastPromoted').replace('{count}', String(count)));
      invalidate();
    },
    // The RPC raises precise Postgres errors (no routing account, missing
    // journal columns) — surface the server's message, not a generic one.
    onError: reportFailure,
  });

  const linkMutation = useMutation({
    mutationFn: async ({ stagingId, tradeId }: { stagingId: string; tradeId: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');
      const { error } = await supabase.rpc('link_sync_trade', {
        p_staging_id: stagingId,
        p_trade_id: tradeId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(t('syncToastLinked'));
      invalidate();
    },
    // 'staging row not pending' is the "someone already promoted it on
    // another device" case: the honest message beats a red retry loop.
    onError: reportFailure,
  });

  const dismissMutation = useMutation({
    mutationFn: async ({ stagingId, reason }: { stagingId: string; reason: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');
      const { error } = await supabase.rpc('dismiss_sync_trade', {
        p_staging_id: stagingId,
        p_reason: reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(t('syncToastDismissed'));
      invalidate();
    },
    onError: reportFailure,
  });

  const matchQuery = useQuery<{ trade_id: string; entry_time: string; pnl: number | null }[]>({
    queryKey: ['sync_match', stagingIdForMatch],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('match_candidates', {
        p_staging_id: stagingIdForMatch,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: stagingIdForMatch != null,
  });

  const createConnectorMutation = useMutation({
    mutationFn: async ({
      platform,
      label,
      accountId,
    }: {
      platform: string;
      label: string;
      accountId: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');
      const { data, error } = await supabase.rpc('create_sync_ingest_account', {
        p_platform: platform,
        p_label: label,
        p_account_id: accountId,
      });
      if (error) throw error;
      return data as { id: string; secret: string } & IngestAccountRow;
    },
    onSuccess: () => invalidate(),
    onError: reportFailure,
  });

  /**
   * Rename a connector.
   *
   * Deliberately NOT a delete + create: the row carries the routing, the queue
   * it fed and the provenance of every trade it promoted, and a label is not
   * worth any of that. The server re-checks ownership and uniqueness.
   */
  const renameConnectorMutation = useMutation({
    mutationFn: async ({ connectorId, label }: { connectorId: string; label: string }) => {
      // No row comes back, by design: the stored secret must never ride along
      // on an operation that is not about it.
      const { error } = await supabase.rpc('rename_sync_ingest_account', {
        p_id: connectorId,
        p_label: label,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(t('syncConnectorRenamed'));
      invalidate();
    },
    onError: reportFailure,
  });

  /**
   * Rotate the secret of an existing connector.
   *
   * The new secret is returned ONCE, exactly like creation — the caller shows
   * it and the server never exposes it again. Everything else about the
   * connector (id, routing, queue, provenance) is untouched, which is the whole
   * point: a leaked credential used to force a deletion.
   */
  const rotateSecretMutation = useMutation({
    mutationFn: async (connectorId: string) => {
      const { data, error } = await supabase.rpc('rotate_sync_ingest_secret', {
        p_id: connectorId,
      });
      if (error) throw error;
      return data as { secret: string } & IngestAccountRow;
    },
    onSuccess: () => {
      showSuccess(t('syncConnectorSecretRotated'));
      invalidate();
    },
    onError: reportFailure,
  });

  /** Pause or resume a feed without losing its history or its routing. */
  const setActiveMutation = useMutation({
    mutationFn: async ({ connectorId, isActive }: { connectorId: string; isActive: boolean }) => {
      const { error } = await supabase.rpc('set_sync_ingest_active', {
        p_id: connectorId,
        p_is_active: isActive,
      });
      if (error) throw error;
    },
    onSuccess: (_row, { isActive }) => {
      showSuccess(isActive ? t('syncConnectorResumed') : t('syncConnectorPausedToast'));
      invalidate();
    },
    onError: reportFailure,
  });

  /**
   * One transaction, one call.
   *
   * The batch is atomic by design, which is also its weakness: a single row the
   * server refuses (a close reason its check constraint predates, a connector
   * with no linked journal account) aborts the WHOLE batch, so ten promotable
   * trades stay stuck behind one that cannot be. One call per row is the
   * fallback, never the default.
   */
  const promoteBatch = async (ids: string[]): Promise<number> => {
    const { data, error } = await supabase.rpc('promote_sync_trades', {
      p_batch: ids.map((id) => ({ staging_id: id, overrides: {} })),
    });
    if (error) throw error;
    return (data as number) ?? 0;
  };

  // Bulk actions over the whole pending queue (promotion routes each row
  // through its connector's linked account, so one tap empties a full
  // import). dismissAll maps every row through the same server enum. Both
  // ignore rows that already produced a journal trade: promoting one would
  // duplicate it, and dismissing one would strand the trade the broker still
  // has to close.
  const promoteAllMutation = useMutation({
    mutationFn: async () => {
      const rows = (queueQuery.data ?? []).filter(isActionable);
      if (rows.length === 0) return { promoted: 0, reason: null as string | null };
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t('syncErrAuth'));

      try {
        return { promoted: await promoteBatch(rows.map((r) => r.id)), reason: null };
      } catch (batchError) {
        let promoted = 0;
        let firstError: unknown = null;
        for (const row of rows) {
          try {
            promoted += await promoteBatch([row.id]);
          } catch (err) {
            if (firstError === null) firstError = err;
          }
        }
        // Nothing landed: the reason stands on its own, as a plain failure.
        if (promoted === 0) throw firstError ?? batchError;
        return {
          promoted,
          reason: failureText(firstError ?? batchError, t, t('syncToastError')),
        };
      }
    },
    onSuccess: ({ promoted, reason }) => {
      if (reason) {
        // One toast, not two: the container stacks them on the same strip, and
        // "3 promoted, the rest failed — <why>" is the one sentence to read.
        showError(`${t('syncToastPartial', String(promoted))} — ${reason}`);
      } else if (promoted > 0) {
        showSuccess(t('syncToastPromoted').replace('{count}', String(promoted)));
      }
      invalidate();
    },
    onError: reportFailure,
  });

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const rows = (queueQuery.data ?? []).filter(isActionable);
      if (rows.length === 0) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');
      // dismiss_sync_TRADES takes an uuid[] — the singular RPC used here
      // before coerced the array to a string and rejected every id, so the
      // bulk dismiss could only ever fail.
      const { error } = await supabase.rpc('dismiss_sync_trades', {
        p_staging_ids: rows.map((r) => r.id),
        p_reason: 'duplicate',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(t('syncToastDismissed'));
      invalidate();
    },
    onError: reportFailure,
  });

  const setRoutingMutation = useMutation({
    mutationFn: async ({
      syncIngestAccountId,
      tradingAccountId,
    }: {
      syncIngestAccountId: string;
      tradingAccountId: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');
      const { error } = await supabase.rpc('set_sync_routing', {
        p_sync_ingest_account_id: syncIngestAccountId,
        p_trading_account_id: tradingAccountId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      showSuccess(t('syncRoutingDone'));
      invalidate();
    },
    onError: reportFailure,
  });

  return {
    queue: queueQuery.data ?? [],
    isLoadingQueue: queueQuery.isLoading,
    connectors: connectorsQuery.data ?? [],
    isLoadingConnectors: connectorsQuery.isLoading,
    promote: promoteMutation.mutate,
    promoteAsync: promoteMutation.mutateAsync,
    isPromoting: promoteMutation.isPending,
    link: linkMutation.mutate,
    isLinking: linkMutation.isPending,
    dismiss: dismissMutation.mutate,
    isDismissing: dismissMutation.isPending,
    candidates: matchQuery.data ?? [],
    isLoadingCandidates: matchQuery.isLoading,
    openMatch: setStagingIdForMatch,
    closeMatch: () => setStagingIdForMatch(null),
    matchingStagingId: stagingIdForMatch,
    createConnector: createConnectorMutation.mutateAsync,
    isCreatingConnector: createConnectorMutation.isPending,
    setRouting: setRoutingMutation.mutate,
    isSettingRouting: setRoutingMutation.isPending,
    renameConnector: renameConnectorMutation.mutateAsync,
    isRenamingConnector: renameConnectorMutation.isPending,
    rotateConnectorSecret: rotateSecretMutation.mutateAsync,
    isRotatingSecret: rotateSecretMutation.isPending,
    setConnectorActive: setActiveMutation.mutate,
    isSettingConnectorActive: setActiveMutation.isPending,
    promoteAll: promoteAllMutation.mutate,
    isPromotingAll: promoteAllMutation.isPending,
    dismissAll: dismissAllMutation.mutate,
    isDismissingAll: dismissAllMutation.isPending,
  };
}
