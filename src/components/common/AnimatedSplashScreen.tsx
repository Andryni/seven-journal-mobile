import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
}

/**
 * Splash — deliberately minimal.
 *
 * The previous version ran 255 lines of springs, breathing loops, glow pulses
 * and a fake progress bar for ~2.4s before the app was usable. A splash is a
 * load-time cover, not a show: this one fades a mark in and out in ~900ms and
 * gets out of the way.
 */
export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onAnimationFinish,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.delay(260),
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => onAnimationFinish());
  }, [opacity, onAnimationFinish]);

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity, alignItems: 'center' }}>
        <Image
          source={require('../../assets/seven_tracking_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.wordmark}>SEVEN JOURNAL</Text>
        <View style={styles.rule} />
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
    logo: {
      width: 76,
      height: 76,
      marginBottom: theme.spacing.lg,
    },
    wordmark: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 4,
    },
    rule: {
      width: 28,
      height: 2,
      backgroundColor: theme.colors.primary,
      marginTop: theme.spacing.md,
      borderRadius: 1,
    },
  });
