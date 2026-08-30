import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  FadeInUp,
} from 'react-native-reanimated';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { formatCurrency } from '../../utils/formatCurrency';
import { isSameLocalDay } from '../../utils/formatDate';
import type { Trade, TradingAccount } from '../../types/domain';

interface DailyRiskGaugeProps {
  trades: Trade[];
  account: TradingAccount | null;
}

/**
 * NEW FEATURE — Daily Loss Gauge.
 * Live progress bar showing how much of today's daily-loss allowance has
 * been consumed on the active account. Colors shift green → gold → red as
 * the trader approaches the prop-firm limit, BEFORE the hard lock triggers.
 */
export const DailyRiskGauge: React.FC<DailyRiskGaugeProps> = ({ trades, account }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { todayPnL, limit, ratio } = useMemo(() => {
    const accountTrades = account
      ? trades.filter(tr => tr.account_id === account.id)
      : trades;
    const todays = accountTrades.filter(tr => isSameLocalDay(tr.entry_time));
    const pnl = todays.reduce((sum, tr) => sum + (tr.pnl || 0), 0);

    const lim =
      account?.max_daily_loss_limit && account.max_daily_loss_limit > 0
        ? account.max_daily_loss_limit
        : account?.initial_balance
          ? account.initial_balance * 0.01
          : 0;

    const r = lim > 0 && pnl < 0 ? Math.min(Math.abs(pnl) / lim, 1) : 0;
    return { todayPnL: pnl, limit: lim, ratio: r };
  }, [trades, account]);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(ratio, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [ratio, progress]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  if (limit <= 0) return null;

  const level: 'safe' | 'warn' | 'danger' = ratio >= 0.8 ? 'danger' : ratio >= 0.5 ? 'warn' : 'safe';
  const barColor =
    level === 'danger' ? theme.colors.red : level === 'warn' ? theme.colors.gold : theme.colors.green;
  const Icon = level === 'danger' ? ShieldAlert : level === 'warn' ? Shield : ShieldCheck;

  return (
    <Animated.View entering={FadeInUp.duration(420).springify().damping(16)} style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.labelRow}>
          <Icon size={13} color={barColor} />
          <Text style={styles.label}>{t('dailyRiskGauge')}</Text>
        </View>
        <Text style={[styles.pct, { color: barColor }]}>
          {(ratio * 100).toFixed(0)}%
        </Text>
      </View>

      <View style={styles.track}>
        <Animated.View style={[styles.fill, fillStyle, { backgroundColor: barColor }]} />
        {/* 80% danger threshold marker */}
        <View style={[styles.threshold, { left: '80%' }]} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>
          {t('todayPnlShort')}{' '}
          <Text style={[styles.footerVal, { color: todayPnL >= 0 ? theme.colors.greenLight : theme.colors.redLight }]}>
            {formatCurrency(todayPnL)}
          </Text>
        </Text>
        <Text style={styles.footerText}>
          {t('lossLimitShort')}{' '}
          <Text style={styles.footerVal}>{formatCurrency(limit, { showPlus: false })}</Text>
        </Text>
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.sm,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    pct: {
      fontSize: 12,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    track: {
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.surface,
      overflow: 'hidden',
      position: 'relative',
    },
    fill: {
      height: '100%',
      borderRadius: 4,
    },
    threshold: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: theme.colors.redGlow,
    },
    footerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    footerText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.sansMedium,
    },
    footerVal: {
      fontFamily: theme.fonts.monoBold,
      color: theme.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
  });
