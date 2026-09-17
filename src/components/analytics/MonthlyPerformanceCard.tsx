import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Sparkline } from '../ui/Sparkline';
import { PressableScale } from '../ui/PressableScale';
import { monthlyPnlSeries } from '../../features/analytics/periodReview';
import type { MonthPoint } from '../../features/analytics/periodReview';

/**
 * Monthly performance, as one mini curve over the journal's whole history.
 *
 * `monthlyPerformance` has been computed in usePerformanceMetrics for a long
 * time and displayed nowhere: the dashboard dropped it in the "Trading Desk"
 * rebuild, and analytics never picked it up. The bar-chart variant it was
 * designed for showed each month as an isolated column; a Sparkline over the
 * same data shows the drift — a book can post positive months and still be
 * bleeding, and only the shape says so.
 *
 * Each month stays readable as a row (label, trades, WR, P&L coloured by
 * sign), so the card answers both "which direction over time" and "which
 * month exactly". Rows carry no drill payload: `monthlyPerformance` buckets
 * on exit or entry date and the trade-list drill keys are category-based;
 * inventing a date-range payload would silently mis-filter.
 */
export const MonthlyPerformanceCard: React.FC<{
  trades: import('../../types/domain').Trade[];
  lang: 'fr' | 'en';
  formatMoney: (n: number) => string;
  /** Rendered on the header rail — typically a "view in calendar" control. */
  action?: React.ReactNode;
}> = ({ trades, lang, formatMoney, action }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const months = useMemo<MonthPoint[]>(() => {
    // from: the month before the first ever trade is enough — periodSeries
    // starts slots at `from` regardless of where trades begin.
    const to = new Date();
    return monthlyPnlSeries(trades, new Date(1970, 0, 1), to, lang);
  }, [trades, lang]);

  const values = useMemo(() => months.map(m => m.value), [months]);
  const total = useMemo(() => months.reduce((s, m) => s + m.value, 0), [months]);

  if (months.length === 0) return null;

  return (
    <Animated.View entering={FadeIn.duration(280)}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{t('monthlyPerformance')}</Text>
          {action}
        </View>

        {values.length > 1 ? (
          <View style={styles.sparkRow}>
            <Sparkline data={values} baseline={0} width={220} height={40} strokeWidth={1.8} />
            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>{t('seriesMonthlyHistoryNet')}</Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={[styles.totalValue, { color: total >= 0 ? theme.colors.green : theme.colors.red }]}
              >
                {formatMoney(total)}
              </Text>
              <Text style={styles.totalMeta}>{t('seriesMonthlyHistoryTrades', String(months.reduce((s, m) => s + m.trades, 0)))}</Text>
            </View>
          </View>
        ) : null}

        {months.slice(-8).map(m => {
          const positive = m.value > 0;
          const zero = m.value === 0;
          return (
            <View key={m.key} style={styles.row}>
              <Text style={styles.rowLabel}>{m.label}</Text>
              <Text style={styles.rowMeta}>
                {m.trades} · {t('tradesCount')}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.rowValue,
                  {
                    color: zero
                      ? theme.colors.textMuted
                      : positive
                        ? theme.colors.green
                        : theme.colors.red,
                  },
                ]}
              >
                {formatMoney(m.value)}
              </Text>
            </View>
          );
        })}
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      gap: 6,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    title: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    sparkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      marginBottom: 8,
    },
    totalBlock: { flex: 1 },
    totalLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.8,
    },
    totalValue: {
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    totalMeta: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 3,
    },
    rowLabel: {
      width: 74,
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoMedium,
    },
    rowMeta: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
    },
    rowValue: {
      width: 86,
      textAlign: 'right',
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
  });
