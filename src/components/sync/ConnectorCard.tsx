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
  isLast: boolean;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ connector: c, linked, isLast, onPress, onLongPress }) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

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
          {c.last_sync_status === 'error' && c.last_error ? (
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
  });

/** The panel wrapping the rows plus its add button. */
export const ConnectorsPanel: React.FC<{
  connectors: IngestAccountRow[];
  linkedById: Map<string, { name: string; capital: string }>;
  onAdd: () => void;
  onConnectorPress: (id: string) => void;
  onConnectorLongPress: (label: string) => void;
}> = ({ connectors, linkedById, onAdd, onConnectorPress, onConnectorLongPress }) => {
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
        connectors.map((c, i) => (
          <ConnectorCard
            key={c.id}
            connector={c}
            linked={linkedById.get(c.id) ?? null}
            isLast={i === connectors.length - 1}
            onPress={() => onConnectorPress(c.id)}
            onLongPress={() => onConnectorLongPress(c.label)}
          />
        ))
      )}
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
