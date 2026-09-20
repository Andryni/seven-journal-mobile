import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { X, CheckCheck, Inbox, Zap, Ban } from 'lucide-react-native';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { withAlpha } from '../theme';
import { useT, localeFor } from '../i18n';
import { Panel } from '../components/ui/Panel';
import { PressableScale } from '../components/ui/PressableScale';
import { EmptyState } from '../components/ui/EmptyState';
import { PickerModal } from '../components/ui/PickerModal';
import { SkeletonRows } from '../components/ui/Skeleton';
import { ConnectorsPanel } from '../components/sync/ConnectorCard';
import { ConnectorSheet } from '../components/sync/ConnectorSheet';
import { ReconcileCard } from '../components/sync/ReconcileCard';
import { reconcileBalance } from '../features/sync/reconcileBalance';
import { useTrades } from '../features/trades/useTrades';
import { QueueCard } from '../components/sync/QueueCard';
import { SetupSheet } from '../components/sync/SetupSheet';
import { useAccounts } from '../features/accounts/useAccounts';
import { formatCurrency, currencySymbol } from '../utils/formatCurrency';
import { usePendingFillRequests, useSyncQueue } from '../features/sync/useSyncQueue';
import { isActionable, toQueueCard } from '../features/sync/normalize';

/**
 * Auto-journal — broker trades queue up here before entering the journal.
 *
 * The screen keeps only state and overlays: presentation lives in
 * components/sync (ConnectorCard, QueueCard, SetupSheet), every rule lives
 * server-side (dedupe, matching, promotion), every projection in
 * normalize.ts. The human decides; the app makes the decision one tap.
 *
 * Motion follows the shared grammar (theme/motion): entrances are fast and
 * settling, never bouncy; cards animate in with a short stagger; the layout
 * reflows smoothly when a card is promoted or dismissed rather than the list
 * jumping. Loading renders as rows shaped like the queue itself, so the
 * screen settles into place instead of swapping a spinner for content.
 */
