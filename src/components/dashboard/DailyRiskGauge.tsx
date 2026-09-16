import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import { duration as motionDuration, easing as motionEasing } from '../../theme/motion';
import { useNotifications } from '../../features/notifications/useNotifications';
import { ShieldCheck, ShieldAlert, Shield } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { useMoney } from '../../features/accounts/useMoney';
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
  const money = useMoney();
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
    progress.value = withTiming(ratio, {
      duration: motionDuration.slow,
      easing: motionEasing.out,
    });
  }, [ratio, progress]);

  /**
   * The only looping animation in the app, and it is load-bearing: once 80% of
   * the daily allowance is gone the bar breathes so it catches the eye in
   * peripheral vision. Below that threshold it is perfectly static.
   */
  /**
   * Fire a single local notification the first time the trader crosses 70% of
   * the daily allowance — the point where the decision to stop is still theirs
   * rather than the lock's. Deduplicated per day via a ref.
   */
  const { notifyRiskThreshold, prefs: notifPrefs } = useNotifications();
  // User-set, not a constant: see NotificationPrefs.riskThresholdPct.
  const riskTrigger = Math.min(99, Math.max(10, notifPrefs.riskThresholdPct)) / 100;
  const notifiedForDay = useRef<string | null>(null);
  useEffect(() => {
    const today = new Date().toDateString();
    if (ratio >= riskTrigger && ratio < 1 && notifiedForDay.current !== today) {
      notifiedForDay.current = today;
      void notifyRiskThreshold(ratio * 100, money(limit - Math.abs(todayPnL)));
    }
    if (ratio < 0.7 && notifiedForDay.current === today) {
      notifiedForDay.current = null;
    }
  }, [ratio, limit, todayPnL, notifyRiskThreshold, riskTrigger]);

  const alarm = useSharedValue(1);
  const isDanger = ratio >= 0.8;
  useEffect(() => {
    if (isDanger) {
      alarm.value = withRepeat(
        withSequence(
          withTiming(0.55, { duration: 620, easing: motionEasing.inOut }),
          withTiming(1, { duration: 620, easing: motionEasing.inOut })
        ),
        -1,
        true
      );
    } else {
      alarm.value = withTiming(1, { duration: motionDuration.fast });
    }
  }, [isDanger, alarm]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
    opacity: alarm.value,
  }));

  if (limit <= 0) return null;

  const level: 'safe' | 'warn' | 'danger' = ratio >= 0.8 ? 'danger' : ratio >= 0.5 ? 'warn' : 'safe';
  const barColor =
    level === 'danger' ? theme.colors.red : level === 'warn' ? theme.colors.gold : theme.colors.green;
  const Icon = level === 'danger' ? ShieldAlert : level === 'warn' ? Shield : ShieldCheck;

  return (
    <Animated.View entering={FadeIn.duration(motionDuration.base)} style={styles.container}>
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
            {money(todayPnL)}
          </Text>
        </Text>
        <Text style={styles.footerText}>
          {t('lossLimitShort')}{' '}
          <Text style={styles.footerVal}>{money(limit, { showPlus: false })}</Text>
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
