import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
}

export const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({ onAnimationFinish }) => {
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
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
            <Text style={styles.brandTracking}>TRACKING</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07080a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ambientGlow: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    filter: 'blur(40px)',
  },
  contentWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowHalo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(99, 102, 241, 0.35)',
    top: -15,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 35,
    elevation: 25,
  },
  logoCard: {
    width: 120,
    height: 120,
    borderRadius: 30,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(129, 140, 248, 0.7)',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.8,
    shadowRadius: 25,
    elevation: 20,
    backgroundColor: '#0d0e14',
    marginBottom: 24,
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
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  },
  brandTracking: {
    color: '#818cf8',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
  },
  tagline: {
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 24,
  },
  progressBarBg: {
    width: 180,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#818cf8',
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
    backgroundColor: '#10b981',
  },
  statusText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
