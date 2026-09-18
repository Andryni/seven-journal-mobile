import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Edit3, Trash2, Shield, Target } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { withAlpha } from '../../theme';
import { accountTypeLabel, useT } from '../../i18n';
import { Badge } from '../ui/Badge';
import { formatCurrency, currencySymbol } from '../../utils/formatCurrency';
import type { Trade, TradingAccount } from '../../types/domain';

/**
 * One account card of the accounts list.
 *
 * Display-only: selection, edit and delete are callbacks; the metrics grid
 * (positions / win rate / cumulative R) is computed here from the trades the
 * parent already holds, because it is the card's own presentation concern.
 *
 * The feed badge states how the account is fed — AUTO when a sync connector
 * drives it, MANUEL when trades are typed by hand — next to the "synchronisé"
 * badge, which is the live state of an actual link. Intent and state.
 */
export const AccountCard: React.FC<{
  account: TradingAccount;
  trades: Trade[];
  isActive: boolean;
  synced: boolean;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ account: item, trades, isActive, synced, onPress, onEdit, onDelete }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const isProp = item.type === 'challenge' || item.type === 'funded';

  // Account specific trades & metrics calculation
  const accountTrades = trades.filter((tr: Trade) => tr.account_id === item.id);
  const closedTrades = accountTrades.filter((tr: Trade) => tr.pnl !== null);
  const winTrades = closedTrades.filter((tr: Trade) => (tr.pnl || 0) > 0);

  const cumulativePnl = closedTrades.reduce((sum: number, tr: Trade) => sum + (tr.pnl || 0), 0);
  const computedBalance = item.initial_balance + cumulativePnl;
  const pnlPercent = item.initial_balance > 0 ? (cumulativePnl / item.initial_balance) * 100 : 0;
  const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;
  const totalR = closedTrades.reduce((sum: number, tr: Trade) => sum + (tr.r_multiple || 0), 0);

  // This is a list of accounts that may each be denominated differently,
  // so the symbol comes from the row, not from the active account.
  const sym = currencySymbol(item.currency);
  const money = (v: number, o = {}) => formatCurrency(v, { symbol: sym, ...o });

  const isAuto = item.feed_mode === 'auto';

  return (
    <TouchableOpacity
      style={[styles.accountCard, isActive && styles.selectedCard]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityState={{ selected: isActive }}
      accessibilityLabel={item.name}
    >
      {/* Card Top Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleInfo}>
          <View style={[styles.activeDot, isActive && styles.activeDotSelected]} />
          <Text style={styles.accountName} numberOfLines={1}>{item.name}</Text>
          <Badge
            label={accountTypeLabel(t, item.type)}
            variant={item.type === 'funded' ? 'green' : item.type === 'challenge' ? 'gold' : 'blue'}
            size="sm"
          />
          <Badge
            label={isAuto ? t('accountAutoBadge') : t('accountManualBadge')}
            variant={isAuto ? 'green' : 'neutral'}
            size="sm"
          />
          {item.instrument_type && (
            <Badge
              label={item.instrument_type}
              variant="neutral"
              size="sm"
            />
          )}
          {synced && (
            <Badge
              label={t('accountSyncedBadge')}
              variant="green"
              size="sm"
            />
          )}
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            onPress={onEdit}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('editAccountA11y', item.name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Edit3 color={theme.colors.textSecondary} size={14} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onDelete}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={t('deleteAccountA11y', item.name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 color={theme.colors.redLight} size={14} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary Balances Row */}
      <View style={styles.balanceRow}>
        <View>
          <Text style={styles.statLabel}>{t('currentBalance')}</Text>
          <Text style={styles.balanceValue}>
            {money(computedBalance, { showPlus: false, thousandsSeparator: true })}
          </Text>
        </View>
        <View style={styles.alignRight}>
          <Text style={styles.statLabel}>{t('cumulatedPnl')}</Text>
          <Text
            style={[
              styles.pnlValue,
              cumulativePnl >= 0 ? styles.greenText : styles.redText,
            ]}
          >
            {money(cumulativePnl)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
          </Text>
        </View>
      </View>

      {/* Multi-metric 3-box Grid (Positions, WR, Cumul R) */}
      <View style={styles.metricsGrid3}>
        <View style={styles.metricBox}>
          <Text style={styles.metricBoxLabel}>{t('positions')}</Text>
          <Text style={styles.metricBoxValue}>{closedTrades.length}</Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricBoxLabel}>{t('winRate')}</Text>
          <Text style={[styles.metricBoxValue, winRate >= 50 ? styles.greenText : styles.redText]}>
            {winRate.toFixed(0)}%
          </Text>
        </View>
        <View style={styles.metricBox}>
          <Text style={styles.metricBoxLabel}>{t('cumulR')}</Text>
          <Text style={[styles.metricBoxValue, totalR >= 0 ? styles.cyanText : styles.redText]}>
            {totalR >= 0 ? '+' : ''}{totalR.toFixed(1)}R
          </Text>
        </View>
      </View>

      {/* Lock Guard & Prop Info */}
      <View style={styles.footerRow}>
        <View style={styles.lockRuleBox}>
          <Shield color={theme.colors.goldLight} size={11} />
          <Text style={styles.lockRuleText}>
            {t('maxLossPerDay')} : {money(item.max_daily_loss_limit ?? item.initial_balance * 0.01, { showPlus: false, decimals: 0 })}
          </Text>
        </View>

        {isProp && item.profit_target && (
          <View style={styles.targetRuleBox}>
            <Target color={theme.colors.greenLight} size={11} />
            <Text style={styles.targetRuleText}>
              {t('target')} : {money(item.profit_target, { showPlus: false, decimals: 0, thousandsSeparator: true })}
            </Text>
          </View>
        )}

        <View style={styles.initialCapBox}>
          <Text style={styles.initialCapText}>
            {t('cap')}: {money(item.initial_balance, { showPlus: false, decimals: 0, thousandsSeparator: true })} {item.currency}
          </Text>
        </View>
      </View>

      {/* Prop Firm Target Progress Bar */}
      {isProp && item.profit_target && item.profit_target > 0 && (
        <View style={styles.targetProgressContainer}>
          <View style={styles.targetProgressHeader}>
            <Text style={styles.targetProgressTitle}>{t('targetProgress')}</Text>
            <Text style={styles.targetProgressPercent}>
              {Math.min(100, Math.max(0, (cumulativePnl / item.profit_target!) * 100) || 0).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.min(100, Math.max(0, (cumulativePnl / item.profit_target) * 100))}%`,
                  backgroundColor: cumulativePnl >= 0 ? theme.colors.green : theme.colors.red,
                },
              ]}
            />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    accountCard: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: 16,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    selectedCard: {
      borderColor: theme.colors.primary,
      borderWidth: 1.5,
      backgroundColor: theme.colors.surface,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    titleInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
      marginRight: 6,
    },
    activeDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceLight,
    },
    activeDotSelected: {
      backgroundColor: theme.colors.green,
    },
    accountName: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontFamily: theme.fonts.sansBold,
      flexShrink: 1,
    },
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    iconBtn: {
      padding: 6,
      borderRadius: 6,
      backgroundColor: theme.colors.surface,
    },
    balanceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginVertical: 4,
    },
    statLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    balanceValue: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    pnlValue: {
      fontSize: 13,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    alignRight: {
      alignItems: 'flex-end',
    },
    metricsGrid3: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 8,
      marginBottom: 8,
    },
    metricBox: {
      flex: 1,
      backgroundColor: theme.colors.inputBg,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: 8,
      paddingVertical: 6,
      paddingHorizontal: 4,
      alignItems: 'center',
    },
    metricBoxLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    metricBoxValue: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontFamily: theme.fonts.monoExtraBold,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
      paddingTop: 8,
    },
    lockRuleBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: withAlpha(theme.colors.gold, 0.1),
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    lockRuleText: {
      color: theme.colors.goldLight,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
    },
    targetRuleBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: withAlpha(theme.colors.green, 0.1),
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
    },
    targetRuleText: {
      color: theme.colors.greenLight,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
    },
    targetProgressContainer: {
      marginTop: 8,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
    },
    targetProgressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    targetProgressTitle: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    targetProgressPercent: {
      color: theme.colors.green,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    progressBarTrack: {
      height: 5,
      backgroundColor: theme.colors.inputBg,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    initialCapBox: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 6,
      marginLeft: 'auto',
    },
    initialCapText: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    greenText: {
      color: theme.colors.green,
    },
    redText: {
      color: theme.colors.red,
    },
    cyanText: {
      color: theme.colors.cyanLight,
    },
  });
