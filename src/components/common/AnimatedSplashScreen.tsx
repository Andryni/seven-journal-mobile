import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onAnimationFinish }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const pulseScale = useRef(new Animated.Value(1)).current;
  const glowPulse = useRef(new Animated.Value(0.4)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const containerFade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // 1. Entrance animation (Spring + Zoom + Glow)
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textFade, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(progressAnim, {
          toValue: 1,
          duration: 1400,
          useNativeDriver: false,
        }),
      ]),
      // 2. Continuous breathing / glowing loop
      Animated.delay(600),
      // 3. Smooth exit transition
      Animated.parallel([
        Animated.timing(containerFade, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.12,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onAnimationFinish();
    });

    // Ambient pulsing loop
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.8,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulseLoop.start();

    return () => pulseLoop.stop();
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View style={[styles.container, { opacity: containerFade }]}>
      {/* Background radial gradient effect */}
      <View style={styles.ambientGlow} />

      <Animated.View
        style={[
          styles.contentWrap,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
      >
        {/* Pulsing Neon Halo around Logo */}
        <Animated.View
          style={[
            styles.glowHalo,
            {
              opacity: glowPulse,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />

        {/* Logo Neon Card */}
        <View style={styles.logoCard}>
          <Image
            source={require('../../assets/seven_tracking_logo.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>

        {/* Brand Text Block */}
        <Animated.View style={[styles.textBlock, { opacity: textFade }]}>
          <View style={styles.brandRow}>
            <Text style={styles.brandSeven}>SEVEN </Text>
            <Text style={styles.brandTracking}>JOURNAL</Text>
          </View>
          <Text style={styles.tagline}>QUANTITATIVE TRADING TERMINAL</Text>

          {/* High-Tech Animated Loading Bar */}
          <View style={styles.progressBarBg}>
            <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
          </View>

          <View style={styles.loadingRow}>
            <View style={styles.liveDot} />
            <Text style={styles.statusText}>INITIALISATION DU TERMINAL...</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(99, 102, 241, 0.3)',
    top: -18,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 28,
  },
  logoCard: {
    width: 128,
    height: 128,
    borderRadius: 32,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(129, 140, 248, 0.8)',
    shadowColor: theme.colors.green,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.9,
    shadowRadius: 30,
    elevation: 22,
    backgroundColor: theme.colors.backgroundElevated,
    marginBottom: 28,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    alignItems: 'center',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  brandSeven: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 3,
  },
  brandTracking: {
    color: theme.colors.primaryLight,
    fontSize: 24,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 3,
  },
  tagline: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 2,
    marginBottom: 24,
  },
  progressBarBg: {
    width: 180,
    height: 3,
    backgroundColor: theme.colors.cardBorder,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.green,
  },
  statusText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
    letterSpacing: 0.8,
  },
});
