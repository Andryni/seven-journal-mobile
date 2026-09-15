import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withDelay,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import Svg, { Path, Line, Rect, G } from 'react-native-svg';
import { SevenMark } from '../brand/SevenMark';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Boot screen shown while fonts load and the session is restored.
 *
 * Replaces a bare white flash followed by a spinner. A spinner says "something
 * is happening"; this says what app you opened. The motif is the product
 * itself -- an equity curve drawing itself across a candlestick grid -- so the
 * wait doubles as branding rather than being dead time.
 *
 * Everything is vector and theme-driven: no image to decode, nothing to
 * download, and it renders identically offline.
 */

const CURVE = 'M 4 78 L 26 64 L 48 70 L 70 44 L 92 52 L 114 26 L 136 34 L 158 8';
const CURVE_LENGTH = 320;

interface BootScreenProps {
  /** Optional caption, e.g. a loading phase. */
  caption?: string;
}

export const BootScreen: React.FC<BootScreenProps> = ({ caption }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const draw = useSharedValue(0);
  const fade = useSharedValue(0);
  const sweep = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) });
    // The curve draws itself, then keeps looping: the app may be waiting on a
    // slow network, and a frozen illustration reads as a hang.
    draw.value = withDelay(
      160,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) }),
          withTiming(1, { duration: 500 }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      ),
    );
    sweep.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [draw, fade, sweep]);

  const curveProps = useAnimatedProps(() => ({
    strokeDashoffset: CURVE_LENGTH * (1 - draw.value),
  }));

  const rootStyle = useAnimatedStyle(() => ({ opacity: fade.value }));
  const barStyle = useAnimatedStyle(() => ({ opacity: 0.35 + sweep.value * 0.5 }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.stack, rootStyle]}>
        <Svg width={162} height={86} viewBox="0 0 162 86">
          {/* Grid: the ledger the curve is drawn on. */}
          <G opacity={0.22}>
            {[18, 38, 58, 78].map(y => (
              <Line
                key={y}
                x1={0}
                y1={y}
                x2={162}
                y2={y}
                stroke={theme.colors.textMuted}
                strokeWidth={0.5}
              />
            ))}
          </G>

          {/* Candles: the raw journal entries behind the curve. */}
          <G opacity={0.5}>
            {[
              { x: 22, y: 58, h: 14 },
              { x: 66, y: 38, h: 20 },
              { x: 110, y: 22, h: 16 },
            ].map(c => (
              <Rect
                key={c.x}
                x={c.x}
                y={c.y}
                width={5}
                height={c.h}
                rx={1}
                fill={theme.colors.green}
              />
            ))}
          </G>

          <AnimatedPath
            d={CURVE}
            fill="none"
            stroke={theme.colors.primary}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CURVE_LENGTH}
            animatedProps={curveProps}
          />
        </Svg>

        {/* The mark, vectorised: same geometry as the launcher icon but
            themed and resolution-independent, rather than a scaled PNG. */}
        <SevenMark size={46} />
        <Text style={styles.wordmark}>SEVEN JOURNAL</Text>
        <Text style={styles.tagline}>{caption ?? 'FINTECH TERMINAL'}</Text>

        <Animated.View style={[styles.bar, barStyle]} />
      </Animated.View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stack: { alignItems: 'center' },
    wordmark: {
      marginTop: theme.spacing.md,
      color: theme.colors.textPrimary,
      fontSize: 17,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 3.4,
    },
    tagline: {
      marginTop: 6,
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
      letterSpacing: 2.2,
    },
    bar: {
      marginTop: theme.spacing.lg,
      width: 92,
      height: 2,
      borderRadius: 1,
      backgroundColor: theme.colors.primary,
    },
  });
