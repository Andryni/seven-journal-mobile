import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import type { PerformanceMetrics } from '../../features/dashboard/usePerformanceMetrics';

/**
 * Executive summary — the dashboard's opening brief, three lines.
 *
 * The hero gives the number; this gives the sentence. Where I stand (net, win
 * rate, volume), what works (the streak or the consistency), what bleeds (the
 * drawdown or the losing stretch) — the three questions a trader asks before
 * scrolling anywhere. Every input is already computed by
 * usePerformanceMetrics; this card only chooses which fact leads the line.
 *
 * Rendered only for a journal with closed trades: an empty cockpit needs a
 * hero and a guard, not a brief about nothing.
 */
export const ExecutiveSummaryCard: React.FC<{
  metrics: PerformanceMetrics;
  formatMoney: (n: number) => string;
}> = ({ metrics, formatMoney }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const lines = useMemo(() => {
    const fmtR = (r: number) => `${r >= 0 ? '+' : ''}${r.toFixed(1)}R`;

    // Line 1 — where I stand.
    const standing = t('execStanding', {
      pnl: formatMoney(metrics.netPnL),
      wr: `${Math.round(metrics.winRate)}%`,
      n: String(metrics.closedTrades),
    });

    // Line 2 — what works. A live streak beats an abstract score when there
    // is one to show; consistency is the fallback that is always true.
    const streak = metrics.streak;
    const unitKey =
      streak.type === 'win'
        ? streak.current > 1
          ? 'execDaysGreenPlural'
          : 'execDaysGreen'
        : streak.current > 1
          ? 'execDaysRedPlural'
          : 'execDaysRed';
    const works = streak.current >= 2
      ? t('execStreak', {
          n: String(streak.current),
          unit: t(unitKey),
          pnl: fmtR(metrics.avgRMultiple),
        })
      : t('execConsistency', { score: String(metrics.consistency.score) });

    // Line 3 — what bleeds. A losing streak currently running outranks the
    // historical drawdown: it is actionable today.
    const bleeds =
      streak.type === 'loss' && streak.current >= 2
        ? t('execLosingStreak', { n: String(streak.current) })
        : t('execDrawdown', { pnl: formatMoney(metrics.maxDrawdown) });

    return { standing, works, bleeds };
  }, [metrics, t, formatMoney]);

  if (metrics.closedTrades === 0) return null;

  return (
    <View style={styles.card}>
      <View style={[styles.rail, { backgroundColor: theme.colors.primary }]} />
      <View style={styles.body}>
        <Text style={styles.line}>
          <Text style={styles.marker}>{'▸ '}</Text>
          {lines.standing}
        </Text>
        <Text style={[styles.line, { color: theme.colors.green }]}>
          <Text style={styles.marker}>{'▸ '}</Text>
          {lines.works}
        </Text>
        <Text style={[styles.line, { color: theme.colors.red }]}>
          <Text style={styles.marker}>{'▸ '}</Text>
          {lines.bleeds}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
    },
    rail: { width: 2 },
    body: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      gap: 6,
    },
    line: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sansSemiBold,
      lineHeight: 17,
    },
    marker: {
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.monoBold,
    },
  });
