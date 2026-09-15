import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
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
