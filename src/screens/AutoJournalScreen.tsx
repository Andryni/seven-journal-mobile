import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { X, CheckCheck, Inbox } from 'lucide-react-native';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT, localeFor } from '../i18n';
import { Panel } from '../components/ui/Panel';
import { PressableScale } from '../components/ui/PressableScale';
import { EmptyState } from '../components/ui/EmptyState';
import { PickerModal } from '../components/ui/PickerModal';
import { ConnectorsPanel } from '../components/sync/ConnectorCard';
import { QueueCard } from '../components/sync/QueueCard';
import { SetupSheet } from '../components/sync/SetupSheet';
import { useAccounts } from '../features/accounts/useAccounts';
import { formatCurrency, currencySymbol } from '../utils/formatCurrency';
import { useSyncQueue } from '../features/sync/useSyncQueue';
import { toQueueCard } from '../features/sync/normalize';

/**
 * Auto-journal — broker trades queue up here before entering the journal.
 *
 * The screen keeps only state and overlays: presentation lives in
 * components/sync (ConnectorCard, QueueCard, SetupSheet), every rule lives
 * server-side (dedupe, matching, promotion), every projection in
 * normalize.ts. The human decides; the app makes the decision one tap.
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
    promoteAll,
    isPromotingAll,
    dismissAll,
  } = useSyncQueue();
  const { accounts } = useAccounts();

  // Setup sheet for a freshly created connector (secret shown exactly once).
  const [setup, setSetup] = useState<{ secret: string; label: string } | null>(null);
  const [dismissTarget, setDismissTarget] = useState<string | null>(null);

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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ------------------------------------------------ connecteurs ------- */}
      <Text style={styles.sectionTitle}>{t('syncConnectorsTitle')}</Text>
      <ConnectorsPanel
        connectors={connectors}
        linkedById={linkedById}
        onAdd={() => setPickPlatform(true)}
        onConnectorPress={(id) => setRoutingFor(id)}
        onConnectorLongPress={(label) => setSetup({ secret: '', label })}
      />

      {/* ---------------------------------------------------- file ---------- */}
      <View style={styles.queueHeader}>
        <Text style={styles.sectionTitle}>{t('syncQueueTitle')}</Text>
        {queue.length > 1 ? (
          <View style={styles.bulkRow}>
            <PressableScale
              style={styles.bulkBtn}
              onPress={() =>
                Alert.alert(
                  t('syncBulkPromoteTitle'),
                  t('syncBulkPromoteBody', String(queue.length)),
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
              <CheckCheck size={12} color={theme.colors.green} strokeWidth={2} />
              <Text style={styles.bulkBtnText}>{t('syncBulkPromote')}</Text>
            </PressableScale>
            <PressableScale
              style={styles.bulkBtn}
              onPress={() =>
                Alert.alert(
                  t('syncBulkDismissTitle'),
                  t('syncBulkDismissBody', String(queue.length)),
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
              <X size={12} color={theme.colors.redLight} strokeWidth={2} />
              <Text style={styles.bulkBtnText}>{t('syncBulkDismiss')}</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
      {isLoadingQueue ? (
        <Panel>
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </Panel>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={<Inbox size={26} color={theme.colors.textMuted} strokeWidth={1.5} />}
          title={t('syncQueueEmptyTitle')}
          description={t('syncQueueEmptyBody')}
        />
      ) : (
        <View style={{ gap: theme.spacing.md }}>
          {queue.map((row, i) => {
            const card = toQueueCard(row);
            return (
              <Animated.View
                key={card.id}
                entering={FadeIn.delay(i * 40).duration(220)}
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
    loadingText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sans,
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
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 6,
      backgroundColor: theme.colors.inputBg,
    },
    bulkBtnText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
    },
  });
