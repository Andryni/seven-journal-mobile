import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Link2, X, Check, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { withAlpha } from '../../theme';
import { useT } from '../../i18n';
import { Panel } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { Badge } from '../ui/Badge';
import {
  closeReasonLabel,
  type QueueCard as QueueCardData,
} from '../../features/sync/normalize';

/**
 * One pending broker trade awaiting the human decision.
 *
 * Display-only: promote / link / dismiss are callbacks from the parent. The
 * pnl-gap warning renders itself when the broker and journal amounts
 * disagree — the one case where the card speaks before being asked.
 */
export const QueueCard: React.FC<{
  card: QueueCardData;
  connectorLabel: string | null;
  closeTimeLabel: string | null;
  onPromote: () => void;
  onLink: () => void;
  onDismiss: () => void;
}> = ({ card, connectorLabel, closeTimeLabel, onPromote, onLink, onDismiss }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
        {closeTimeLabel ? ` · ${closeTimeLabel}` : ''}
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

const createStyles = (theme: AppTheme) =>
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
