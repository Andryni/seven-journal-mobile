import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { withAlpha } from '../../theme';
import { useT, localeFor } from '../../i18n';
import { Panel, Hairline } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { PlatformBadge } from './PlatformBadge';
import { formatDuration } from '../../utils/formatDate';
import { connectorHealth, silenceMs } from '../../features/sync/connectorHealth';
import { eaSupport, eaVersionLabel } from '../../features/sync/eaVersion';
import type { IngestAccountRow } from '../../features/sync/useSyncQueue';

/**
 * One connector row of the auto-journal screen.
 *
 * Display-only: the parent owns the actions (tap = routing, long-press =
 * setup sheet) and hands the linked account down — the card decides how a
 * connector presents itself. Once a journal account is wired, it IS the
 * connector's identity: name and capital replace the technical label.
 */
export const ConnectorCard: React.FC<{
  connector: IngestAccountRow;
  linked: { name: string; capital: string } | null;
  /** Back-fill requests the terminal has not answered yet. */
  pendingRequests?: number;
  isLast: boolean;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ connector: c, linked, pendingRequests = 0, isLast, onPress, onLongPress }) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  /**
   * Health, not the stored status.
   *
   * `last_sync_status` stays 'ok' forever once it is set, so a terminal that
   * died on Tuesday kept a green dot and the row of a fed account with an
   * empty queue read as "the app is broken". Silence is the fact that matters,
   * and it is the one the trader can act on.
   */
  const health = connectorHealth(c);
  const silentFor = silenceMs(c);
  const silenceText =
    health === 'quiet' && silentFor !== null && Number.isFinite(silentFor)
      ? formatDuration(c.last_sync_at, new Date().toISOString(), lang)
      : null;

  /**
   * What the attached EA can do — and, when it cannot, the sentence that names
   * the fix. A completion request the terminal cannot honour is the worst kind
   * of silence: the app has already told the trader it was sent.
   */
  const support = eaSupport(c);
  const eaLabel = eaVersionLabel(c.ea_version);
  const eaNotice =
    support === 'legacy'
      ? t('syncConnectorEaTooOld', eaLabel ?? '')
      : support === 'unreported'
        ? t('syncConnectorEaUnknown')
        : support === 'partial' && pendingRequests > 0
          ? t('syncConnectorEaLiveOnly', eaLabel ?? '')
          : null;

  const statusColor =
    health === 'ok'
      ? theme.colors.green
      : health === 'error'
        ? theme.colors.red
        : health === 'quiet'
          ? theme.colors.gold
          : theme.colors.textMuted;
  const statusLabel =
    health === 'paused'
      ? t('syncConnectorPaused')
      : health === 'quiet'
        ? t('syncConnectorQuiet', silenceText ?? '')
        : c.last_sync_status === 'ok'
          ? t('syncConnectorStatusOk')
          : c.last_sync_status === 'error'
            ? t('syncConnectorStatusError')
            : c.last_sync_status === 'empty'
              ? t('syncConnectorStatusEmpty')
              : t('syncConnectorNever');

  const title = linked ? linked.name : c.label;
  const sub = linked
    ? t('syncConnectorAccountSub', linked.capital)
    : c.last_sync_at
      ? t(
          'syncConnectorLastSync',
          new Intl.DateTimeFormat(localeFor(lang), {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(c.last_sync_at)),
        )
      : statusLabel;

  return (
    <>
      <PressableScale
        style={styles.row}
        onPress={onPress}
        onLongPress={onLongPress}
        accessibilityLabel={title}
      >
        <View style={styles.avatarWrap}>
          <PlatformBadge platform={c.platform} />
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>
          {health === 'quiet' && silenceText ? (
            // The row has to say WHAT is wrong, not just stop being green: an
            // EA whose PC was rebooted is the single most common reason for an
            // empty queue, and the sentence names where to look.
            <Text style={styles.warn} numberOfLines={2}>
              {t('syncConnectorQuietHint')}
            </Text>
          ) : null}
          {eaNotice ? (
            // Gold, not red: an outdated EA still feeds the journal — it just
            // cannot answer the one request that needs a newer build.
            <Text style={styles.warn} numberOfLines={3}>
              {eaNotice}
            </Text>
          ) : null}
          {pendingRequests > 0 ? (
            // The chat's "ask the terminal for the missing levels" is a
            // promise about the FUTURE; this is the only place it becomes
            // visible, and it disappears once the terminal answers at its next
            // heartbeat.
            <Text style={styles.pending} numberOfLines={1}>
              {t('syncConnectorRequests', String(pendingRequests))}
            </Text>
          ) : null}
          {health === 'error' && c.last_error ? (
            // A connector that pushes but gets rejected must SAY why on the
            // row itself: buried in a status dot, "error" reads as broken
            // app, not as a rejected batch the terminal can fix.
            <Text style={styles.err} numberOfLines={1}>
              {c.last_error}
            </Text>
          ) : null}
        </View>
        <Text style={styles.platformHint}>
          {t('syncConnectorPlatform',
            c.platform === 'ctrader' ? 'cTrader' :
            c.platform.startsWith('mt5') ? 'MT5' :
            c.platform.startsWith('mt4') ? 'MT4' :
            c.platform.startsWith('csv') ? 'CSV' : 'API')}
          {/* Which build is attached, on the row itself: it is the one fact that
              decides whether a completion request can be answered. */}
          {eaLabel ? ` · ${eaLabel}` : ''}
          {/* And WHO is attached (EA v1.18+). The label above is chosen by the
              trader and can drift; the login is the terminal's own identity.
              On a v1.17 or older build it is absent — the same honest absence
              as the version, not a zero and not a guess. */}
          {c.broker_login ? ` · ${t('syncConnectorLogin', c.broker_login)}` : ''}
        </Text>
      </PressableScale>
      {!isLast ? <Hairline inset={48} /> : null}
    </>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    avatarWrap: { position: 'relative' as const },
    dot: {
      position: 'absolute' as const,
      right: -2,
      bottom: -2,
      width: 10,
      height: 10,
      borderRadius: 5,
      borderWidth: 2,
      borderColor: theme.colors.surface,
    },
    platformHint: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      textTransform: 'uppercase' as const,
    },
    label: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sansSemiBold,
    },
    sub: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 2,
    },
    err: {
      color: theme.colors.red,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 2,
    },
    warn: {
      color: theme.colors.goldLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 2,
    },
    pending: {
      color: theme.colors.primaryLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      marginTop: 2,
    },
  });

