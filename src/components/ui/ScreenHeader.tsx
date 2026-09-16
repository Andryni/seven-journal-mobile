import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { duration } from '../../theme/motion';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  /** Right-hand control: a share button, a filter toggle, an action. */
  action?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * The title block every main screen opens with.
 *
 * Five screens rendered this themselves and had drifted into four different
 * versions of it: titles at 26, 18 and 16 points, letter spacing at -0.6, 1
 * and 1.2, and subtitles in three different colours. Nothing about those
 * screens justifies the difference -- they are the same element doing the
 * same job, and the inconsistency is just what happens when a pattern is
 * copied by hand five times.
 *
 * Settled on the majority reading: 18pt title with open tracking (uppercase
 * titles need it), and the accent-coloured subtitle three of the five already
 * used. The entrance animation comes with it, so screens stop having to
 * remember to add one.
 */
export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  action,
  style,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View
      entering={FadeInDown.duration(duration.base)}
      style={[styles.header, style]}
    >
      <View style={styles.titles}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: theme.spacing.md,
    },
    titles: { flex: 1 },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 1,
    },
    subtitle: {
      color: theme.colors.primaryLight,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.6,
      marginTop: 3,
    },
    action: { paddingTop: 2 },
  });
