import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { AnimatedNumberTicker } from './AnimatedNumberTicker';

interface KpiCardProps {
  label: string;
  value: string;
  numValue?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  valueColor?: string;
  sub?: React.ReactNode;
  variant?: 'card' | 'surface';
  icon?: React.ReactNode;
  glow?: boolean | 'green' | 'red' | 'cyan' | 'purple' | 'gold';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  numValue,
  prefix = '',
  suffix = '',
  decimals = 2,
  valueColor,
  sub,
  variant = 'card',
  icon,
  glow = false,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedValueColor = valueColor ?? theme.colors.textPrimary;

  const glowStyle = useMemo(() => {
    if (!glow) return null;
    if (glow === true || glow === 'purple') return styles.boxGlowPurple;
    if (glow === 'green') return styles.boxGlowGreen;
    if (glow === 'red') return styles.boxGlowRed;
    if (glow === 'cyan') return styles.boxGlowCyan;
    if (glow === 'gold') return styles.boxGlowGold;
    return styles.boxGlowPurple;
  }, [glow, styles]);

  return (
    <View style={[styles.box, variant === 'surface' && styles.boxSurface, glowStyle]}>
      {/* Top Edge Highlight Line */}
      <View style={styles.topEdgeLine} />
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        {icon && <View style={styles.iconWrap}>{icon}</View>}
      </View>
      {numValue !== undefined ? (
        <AnimatedNumberTicker
          value={numValue}
          prefix={prefix}
          suffix={suffix}
          decimals={decimals}
          style={[styles.value, { color: resolvedValueColor }]}
        />
      ) : (
        <Text style={[styles.value, { color: resolvedValueColor }]}>{value}</Text>
      )}
      {sub ? <Text style={styles.sub}>{sub}</Text> : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  box: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    position: 'relative',
    overflow: 'hidden',
  },
  boxSurface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  topEdgeLine: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  boxGlowPurple: {
    borderColor: 'rgba(99, 102, 241, 0.45)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  boxGlowGreen: {
    borderColor: 'rgba(16, 185, 129, 0.45)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  boxGlowRed: {
    borderColor: 'rgba(239, 68, 68, 0.45)',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  boxGlowCyan: {
    borderColor: 'rgba(6, 182, 212, 0.45)',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  boxGlowGold: {
    borderColor: 'rgba(245, 158, 11, 0.45)',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  iconWrap: {
    opacity: 0.8,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },
  value: {
    fontSize: 17,
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

