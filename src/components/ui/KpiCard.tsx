import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
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
 * Bloomberg-style KPI tile:
 * - colored accent bar on the left edge
 * - counting number animation
 * - staggered fade-in-up entrance
 * - optional trend chip (▲ / ▼)
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
      entering={FadeInUp.delay(delay).duration(420).springify().damping(16)}
      style={[styles.box, variant === 'surface' && styles.boxSurface]}
    >
      {/* Accent edge bar */}
      <LinearGradient
        colors={[accent, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.accentBar}
      />

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
              <TrendingUp size={9} color={theme.colors.greenLight} />
            ) : (
              <TrendingDown size={9} color={theme.colors.redLight} />
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
      paddingLeft: theme.spacing.md + 6,
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
      width: 3,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 4,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
      flexShrink: 1,
    },
    trendChip: {
      width: 16,
      height: 16,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 4,
    },
    trendUp: { backgroundColor: theme.colors.greenGlow },
    trendDown: { backgroundColor: theme.colors.redGlow },
    value: {
      fontSize: 18,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    sub: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.sansMedium,
      marginTop: 4,
    },
  });
