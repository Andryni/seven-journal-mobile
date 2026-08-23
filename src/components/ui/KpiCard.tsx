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
  glow?: boolean;
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
  return (
    <View style={[styles.box, variant === 'surface' && styles.boxSurface, glow && styles.boxGlow]}>
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
  },
  boxSurface: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  boxGlow: {
    borderColor: theme.colors.cardBorderGlow,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
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

