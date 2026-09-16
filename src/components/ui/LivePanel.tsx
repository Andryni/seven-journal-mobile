import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { duration, easing } from '../../theme/motion';

type LiveTone = 'neutral' | 'positive' | 'negative';

interface LivePanelProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: ViewStyle;
  flush?: boolean;
  delay?: number;
  /**
   * Drives the border colour. Unlike a decorative glow, this carries meaning:
   * the frame of a panel states whether what it contains is going well.
   */
  tone?: LiveTone;
  /**
   * Breathes the border opacity on a slow loop. Reserve it for surfaces that
   * are genuinely live (an open position, today's running P&L). A pulse that
   * never stops on static content is just noise, and DESIGN.md forbids motion
   * that carries no state.
   */
  live?: boolean;
}

/**
 * LivePanel — a Panel whose border is part of the instrument.
 *
 * The flat hairline of `Panel` is the right default for dense layouts, but the
 * headline surfaces of the dashboard were visually inert: the KPI block read
 * as a static table even while the numbers behind it moved.
 *
 * Here the edge itself is bound to state. The border fades in from the panel
 * background rather than popping, tints with the tone, and -- only when the
 * content is actually live -- breathes on a slow cycle. Nothing bounces, and
 * an idle panel is indistinguishable from the old one.
 */
export const LivePanel: React.FC<LivePanelProps> = ({
  title,
  subtitle,
  action,
  children,
  style,
  flush = false,
  delay = 0,
  tone = 'neutral',
  live = false,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const settle = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    settle.value = withTiming(1, { duration: duration.slow, easing: easing.out });
  }, [settle]);

  useEffect(() => {
    if (!live) {
      breathe.value = withTiming(0, { duration: duration.fast });
      return;
    }
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1800, easing: easing.inOut }),
        withTiming(0, { duration: 1800, easing: easing.inOut })
      ),
      -1
    );
  }, [live, breathe]);

  const restColor = {
    neutral: theme.colors.cardBorder,
    positive: withAlpha(theme.colors.green, 0.28),
    negative: withAlpha(theme.colors.red, 0.28),
  }[tone];

  const peakColor = {
    neutral: theme.colors.borderBright,
    positive: withAlpha(theme.colors.green, 0.65),
    negative: withAlpha(theme.colors.red, 0.6),
  }[tone];

  const borderStyle = useAnimatedStyle(() => ({
    // Two stages: the entrance settles the border in from the surface colour,
    // then the live cycle moves it between rest and peak. Colour is
    // interpolated rather than animating opacity so the panel's fill is never
    // dimmed along with its edge.
    borderColor: interpolateColor(
      settle.value * (0.35 + breathe.value * 0.65),
      [0, 0.35, 1],
      [theme.colors.card, restColor, peakColor]
    ),
  }));

  return (
    <Animated.View
      entering={FadeIn.delay(delay).duration(duration.base)}
      style={[styles.panel, borderStyle, style]}
    >
      {title ? (
        <View style={[styles.header, flush && styles.headerFlush]}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      <View style={flush ? styles.bodyFlush : styles.body}>{children}</View>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    panel: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      marginBottom: theme.spacing.md,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    headerFlush: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.hairline,
      paddingBottom: theme.spacing.md,
    },
    titleWrap: { flex: 1 },
    title: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 3,
    },
    action: { marginLeft: theme.spacing.sm },
    body: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
    },
    bodyFlush: {},
  });