/** The panel wrapping the rows plus its add button. */
export const ConnectorsPanel: React.FC<{
  connectors: IngestAccountRow[];
  linkedById: Map<string, { name: string; capital: string }>;
  pendingRequestsById: Map<string, number>;
  onAdd: () => void;
  onConnectorPress: (id: string) => void;
  /** Long press opens the manage sheet for that connector id. */
  onConnectorLongPress: (id: string) => void;
}> = ({
  connectors,
  linkedById,
  pendingRequestsById,
  onAdd,
  onConnectorPress,
  onConnectorLongPress,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => panelStyles(theme), [theme]);

  return (
    <Panel flush>
      {connectors.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('syncNoConnectors')}</Text>
        </View>
      ) : (
        <Text style={styles.pressHint}>{t('syncConnectorPressHint')}</Text>
      )}
      {connectors.map((c, i) => (
        <ConnectorCard
          key={c.id}
          connector={c}
          linked={linkedById.get(c.id) ?? null}
          pendingRequests={pendingRequestsById.get(c.id) ?? 0}
          isLast={i === connectors.length - 1}
          onPress={() => onConnectorPress(c.id)}
          onLongPress={() => onConnectorLongPress(c.id)}
        />
      ))}
      <PressableScale style={styles.addBtn} onPress={onAdd} accessibilityLabel={t('syncAddConnector')}>
        <RefreshCw size={14} color={theme.colors.primary} strokeWidth={2} />
        <Text style={styles.addBtnText}>{t('syncAddConnector')}</Text>
      </PressableScale>
    </Panel>
  );
};

const panelStyles = (theme: AppTheme) =>
  StyleSheet.create({
    empty: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md },
    pressHint: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
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
