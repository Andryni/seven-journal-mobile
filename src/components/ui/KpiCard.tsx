import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface KpiCardProps {
  label: string;
  value: string;
  valueColor?: string;
  sub?: React.ReactNode;
  variant?: 'card' | 'surface';
}

export const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  valueColor,
  sub,
  variant = 'card',
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedValueColor = valueColor ?? theme.colors.textPrimary;
  return (
    <View style={[styles.box, variant === 'surface' && styles.boxSurface]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: resolvedValueColor }]}>{value}</Text>
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
  label: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    marginBottom: 4,
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

