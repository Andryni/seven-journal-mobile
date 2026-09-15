import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface DataRowProps {
  label: string;
  value: string;
  /** Colours the value green/red. */
  pnlValue?: number | null;
  tone?: 'default' | 'accent' | 'info' | 'gold' | 'muted';
  /** Small leading icon or swatch. */
  leading?: React.ReactNode;
  /** Renders a hairline under the row. */
  divider?: boolean;
  dense?: boolean;
  style?: ViewStyle;
}

/**
 * DataRow — one label/value line in a dense list.
 *
 * Label left in muted mono-uppercase, value right in tabular-nums, hairline
 * between rows. This is what makes a screen read as a terminal readout rather
 * than a stack of cards.
 */
export const DataRow: React.FC<DataRowProps> = ({
  label,
  value,
  pnlValue,
  tone = 'default',
  leading,
  divider = true,
  dense = false,
  style,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  let color = theme.colors.textPrimary;
  if (pnlValue !== undefined && pnlValue !== null) {
    color = pnlValue > 0 ? theme.colors.green : pnlValue < 0 ? theme.colors.red : theme.colors.textSecondary;
  } else if (tone === 'accent') color = theme.colors.primary;
  else if (tone === 'info') color = theme.colors.cyan;
  else if (tone === 'gold') color = theme.colors.gold;
  else if (tone === 'muted') color = theme.colors.textSecondary;

  return (
    <View style={style}>
      <View style={[styles.row, dense && styles.rowDense]}>
        {leading ? <View style={styles.leading}>{leading}</View> : null}
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.value, { color }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {divider ? <View style={styles.divider} /> : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      gap: theme.spacing.sm,
    },
    rowDense: { paddingVertical: 7 },
    leading: { width: 18, alignItems: 'center' },
    label: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoMedium,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    value: {
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.hairline,
    },
  });
