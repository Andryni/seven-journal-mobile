import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { useToast } from '../../store/toastStore';
import { useT } from '../../i18n';
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
}

export interface StagingWithConnector extends SyncTradeRow {
  connector_label: string | null;
  routed_account_id: string | null;
  routed_account_name: string | null;
}

const QUEUE_KEY = ['sync_queue'] as const;
const CONNECTORS_KEY = ['sync_connectors'] as const;
const LINKED_ACCOUNTS_KEY = ['sync_linked_accounts'] as const;

/**
 * A database the schema.sql has not been re-run on fails the sync RPCs with
 * precise Postgres errors (unknown function, missing column, old check
 * constraint). The text itself names a SQL object, which means nothing on a
 * phone screen — the actionable version is "re-run the schema", so a match
 * appends exactly that.
 */
const SCHEMA_ISSUE_RE =
  /does not exist|schema cache|could not find the function|could not find the rpc|violates check constraint/i;

/**
 * The server's own reason for a failed RPC, or the generic fallback.
 *
 * PostgrestError extends Error, so the `raise exception` text the SQL wrote
 * ('no target account for staging …', 'staging row not pending') arrives here
 * verbatim — showing it replaces an unexplained "failed" with the one string
 * that names the cause. The SQLSTATE prefix ("P0001: ") is SQL noise on a
 * toast and is stripped.
 */
function rpcErrorText(err: unknown, fallback: string): { text: string; needsSchema: boolean } {
  if (!(err instanceof Error) || !err.message) return { text: fallback, needsSchema: false };
  const msg = err.message.replace(/^P0001:\s*/, '').trim();
  return { text: msg || fallback, needsSchema: SCHEMA_ISSUE_RE.test(msg) };
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
          'id, external_id, payload, is_open, open_time, close_time, status, created_at, ingest_account_id',
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
      const { data, error } = await supabase
        .from('sync_ingest_accounts')
        .select(
          'id, platform, label, is_active, account_id, last_sync_at, last_sync_status, last_error, broker_balance, broker_equity, broker_currency, broker_state_at',
        )
        .order('created_at', { ascending: true });

      /**
       * Retry without the v1.14 columns on an unmigrated database.
       *
       * Same reasoning as POST_RELEASE_COLUMNS for trades: a user who has not
       * run the latest schema.sql would otherwise lose the whole connectors
       * panel over a reconciliation feature they have not enabled yet.
       */
      if (error) {
        const { data: legacy, error: legacyError } = await supabase
          .from('sync_ingest_accounts')
          .select(
            'id, platform, label, is_active, account_id, last_sync_at, last_sync_status, last_error',
          )
          .order('created_at', { ascending: true });
        if (legacyError) throw legacyError;
        return (legacy ?? []).map((row) => ({
          ...row,
          broker_balance: null,
          broker_equity: null,
          broker_currency: null,
          broker_state_at: null,
        })) as IngestAccountRow[];
      }
      return data ?? [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
    queryClient.invalidateQueries({ queryKey: CONNECTORS_KEY });
    queryClient.invalidateQueries({ queryKey: LINKED_ACCOUNTS_KEY });
  };

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
    onError: (err: unknown) => {
      // The RPC raises precise Postgres errors (no routing account, missing
      // journal columns) — surface the server's message, not a generic one.
      const { text, needsSchema } = rpcErrorText(err, t('syncToastError'));
      showError(needsSchema ? `${text} — ${t('syncSchemaHint')}` : text);
    },
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
    onError: (err: unknown) => {
      // 'staging row not pending' is the "someone already promoted it on
      // another device" case: the honest message beats a red retry loop.
      const { text, needsSchema } = rpcErrorText(err, t('syncToastError'));
      showError(needsSchema ? `${text} — ${t('syncSchemaHint')}` : text);
    },
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
    onError: () => showError(t('syncToastError')),
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
    onError: () => showError(t('syncToastError')),
  });

  // Bulk actions over the whole pending queue (promotion routes each row
  // through its connector's linked account, so one tap empties a full
  // import). dismissAll maps every row through the same server enum.
  const promoteAllMutation = useMutation({
    mutationFn: async () => {
      // Only PENDING rows are promotable (the server skips the rest); stale
      // rows must not be counted into the confirmation toast.
      const rows = (queueQuery.data ?? []).filter((r) => r.status === 'pending');
      if (rows.length === 0) return 0;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');
      const { data, error } = await supabase.rpc('promote_sync_trades', {
        p_batch: rows.map((r) => ({
          staging_id: r.id,
          overrides: {},
        })),
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      showSuccess(t('syncToastPromoted').replace('{count}', String(count)));
      invalidate();
    },
    onError: (err: unknown) => {
      const { text, needsSchema } = rpcErrorText(err, t('syncToastError'));
      showError(needsSchema ? `${text} — ${t('syncSchemaHint')}` : text);
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const rows = (queueQuery.data ?? []).filter((r) => r.status === 'pending');
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
    onError: (err: unknown) => {
      const msg = err instanceof Error && err.message ? err.message : t('syncToastError');
      showError(msg);
    },
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
    onError: () => showError(t('syncToastError')),
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
    promoteAll: promoteAllMutation.mutate,
    isPromotingAll: promoteAllMutation.isPending,
    dismissAll: dismissAllMutation.mutate,
    isDismissingAll: dismissAllMutation.isPending,
  };
}
