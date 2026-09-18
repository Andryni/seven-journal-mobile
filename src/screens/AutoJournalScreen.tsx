import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Share } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  RefreshCw,
  ChevronRight,
  Link2,
  X,
  Copy,
  Check,
  AlertTriangle,
  Radio,
  Inbox,
} from 'lucide-react-native';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { withAlpha } from '../theme';
import { useT, localeFor } from '../i18n';
import { Panel, Hairline } from '../components/ui/Panel';
import { PressableScale } from '../components/ui/PressableScale';
import { EmptyState } from '../components/ui/EmptyState';
import { PickerModal } from '../components/ui/PickerModal';
import { Badge } from '../components/ui/Badge';
import { useSyncQueue } from '../features/sync/useSyncQueue';
import {
  closeReasonLabel,
  toQueueCard,
  type QueueCard,
} from '../features/sync/normalize';

/**
 * Auto-journal — broker trades queue up here before entering the journal.
 *
 * The screen is deliberately dumb: every rule lives server-side (dedupe,
 * matching, promotion), every projection in normalize.ts. The human decides;
 * the app just makes the decision take one tap.
 */

const WS_URL = 'https://VOTRE-PROJET.supabase.co/functions/v1/sync-ingest';

const PLATFORM_LABELS: Record<string, string> = {
  mt5_ea: 'MT5 (EA)',
  mt4_ea: 'MT4 (EA)',
  csv_mt5: 'CSV MT5',
  csv_generic: 'CSV',
  ctrader: 'cTrader',
  manual_api: 'API',
};

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
  } = useSyncQueue();

  // Setup sheet for a freshly created connector (secret shown exactly once).
  const [setup, setSetup] = useState<{ secret: string; label: string } | null>(null);
  const [dismissTarget, setDismissTarget] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const intl = new Intl.DateTimeFormat(localeFor(lang), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const addConnector = async () => {
    try {
      const created = await createConnector({
        platform: 'mt5_ea',
        label: `MT5 #${connectors.length + 1}`,
        accountId: null,
      });
      if (created?.secret) setSetup({ secret: created.secret, label: created.label });
    } catch {
      // toast already shown by the hook
    }
  };

  const copySecret = async () => {
    if (!setup) return;
    try {
      await Share.share({ message: `${WS_URL}\n${setup.secret}` });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // share cancelled
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ------------------------------------------------ connecteurs ------- */}
      <Text style={styles.sectionTitle}>{t('syncConnectorsTitle')}</Text>
      <Panel flush>
        {connectors.length === 0 ? (
          <View style={styles.noConnectors}>
            <Text style={styles.noConnectorsText}>{t('syncNoConnectors')}</Text>
          </View>
        ) : (
          connectors.map((c, i) => {
            const statusColor =
              c.last_sync_status === 'ok'
                ? theme.colors.green
                : c.last_sync_status === 'error'
                  ? theme.colors.red
                  : theme.colors.textMuted;
            const statusLabel =
              c.last_sync_status === 'ok'
                ? t('syncConnectorStatusOk')
                : c.last_sync_status === 'error'
                  ? t('syncConnectorStatusError')
                  : c.last_sync_status === 'empty'
                    ? t('syncConnectorStatusEmpty')
                    : t('syncConnectorNever');
            return (
              <React.Fragment key={c.id}>
                <View style={styles.connectorRow}>
                  <View style={styles.connectorStatus}>
                    <Radio size={15} color={statusColor} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.connectorLabel}>{c.label}</Text>
                    <Text style={styles.connectorSub}>
                      {c.last_sync_at
                      ? t('syncConnectorLastSync', intl.format(new Date(c.last_sync_at)))
                        : statusLabel}
                    </Text>
                  </View>
                  <Badge
                    label={t('syncConnectorPlatform', PLATFORM_LABELS[c.platform] ?? c.platform)}
                    variant="neutral"
                  />
                </View>
                {i < connectors.length - 1 ? <Hairline inset={48} /> : null}
              </React.Fragment>
            );
          })
        )}
        <PressableScale style={styles.addBtn} onPress={addConnector} accessibilityLabel={t('syncAddConnector')}>
          <RefreshCw size={14} color={theme.colors.primary} strokeWidth={2} />
          <Text style={styles.addBtnText}>{t('syncAddConnector')}</Text>
        </PressableScale>
      </Panel>

      {/* ---------------------------------------------------- file ---------- */}
      <Text style={styles.sectionTitle}>{t('syncQueueTitle')}</Text>
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
                <QueueCardView
                  card={card}
                  connectorLabel={row.connector_label}
                  onCloseTime={card.closeTime ? intl.format(new Date(card.closeTime)) : null}
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

      {setup ? (
        <SetupSheet
          label={setup.label}
          secret={setup.secret}
          copied={copied}
          onCopy={copySecret}
          onDone={() => setSetup(null)}
        />
      ) : null}
    </ScrollView>
  );
};

