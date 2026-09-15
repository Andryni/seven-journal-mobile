import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface CandleLoaderProps {
  /** Overall height of the candle field. */
  size?: number;
  /** Optional caption under the candles. */
  label?: string;
}

/**
 * CandleLoader — a spinner made of Japanese candlesticks.
 *
 * A generic ActivityIndicator says "something is happening" in the same
 * vocabulary as every other app. This says it in the language of the product:
 * a small series of candles printing left to right, each one growing from its
 * open and flipping green or red as it closes, the way a chart fills in live.
 *
 * Deliberately not random. Randomness in a loader reads as noise and, worse,
 * a red-heavy draw looks like bad news while the user waits on their own P&L.
 * The sequence below is fixed and ends green, so the motion is recognisable
 * every time and never implies a result.
 */

/**
 * The printed sequence, in fractions of the available height.
 *
 * `body` is the open-to-close span, `offset` its distance from the bottom of
 * the field, and `up` decides the colour. Wicks are derived so they always
 * extend past the body.
 */
const CANDLES = [
  { offset: 0.30, body: 0.22, up: true },
  { offset: 0.44, body: 0.26, up: true },
  { offset: 0.34, body: 0.20, up: false },
  { offset: 0.40, body: 0.30, up: true },
  { offset: 0.26, body: 0.24, up: false },
  { offset: 0.46, body: 0.34, up: true },
];

const STEP_MS = 190;
const GROW_MS = 320;

const Candle: React.FC<{
  index: number;
  spec: (typeof CANDLES)[number];
  field: number;
  width: number;
  theme: AppTheme;
}> = ({ index, spec, field, width, theme }) => {
  const progress = useSharedValue(0);

  const bodyH = field * spec.body;
  const bottom = field * spec.offset;
  const wick = Math.max(6, bodyH * 0.42);

  useEffect(() => {
    /**
     * One cycle per candle: grow, hold while the rest of the series prints,
     * then clear. The total is identical for every candle so the loop stays in
     * phase however many candles the sequence has.
     */
    const hold = CANDLES.length * STEP_MS;
    progress.value = withDelay(
      index * STEP_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: GROW_MS, easing: Easing.out(Easing.cubic) }),
          withTiming(1, { duration: hold }),
          withTiming(0, { duration: GROW_MS * 0.6, easing: Easing.in(Easing.cubic) })
        ),
        -1,
        false
      )
    );
  }, [index, progress]);

  // The body grows from its own midline, which is how a candle actually
  // prints: the open is fixed and the close travels away from it.
  const bodyStyle = useAnimatedStyle(() => ({
    height: bodyH * progress.value,
    opacity: 0.35 + progress.value * 0.65,
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [theme.colors.textMuted, spec.up ? theme.colors.green : theme.colors.red]
    ),
  }));

  const wickStyle = useAnimatedStyle(() => ({
    height: (bodyH + wick * 2) * progress.value,
    opacity: progress.value * 0.55,
  }));

  return (
    <View style={{ width, height: field, justifyContent: 'flex-end' }}>
      <View style={{ height: bottom + bodyH, justifyContent: 'flex-end', alignItems: 'center' }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              bottom: -wick,
              width: 1.5,
              borderRadius: 1,
              backgroundColor: spec.up ? theme.colors.green : theme.colors.red,
            },
            wickStyle,
          ]}
        />
        <Animated.View style={[{ width: width * 0.56, borderRadius: 2 }, bodyStyle]} />
      </View>
    </View>
  );
};

export const CandleLoader: React.FC<CandleLoaderProps> = ({ size = 56, label }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const colW = Math.max(7, size * 0.155);

  return (
    <View
      style={styles.wrap}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      <View style={[styles.field, { height: size }]}>
        {CANDLES.map((spec, i) => (
          <Candle key={i} index={i} spec={spec} field={size} width={colW} theme={theme} />
        ))}
      </View>
      {/* The baseline the series prints on — the same axis as the app mark. */}
      <View style={[styles.axis, { width: colW * CANDLES.length }]} />
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', justifyContent: 'center' },
    field: { flexDirection: 'row', alignItems: 'flex-end' },
    axis: {
      height: 1,
      backgroundColor: theme.colors.cardBorder,
      marginTop: 4,
      borderRadius: 1,
    },
    label: {
      marginTop: 12,
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.8,
    },
  });
