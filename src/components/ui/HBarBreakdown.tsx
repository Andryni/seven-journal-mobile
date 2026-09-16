import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { formatCurrency } from '../../utils/formatCurrency';

/**
 * Horizontal diverging bar breakdown — one bar per category, centred on zero.
 *
 * Seven analytics cards (setup, pair, timeframe, session, weekday, mental
 * state, holding time) used to render the same hand-copied text rows: a
 * number to scan, an outlier to discover by reading. Bars make the outlier
 * the thing you see first, and the centered-zero layout shows the sign of
 * every row in the corner of your eye — sign-detection is preattentive,
 * digit-reading is not.
 *
 * Rows sort by value, most negative first when the card is dominated by
 * losses, otherwise most positive first: the row that matters most leads.
 */
export interface HBreakdownItem {
  label: string;
  value: number;
  count: number;
  /** Extra stat shown next to the count (win rate in pp, already rounded). */
  winRate?: number;
  /** Secondary metric under the label (e.g. average R). */
  sub?: string;
}

interface HBarBreakdownProps {
  items: HBreakdownItem[];
  symbol: string;
  /** Hide zero-count rows (default) — an empty category is not information. */
  hideEmpty?: boolean;
  testID?: string;
}

export const HBarBreakdown: React.FC<HBarBreakdownProps> = ({
  items,
  symbol,
  hideEmpty = true,
  testID,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rows = useMemo(() => {
    const visible = hideEmpty ? items.filter(i => i.count > 0) : items;
    const max = Math.max(...visible.map(i => Math.abs(i.value)), 1);
    const lossesLead = visible.length > 0 && visible.every(i => i.value <= 0);
    return {
      max,
      ordered: [...visible].sort((a, b) =>
        lossesLead ? a.value - b.value : b.value - a.value
      ),
    };
  }, [items, hideEmpty]);

  if (rows.ordered.length === 0) return null;

  return (
    <View testID={testID}>
      {rows.ordered.map((item, i) => {
        const positive = item.value > 0;
        const zero = item.value === 0;
        const widthPct = (Math.abs(item.value) / rows.max) * 50;
        const color = zero
          ? theme.colors.textMuted
          : positive
            ? theme.colors.green
            : theme.colors.red;
        return (
          <Animated.View
            key={`${item.label}-${i}`}
            entering={FadeIn.delay(i * 50).duration(280)}
            style={styles.row}
          >
            {/* Labels column, fixed so bars stay aligned across rows. */}
            <View style={styles.labelCol}>
              <Text numberOfLines={1} style={styles.label}>
                {item.label}
              </Text>
              <Text numberOfLines={1} style={styles.meta}>
                {item.count}
                {item.winRate !== undefined ? ` · ${item.winRate.toFixed(0)}% WR` : ''}
                {item.sub ? ` · ${item.sub}` : ''}
              </Text>
            </View>

            {/* Diverging bar: track halves, bar grows from the centre line. */}
            <View style={styles.track}>
              <View style={styles.trackHalf} />
              <View style={styles.trackHalf} />
              <View style={[styles.centreLine, { backgroundColor: theme.colors.hairline }]} />
              <View style={styles.barLayer} pointerEvents="none">
                <View
                  style={[
                    styles.bar,
                    positive ? { left: '50%' } : { right: '50%' },
                    { width: `${widthPct}%`, backgroundColor: color, opacity: 0.85 },
                  ]}
                />
              </View>
            </View>

            <Text
              numberOfLines={1}
              style={[
                styles.value,
                { color: zero ? theme.colors.textMuted : color },
              ]}
            >
              {formatCurrency(item.value, { symbol, decimals: 0 })}
            </Text>
          </Animated.View>
        );
      })}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 5,
    },
    labelCol: { width: 96 },
    label: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoMedium,
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
    },
    track: {
      flex: 1,
      height: 14,
      flexDirection: 'row',
    },
    trackHalf: { flex: 1, backgroundColor: theme.colors.surface },
    centreLine: { position: 'absolute', left: '50%', top: -2, bottom: -2, width: 1 },
    barLayer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 },
    bar: {
      position: 'absolute',
      top: 2,
      bottom: 2,
      minWidth: 2,
      borderRadius: 2,
    },
    value: {
      width: 74,
      textAlign: 'right',
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
  });