/* --------------------------------------------------------------- carte ---- */

const QueueCardView: React.FC<{
  card: QueueCard;
  connectorLabel: string | null;
  onCloseTime: string | null;
  onPromote: () => void;
  onLink: () => void;
  onDismiss: () => void;
}> = ({ card, connectorLabel, onCloseTime, onPromote, onLink, onDismiss }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => cardStyles(theme), [theme]);
  const dirColor = card.direction === 'BUY' ? theme.colors.green : theme.colors.red;
  const pnlColor =
    card.pnl == null ? theme.colors.textMuted : card.pnl >= 0 ? theme.colors.green : theme.colors.red;

  return (
    <Panel>
      <View style={styles.head}>
        <View style={[styles.dirBadge, { backgroundColor: withAlpha(dirColor, 0.15) }]}>
          <Text style={[styles.dirText, { color: dirColor }]}>{card.direction}</Text>
        </View>
        <Text style={styles.symbol}>{card.symbol}</Text>
        {card.isOpen ? (
          <Badge label={t('syncOpenBadge')} variant="neutral" />
        ) : card.closeReason ? (
          <Badge
            label={t('syncExitBadge', t(closeReasonLabel(card.closeReason)))}
            variant="neutral"
          />
        ) : null}
        <View style={{ flex: 1 }} />
        <Text style={[styles.pnl, { color: pnlColor }]}>
          {card.pnl == null ? '—' : `${card.pnl >= 0 ? '+' : ''}${card.pnl.toFixed(2)}`}
        </Text>
      </View>

      <Text style={styles.meta}>
        {connectorLabel ? `${connectorLabel} · ` : ''}
        {card.size != null ? `${card.size} @ ${card.entryPrice ?? '—'}` : ''}
        {onCloseTime ? ` · ${onCloseTime}` : ''}
      </Text>

      {card.pnlGap != null && card.pnlGap > 0.01 ? (
        <View style={styles.gapRow}>
          <AlertTriangle size={12} color={theme.colors.gold} strokeWidth={2} />
          <Text style={styles.gapText}>{t('syncGapWarn', card.pnlGap.toFixed(2))}</Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <PressableScale style={[styles.actionBtn, styles.promoteBtn]} onPress={onPromote}>
          <Check size={13} color={theme.colors.background} strokeWidth={2.5} />
          <Text style={[styles.actionText, styles.promoteText]}>{t('syncPromote')}</Text>
        </PressableScale>
        <PressableScale style={styles.actionBtn} onPress={onLink}>
          <Link2 size={13} color={theme.colors.textPrimary} strokeWidth={2} />
          <Text style={styles.actionText}>{t('syncLink')}</Text>
        </PressableScale>
        <PressableScale style={styles.actionBtn} onPress={onDismiss}>
          <X size={13} color={theme.colors.redLight} strokeWidth={2} />
          <Text style={[styles.actionText, styles.dismissText]}>{t('syncDismiss')}</Text>
        </PressableScale>
      </View>
    </Panel>
  );
};

/* --------------------------------------------------------- setup sheet ---- */

const SetupSheet: React.FC<{
  label: string;
  secret: string;
  copied: boolean;
  onCopy: () => void;
  onDone: () => void;
}> = ({ label, secret, copied, onCopy, onDone }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => setupStyles(theme), [theme]);

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <Text style={styles.title}>{t('syncSetupTitle')}</Text>
        <Text style={styles.sub}>
          {label} — {t('syncSetupSub')}
        </Text>

        <Text style={styles.fieldLabel}>{t('syncSetupUrl')}</Text>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {WS_URL}
          </Text>
        </View>

        <Text style={styles.fieldLabel}>{t('syncSetupSecret')}</Text>
        <PressableScale style={styles.fieldBox} onPress={onCopy}>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {secret}
          </Text>
          {copied ? (
            <Check size={15} color={theme.colors.green} strokeWidth={2.5} />
          ) : (
            <Copy size={15} color={theme.colors.textMuted} strokeWidth={2} />
          )}
        </PressableScale>
        <Text style={styles.note}>{t('syncSetupSecretNote')}</Text>

        <View style={styles.guide}>
          <Text style={styles.guideTitle}>{t('syncSetupGuideTitle')}</Text>
          <Text style={styles.guideStep}>{t('syncSetupGuideStep1')}</Text>
          <Text style={styles.guideStep}>{t('syncSetupGuideStep2')}</Text>
          <Text style={styles.guideStep}>{t('syncSetupGuideStep3')}</Text>
          <Text style={styles.guideStep}>{t('syncSetupGuideStep4')}</Text>
        </View>

        <PressableScale style={styles.doneBtn} onPress={onDone}>
          <ChevronRight size={14} color={theme.colors.background} strokeWidth={2.5} />
          <Text style={styles.doneText}>{t('syncDone')}</Text>
        </PressableScale>
      </View>
    </View>
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
    noConnectors: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
    noConnectorsText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
    },
    connectorRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    connectorStatus: { width: 20, alignItems: 'center' },
    connectorLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sansSemiBold,
    },
    connectorSub: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 2,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: theme.spacing.md,
      borderTopWidth: 1,
      borderTopColor: withAlpha(theme.colors.textMuted, 0.15),
    },
    addBtnText: {
      color: theme.colors.primary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
  });

