import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import type { DimensionValue, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { duration, easing } from '../../theme/motion';

/**
 * Loading skeletons.
 *
 * Every screen showed a centred spinner, which communicates "something is
 * happening" and nothing else: the layout jumps into existence when the data
 * lands, and a slow connection looks identical to a broken one. A skeleton
 * shaped like the content that is coming keeps the layout stable and makes the
 * wait feel shorter because the eye already knows where to look.
 *
 * The pulse is the one looping animation allowed here, and it stops the moment
 * the real content replaces it.
 */
export const Skeleton: React.FC<{
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}> = ({ width = '100%', height = 12, radius = 6, style }) => {
  const { theme } = useTheme();
  const pulse = useSharedValue(0.4);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: duration.deliberate, easing: easing.out }),
        withTiming(0.4, { duration: duration.deliberate, easing: easing.out })
      ),
      -1,
      false
    );
  }, [pulse]);

  const animated = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Animated.View
      // A skeleton is decorative: announcing every placeholder bar to a screen
      // reader would bury the one message that matters, which the screen
      // itself provides.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: theme.colors.surfaceLight,
        },
        animated,
        style,
      ]}
    />
  );
};

/** A card-shaped placeholder: title line, big figure, two rows. */
export const SkeletonCard: React.FC<{ lines?: number }> = ({ lines = 2 }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.card}>
      <Skeleton width="45%" height={10} />
      <Skeleton width="65%" height={22} style={{ marginTop: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i % 2 === 0 ? '90%' : '70%'}
          height={9}
          style={{ marginTop: 10 }}
        />
      ))}
    </View>
  );
};

/** A blotter-shaped placeholder: one line per row. */
export const SkeletonRows: React.FC<{ rows?: number }> = ({ rows = 6 }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={26} height={26} radius={13} />
          <View style={styles.rowBody}>
            <Skeleton width="40%" height={10} />
            <Skeleton width="25%" height={8} style={{ marginTop: 6 }} />
          </View>
          <Skeleton width={54} height={12} />
        </View>
      ))}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      padding: 16,
      marginHorizontal: 14,
      marginBottom: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.card,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    rowBody: { flex: 1 },
  });