export const AutoJournalScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    queue,
    isLoadingQueue,
    connectors,
    promote,
    link,
    dismiss,
    candidates,
    matchingStagingId,
    openMatch,
    closeMatch,
    createConnector,
    setRouting,
    renameConnector,
    isRenamingConnector,
    rotateConnectorSecret,
    isRotatingSecret,
    setConnectorActive,
    isSettingConnectorActive,
    promoteAll,
    isPromotingAll,
    dismissAll,
  } = useSyncQueue();
  /** Terminal work still waiting to be served, per connector. */
  const pendingRequestsById = usePendingFillRequests();
  const { accounts } = useAccounts();
  const { trades } = useTrades();

  /**
   * Reconciliation, one card per connector that routes to a journal account
   * and has reported a balance. Both conditions matter: without routing there
   * is no journal side to compare, and without a broker balance there is
   * nothing to compare it to.
   */
  const reconciliations = useMemo(
    () =>
      connectors
        .filter(c => c.account_id && typeof c.broker_balance === 'number')
        .map(c => {
          const acc = accounts.find(a => a.id === c.account_id) ?? null;
          return {
            id: c.id,
            label: c.label,
            currency: c.broker_currency ?? acc?.currency ?? null,
            result: reconcileBalance({
              account: acc,
              trades: trades.filter(tr => tr.account_id === c.account_id),
              brokerBalance: c.broker_balance,
              brokerAt: c.broker_state_at,
            }),
          };
        })
        .filter(r => r.result.verdict !== 'unknown'),
    [connectors, accounts, trades]
  );

  // Setup sheet for a freshly created connector (secret shown exactly once).
  const [setup, setSetup] = useState<{ secret: string; label: string } | null>(null);
  const [dismissTarget, setDismissTarget] = useState<string | null>(null);
  /**
   * Connector being managed (long press on its row).
   *
   * The row used to open the setup sheet with an EMPTY secret — a placeholder
   * that showed a credential-shaped hole and no way to act on the connector at
   * all. Repairing a feed (a name, a leaked secret, a paused one) is what the
   * gesture should offer, so it opens the manage sheet; the secret only appears
   * there when it has just been regenerated, which is the only moment it can.
   */
  const [manageFor, setManageFor] = useState<string | null>(null);
  const manageConnector = connectors.find((c) => c.id === manageFor) ?? null;

  // Creation flow: platform -> (connector created) -> routing -> setup sheet.
  const [pickPlatform, setPickPlatform] = useState(false);
  // Routing: which journal account this connector feeds. Opened at creation
  // and on tapping a connector row; the pending handoff shows the setup sheet
  // only after the account decision so the two overlays never stack.
  const [routingFor, setRoutingFor] = useState<string | null>(null);
  const [pendingSetup, setPendingSetup] = useState<{ secret: string; label: string } | null>(null);

  const routingConnector = connectors.find((c) => c.id === routingFor) ?? null;
  const capital = (a: { initial_balance: number; currency: string }) =>
    formatCurrency(a.initial_balance, {
      symbol: currencySymbol(a.currency),
      showPlus: false,
      thousandsSeparator: true,
    });

  // Connector id -> the linked journal account's name and capital, the map
  // the connectors panel renders from.
  const linkedById = useMemo(() => {
    const byId = new Map(accounts.map((a) => [a.id, a]));
    const out = new Map<string, { name: string; capital: string }>();
    for (const c of connectors) {
      if (!c.account_id) continue;
      const a = byId.get(c.account_id);
      if (a) out.set(c.id, { name: a.name, capital: capital(a) });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectors, accounts]);

  const closeRouting = () => {
    setRoutingFor(null);
    if (pendingSetup) {
      setSetup(pendingSetup);
      setPendingSetup(null);
    }
  };

  const intl = useMemo(
    () =>
      new Intl.DateTimeFormat(localeFor(lang), {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      }),
    [lang],
  );

  // The card list mirrors the server's rule: a stale row's promote/link/dismiss
  // would all no-op server-side (every RPC guards on status = 'pending'), so
  // rendering decision buttons for it would promise an action the server
  // refuses. The stale panel above is their whole UI.
  const pendingRows = useMemo(
    () => queue.filter((r) => r.status === 'pending'),
    [queue]
  );
  // Within those rows, one that already produced a journal trade (an open
  // position waiting for its broker close) still belongs on screen — it is
  // live — but it is not WORK: it is excluded from the badge and from both
  // bulk actions, which is why the count is not simply pendingRows.length.
  const actionableCount = pendingRows.filter(isActionable).length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ----------------------------------------------- reconciliation ----- */}
      {reconciliations.map(r => (
        <ReconcileCard key={r.id} result={r.result} currency={r.currency} />
      ))}

      {/* ------------------------------------------------ connecteurs ------- */}
      <Text style={styles.sectionTitle}>{t('syncConnectorsTitle')}</Text>
      <ConnectorsPanel
        connectors={connectors}
        linkedById={linkedById}
        pendingRequestsById={pendingRequestsById}
        onAdd={() => setPickPlatform(true)}
        onConnectorPress={(id) => setRoutingFor(id)}
        onConnectorLongPress={(id) => setManageFor(id)}
      />

      {/* ---------------------------------------------------- file ---------- */}
      <View style={styles.queueHeader}>
        <View style={styles.queueTitleRow}>
          <Text style={styles.sectionTitle}>{t('syncQueueTitle')}</Text>
          {actionableCount > 0 ? (
            // The number the bulk actions act on, visible without reading a
            // single card: a queue's job is to say how much work is waiting.
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{actionableCount}</Text>
            </View>
          ) : null}
        </View>
        {actionableCount > 1 ? (
          <View style={styles.bulkRow}>
            <PressableScale
              style={[styles.bulkBtn, styles.bulkPromoteBtn]}
              onPress={() =>
                Alert.alert(
                  t('syncBulkPromoteTitle'),
                  t('syncBulkPromoteBody', String(actionableCount)),
                  [
                    { text: t('confirmNo'), style: 'cancel' },
                    {
                      text: t('syncBulkConfirm'),
                      onPress: () => promoteAll(),
                    },
                  ],
                )
              }
              disabled={isPromotingAll}
              accessibilityLabel={t('syncBulkPromoteTitle')}
            >
              <CheckCheck size={13} color={theme.colors.background} strokeWidth={2.4} />
              <Text style={styles.bulkPromoteText}>{t('syncBulkPromote')}</Text>
            </PressableScale>
            <PressableScale
              style={styles.bulkBtn}
              onPress={() =>
                Alert.alert(
                  t('syncBulkDismissTitle'),
                  t('syncBulkDismissBody', String(actionableCount)),
                  [
                    { text: t('confirmNo'), style: 'cancel' },
                    {
                      text: t('syncBulkConfirm'),
                      style: 'destructive' as const,
                      onPress: () => dismissAll(),
                    },
                  ],
                )
              }
              accessibilityLabel={t('syncBulkDismissTitle')}
            >
              <Ban size={13} color={theme.colors.redLight} strokeWidth={2} />
              <Text style={styles.bulkBtnText}>{t('syncBulkDismiss')}</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
      {/* Open positions the heartbeat no longer sees. Recoverable by design
          — the bridge re-sends them on sight — so they get a quiet note, not
          decision cards: the queue must not fake decisions the user cannot
          actually make. */}
      {queue.some((r) => r.status === 'stale') ? (
        <Panel>
          <Text style={styles.staleTitle}>{t('syncStaleTitle')}</Text>
          <Text style={styles.staleBody}>{t('syncStaleBody')}</Text>
        </Panel>
      ) : null}

      {isLoadingQueue ? (
        // Rows shaped like the queue itself: the skeleton keeps the layout
        // stable so content settles into place instead of jumping in.
        <Panel>
          <SkeletonRows rows={3} />
        </Panel>
      ) : pendingRows.length === 0 ? (
        <Animated.View entering={FadeIn.duration(220)}>
          <EmptyState
            icon={<Inbox size={26} color={theme.colors.textMuted} strokeWidth={1.5} />}
            title={t('syncQueueEmptyTitle')}
            description={t('syncQueueEmptyBody')}
          />
        </Animated.View>
      ) : (
        <View>
          {pendingRows.map((row, i) => {
            const card = toQueueCard(row);
            return (
              <Animated.View
                key={card.id}
                // Layout on the wrapper is what makes promotion/dismissal a
                // reflow instead of a jump; the entrance is the shared
                // stagger (fast, settling — the motion grammar's rule).
                layout={LinearTransition.duration(220)}
                entering={FadeInDown.delay(Math.min(i, 6) * 45).duration(240)}
                exiting={FadeOut.duration(160)}
              >
                <QueueCard
                  card={card}
                  connectorLabel={row.connector_label}
                  closeTimeLabel={card.closeTime ? intl.format(new Date(card.closeTime)) : null}
                  onPromote={() => promote([{ staging_id: card.id }])}
                  onLink={() => openMatch(card.id)}
                  onDismiss={() => setDismissTarget(card.id)}
                />
              </Animated.View>
            );
          })}
        </View>
      )}

      {/* ------------------------------------------- pickers / overlays ----- */}
      <PickerModal
        visible={matchingStagingId != null}
        title={t('syncMatchTitle')}
        items={
          candidates.length > 0
            ? candidates.map((c) => ({
                id: c.trade_id,
                label: intl.format(new Date(c.entry_time)),
                rightText: c.pnl != null ? `${c.pnl >= 0 ? '+' : ''}${c.pnl.toFixed(2)}` : '—',
              }))
            : []
        }
        selectedId={null}
        onSelect={(tradeId) => {
          if (matchingStagingId) link({ stagingId: matchingStagingId, tradeId });
          closeMatch();
        }}
        onClose={closeMatch}
      />

      <PickerModal
        visible={dismissTarget != null}
        title={t('syncDismissTitle')}
        items={[
          { id: 'not_mine', label: t('syncDismissNotMine') },
          { id: 'test', label: t('syncDismissTest') },
          { id: 'duplicate', label: t('syncDismissDuplicate') },
        ]}
        selectedId={null}
        onSelect={(reason) => {
          if (dismissTarget) dismiss({ stagingId: dismissTarget, reason });
          setDismissTarget(null);
        }}
        onClose={() => setDismissTarget(null)}
      />

      {/* ------------------------------------------------ routage ---------- */}
      <PickerModal
        visible={routingFor != null}
        title={t('syncRoutingTitle')}
        items={[
          { id: '__unlink__', label: t('syncRoutingUnlink') },
          ...accounts.map((a) => ({ id: a.id, label: a.name, rightText: capital(a) })),
        ]}
        selectedId={routingConnector?.account_id ?? null}
        onSelect={(id) => {
          const connectorId = routingFor;
          if (connectorId) {
            setRouting({
              syncIngestAccountId: connectorId,
              tradingAccountId: id === '__unlink__' ? null : id,
            });
          }
          closeRouting();
        }}
        onClose={closeRouting}
      />

      <PickerModal
        visible={pickPlatform}
        title={t('syncPickPlatformTitle')}
        items={[
          { id: 'mt5_ea', label: t('syncPlatformMT5') },
          { id: 'ctrader', label: t('syncPlatformCTrader') },
        ]}
        selectedId={null}
        onSelect={(platform) => {
          setPickPlatform(false);
          createConnector({
            platform,
            label: `${platform === 'ctrader' ? 'cTrader' : 'MT5'} #${connectors.length + 1}`,
            accountId: null,
          })
            .then((created) => {
              if (created?.secret) {
                setPendingSetup({ secret: created.secret, label: created.label });
                setRoutingFor(created.id);
              }
            })
            .catch(() => {
              /* reported by the hook */
            });
        }}
        onClose={() => setPickPlatform(false)}
      />

      {/* ------------------------------------------------- gestion -------- */}
      {manageConnector ? (
        <ConnectorSheet
          connector={manageConnector}
          otherLabels={connectors
            .filter((c) => c.id !== manageConnector.id)
            .map((c) => c.label)}
          pendingRequests={pendingRequestsById.get(manageConnector.id) ?? 0}
          isBusy={isRenamingConnector || isRotatingSecret || isSettingConnectorActive}
          onRename={(label) => {
            // The sheet stays open on failure (the hook toasts the server's
            // own reason), so the typed name is never silently lost.
            renameConnector({ connectorId: manageConnector.id, label })
              .then(() => setManageFor(null))
              .catch(() => {});
          }}
          onRotateSecret={() => {
            // A rotation hands back the new secret exactly like creation: the
            // setup sheet is the one place it can be read and copied, and it is
            // never retrievable again.
            rotateConnectorSecret(manageConnector.id)
              .then((row) => {
                setManageFor(null);
                if (row?.secret) setSetup({ secret: row.secret, label: row.label });
              })
              .catch(() => {});
          }}
          onToggleActive={() =>
            setConnectorActive({
              connectorId: manageConnector.id,
              isActive: !manageConnector.is_active,
            })
          }
          onClose={() => setManageFor(null)}
        />
      ) : null}

      {setup ? (
        <SetupSheet
          label={setup.label}
          secret={setup.secret}
          onDone={() => setSetup(null)}
        />
      ) : null}
    </ScrollView>
  );
};

/* ---------------------------------------------------------------- styles -- */

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
      gap: theme.spacing.md,
    },
    sectionTitle: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginTop: theme.spacing.sm,
    },
    queueTitleRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 8,
      flex: 1,
    },
    countBadge: {
      minWidth: 22,
      alignItems: 'center',
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.gold, 0.45),
      backgroundColor: withAlpha(theme.colors.gold, 0.1),
    },
    countText: {
      color: theme.colors.goldLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums' as const],
    },
    loadingText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sans,
    },
    staleTitle: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase' as const,
    },
    staleBody: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
      marginTop: 4,
    },
    queueHeader: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'space-between' as const,
    },
    bulkRow: { flexDirection: 'row' as const, gap: theme.spacing.sm },
    bulkBtn: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      borderRadius: 7,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    bulkPromoteBtn: {
      backgroundColor: theme.colors.primary,
      borderColor: 'transparent' as const,
    },
    bulkBtnText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    },
    bulkPromoteText: {
      color: theme.colors.background,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    },
  });
