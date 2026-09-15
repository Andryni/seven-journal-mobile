import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { AnimatedNumber } from './AnimatedNumber';

interface KpiCardProps {
  label: string;
  value: string;
  valueColor?: string;
  sub?: React.ReactNode;
  variant?: 'card' | 'surface';
  /** When provided, the value animates by counting from the previous value */
  numericValue?: number;
  /** Formatter used with numericValue */
  format?: (v: number) => string;
  /** 'up' | 'down' renders a trend chip next to the label */
  trend?: 'up' | 'down';
  /** Entrance animation delay (ms) for staggered grids */
  delay?: number;
  /** Accent color of the left bar (defaults to valueColor) */
  accentColor?: string;
}

/**
 * KPI tile — Trading Desk revision.
 * Flat surface, 2px solid accent rail (was a gradient), no springy entrance.
 * Prefer <Metric /> inside a <Panel /> for new code.
 */
export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  valueColor,
  sub,
  variant = 'card',
  numericValue,
  format,
  trend,
  delay = 0,
  accentColor,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedValueColor = valueColor ?? theme.colors.textPrimary;
  const accent = accentColor ?? valueColor ?? theme.colors.primary;

  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(220)}
      style={[styles.box, variant === 'surface' && styles.boxSurface]}
    >
      {/* Accent rail — flat, full height, no gradient fade */}
      <View style={[styles.accentBar, { backgroundColor: accent }]} />

      <View style={styles.labelRow}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {trend && (
          <View
            style={[
              styles.trendChip,
              trend === 'up' ? styles.trendUp : styles.trendDown,
            ]}
          >
            {trend === 'up' ? (
              <TrendingUp size={9} color={theme.colors.green} />
            ) : (
              <TrendingDown size={9} color={theme.colors.red} />
            )}
          </View>
        )}
      </View>

      {numericValue !== undefined && format ? (
        <AnimatedNumber
          value={numericValue}
          format={format}
          style={[styles.value, { color: resolvedValueColor }]}
        />
      ) : (
        <Text style={[styles.value, { color: resolvedValueColor }]}>{value}</Text>
      )}

      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    box: {
      flex: 1,
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      paddingLeft: theme.spacing.md + 4,
      overflow: 'hidden',
    },
    boxSurface: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.md,
    },
    accentBar: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 2,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    label: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      flexShrink: 1,
    },
    trendChip: {
      width: 16,
      height: 16,
      borderRadius: theme.borderRadius.xs,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },
    trendUp: { backgroundColor: theme.colors.greenMuted },
    trendDown: { backgroundColor: theme.colors.redMuted },
    value: {
      fontSize: theme.type.metric,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    sub: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      marginTop: 4,
    },
  });