const cardStyles = (theme: AppTheme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    dirBadge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 4,
    },
    dirText: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    symbol: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    pnl: {
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 6,
    },
    gapRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: theme.spacing.sm,
      backgroundColor: withAlpha(theme.colors.gold, 0.1),
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 6,
    },
    gapText: {
      color: theme.colors.goldLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      flex: 1,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.md,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 6,
      backgroundColor: withAlpha(theme.colors.textMuted, 0.12),
    },
    promoteBtn: { backgroundColor: theme.colors.primary },
    actionText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
    },
    promoteText: { color: theme.colors.background },
    dismissText: { color: theme.colors.redLight },
  });

const setupStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      inset: 0,
      backgroundColor: withAlpha(theme.colors.background, 0.9),
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.2),
      gap: 10,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontFamily: theme.fonts.sansExtraBold,
    },
    sub: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
    },
    fieldLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginTop: 6,
    },
    fieldBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.2),
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    fieldValue: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
    },
    note: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
    },
    guide: {
      backgroundColor: withAlpha(theme.colors.primary, 0.07),
      borderRadius: 8,
      padding: 12,
      gap: 4,
      marginTop: 4,
    },
    guideTitle: {
      color: theme.colors.primary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginBottom: 2,
    },
    guideStep: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
    },
    doneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      marginTop: 6,
    },
    doneText: {
      color: theme.colors.background,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  });
