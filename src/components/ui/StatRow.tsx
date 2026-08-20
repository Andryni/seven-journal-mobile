import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface StatRowProps {
  label: string;
  value: string;
  valueColor?: string;
  showBorder?: boolean;
}

export const StatRow: React.FC<StatRowProps> = ({
  label,
  value,
  valueColor,
  showBorder = true,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedValueColor = valueColor ?? theme.colors.textPrimary;
  return (
    <View style={[styles.row, showBorder && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color: resolvedValueColor }]}>{value}</Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  rowBorder: {
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  value: {
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
});
