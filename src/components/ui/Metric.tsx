import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Sparkline } from './Sparkline';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

type MetricSize = 'hero' | 'display' | 'default' | 'small';
type MetricTone = 'default' | 'pnl' | 'accent' | 'muted' | 'info' | 'gold';

interface MetricProps {
  /** Small uppercase caption above the number. */
  label: string;
  /** Pre-formatted value string. Formatting stays the caller's job. */
  value: string;
  /** Optional secondary line under the value. */
  sub?: string;
  size?: MetricSize;
  tone?: MetricTone;
  /** When tone="pnl", drives green/red/neutral. */
  pnlValue?: number | null;
  align?: 'left' | 'center' | 'right';
  /**
   * Recent history of this metric. When at least two points are given, a
   * sparkline is drawn under the value so the number carries its direction,
   * not just its level.
   */
  trend?: number[];
  /**
   * Set when a RISING series is bad news (drawdown). The sparkline colour is
   * inverted so red always means "worse", regardless of which way the line
   * happens to point.
   */
  trendInverted?: boolean;
  /**
   * Value the trend is judged against when picking green or red.
   *
   * Without it the sparkline compares the last point to the FIRST, which is
   * meaningless for these series: after one closed trade a win rate is either
   * 0 or 100 and an expectancy is that single trade's P&L, so almost any real
   * history reads as a decline. A trader with a 57% win rate and a positive
   * expectancy was shown two red sparklines.
   *
   * Pass the value that separates good from bad for this metric -- 50 for a
   * win rate, 1 for a profit factor, 0 for an expectancy.
   */
  trendBaseline?: number;
  style?: ViewStyle;
}

/**
 * Metric — a single number with its caption.
 *
 * All financial numbers route through here so `tabular-nums` and the type
 * scale are applied consistently. The old KpiCard wrapped every number in its
 * own bordered box, which produced a grid of competing containers; a Metric is
 * just type on the panel surface.
 */
export const Metric: React.FC<MetricProps> = ({
  label,
  value,
  trend,
  trendInverted = false,
  trendBaseline,
  sub,
  size = 'default',
  tone = 'default',
  pnlValue,
  align = 'left',
  style,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const fontSize = {
    hero: theme.type.hero,
    display: theme.type.display,
    default: theme.type.metric,
    small: theme.type.metricSm,
  }[size];

  let color = theme.colors.textPrimary;
  if (tone === 'pnl') {
    const v = pnlValue ?? 0;
    color = v > 0 ? theme.colors.green : v < 0 ? theme.colors.red : theme.colors.textSecondary;
  } else if (tone === 'accent') color = theme.colors.primary;
  else if (tone === 'muted') color = theme.colors.textSecondary;
  else if (tone === 'info') color = theme.colors.cyan;
  else if (tone === 'gold') color = theme.colors.gold;

  const alignStyle: TextStyle = { textAlign: align };

  return (
    <View style={[{ alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start' }, style]}>
      <Text style={[styles.label, alignStyle]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[
          styles.value,
          { fontSize, color, lineHeight: Math.round(fontSize * 1.1) },
          size === 'hero' && styles.heroTracking,
          alignStyle,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit={size === 'hero'}
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      {trend && trend.length >= 2 ? (
        <View style={styles.spark}>
          <Sparkline
            data={trendInverted ? trend.map(v => -v) : trend}
            baseline={
              trendBaseline === undefined
                ? undefined
                : trendInverted
                ? -trendBaseline
                : trendBaseline
            }
            width={78}
            height={22}
            strokeWidth={1.5}
          />
        </View>
      ) : null}
      {sub ? (
        <Text style={[styles.sub, alignStyle]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    spark: {
      marginTop: 6,
      marginBottom: 2,
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 5,
    },
    value: {
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    heroTracking: {
      letterSpacing: -1.2,
    },
    sub: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
      marginTop: 4,
    },
  });
