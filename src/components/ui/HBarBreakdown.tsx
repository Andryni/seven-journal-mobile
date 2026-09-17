import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { formatCurrency } from '../../utils/formatCurrency';
import { PressableScale } from './PressableScale';

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
 *
 * A row is pressable when the caller passes `onRowPress`: analytics answers
 * "which category pays?", the drill-down to the trade list answers "show me
 * exactly those trades". Rows without a handler render statically.
 */
export interface HBreakdownItem {
  label: string;
  value: number;
  count: number;
  /** Extra stat shown next to the count (win rate in pp, already rounded). */
  winRate?: number;
  /** Secondary metric under the label (e.g. average R). */
  sub?: string;
  /** Opaque value handed back through onRowPress (e.g. a drill key). */
  payload?: string;
}

interface HBarBreakdownProps {
  items: HBreakdownItem[];
  symbol: string;
  /** Hide zero-count rows (default) — an empty category is not information. */
  hideEmpty?: boolean;
  testID?: string;
  /** Called with item.payload when a row carrying one is pressed. */
  onRowPress?: (payload: string, item: HBreakdownItem) => void;
}

/**
 * One bar, grown from the centre line with a spring instead of appearing at
 * full width. The delay follows the row's entrance, so the card reads top to
 * bottom; the spring's slight overshoot is what makes the winner feel like it
 * *lands*. Static width render is preserved for tests (isAnimated=false).
 */
 const GrowingBar: React.FC<{
  widthPct: number;
  positive: boolean;
  color: string;
  index: number;
  isAnimated: boolean;
}> = ({ widthPct, positive, color, index, isAnimated }) => {
  const progress = useSharedValue(isAnimated ? 0 : 1);

  useEffect(() => {
    if (!isAnimated) {
      progress.value = 1;
      return;
    }
    progress.value = withDelay(
      60 + index * 50,
      withSpring(1, { damping: 16, stiffness: 150, mass: 0.9 })
    );
  }, [progress, isAnimated, index]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * widthPct}%`,
  }));

  if (!isAnimated) {
    return (
      <View
        style={[
          { width: `${widthPct}%`, backgroundColor: color, opacity: 0.85 },
          positive ? { left: '50%' } : { right: '50%' },
        ]}
      />
    );
  }

  return (
    <Animated.View
      style={[
        { backgroundColor: color, opacity: 0.85 },
        positive ? { left: '50%' } : { right: '50%' },
        animatedStyle,
      ]}
    />
  );
};

export const HBarBreakdown: React.FC<HBarBreakdownProps> = ({
  items,
  symbol,
  hideEmpty = true,
  testID,
  onRowPress,
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

  const a11y = (item: HBreakdownItem) =>
    `${item.label}, ${formatCurrency(item.value, { symbol, decimals: 0 })}, ${item.count} trades${
      item.winRate !== undefined ? `, ${Math.round(item.winRate)} percent win rate` : ''
    }`;

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
        const pressable = Boolean(onRowPress && item.payload);
        return (
          <Animated.View
            key={`${item.label}-${i}`}
            entering={FadeIn.delay(i * 50).duration(280)}
          >
            <PressableScale
              onPress={pressable ? () => onRowPress!(item.payload!, item) : undefined}
              disabled={!pressable}
              accessibilityRole={pressable ? 'button' : 'text'}
              accessibilityLabel={a11y(item)}
              testID={testID ? `${testID}-row-${item.payload ?? i}` : undefined}
            >
              <View style={styles.row}>
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
                    <GrowingBar
                      widthPct={widthPct}
                      positive={positive}
                      color={color}
                      index={i}
                      isAnimated={true}
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
              </View>
            </PressableScale>
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
