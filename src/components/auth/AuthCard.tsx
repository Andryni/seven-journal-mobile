import React, { useEffect, useRef } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

type Props = {
  children: React.ReactNode;
  welcomeText: string;
};

export const AuthCard: React.FC<Props> = ({ children, welcomeText }) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.2,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  return (
    <>
      <View style={styles.ambientGlow} />
      <View style={styles.ambientGlowSecondary} />

      <Animated.View
        style={[
          styles.cardWrapper,
          {
            opacity: cardOpacity,
            transform: [{ translateY: cardTranslateY }],
          },
        ]}
      >
        <LinearGradient
          colors={[theme.colors.card, theme.colors.backgroundElevated]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.cardGradient}
        >
          {/* Top glow line */}
          <LinearGradient
            colors={[theme.colors.borderBright, theme.colors.primaryGlow, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topHighlight}
          />

          {/* Logo */}
          <View style={styles.logoSection}>
            <Animated.View style={[styles.logoGlow, { opacity: glowPulse }]} />
            <Animated.View style={[styles.logoCard, { transform: [{ scale: logoScale }] }]}>
              <Image
                source={require('../../assets/seven_tracking_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </Animated.View>
            <View style={styles.brandRow}>
              <Text style={styles.brandSeven}>SEVEN </Text>
              <Text style={styles.brandJournal}>JOURNAL</Text>
            </View>
            <Text style={styles.tagline}>QUANTITATIVE TRADING TERMINAL</Text>
          </View>

          {/* Welcome text */}
          <Text style={styles.welcomeText}>{welcomeText}</Text>

          {/* Form content */}
          {children}
        </LinearGradient>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Seven Journal v1.0</Text>
      </View>
    </>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    ambientGlow: {
      position: 'absolute',
      width: 350,
      height: 350,
      borderRadius: 175,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      top: '15%',
      alignSelf: 'center',
    },
    ambientGlowSecondary: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(6, 182, 212, 0.06)',
      bottom: '20%',
      alignSelf: 'center',
    },
    cardWrapper: {
      width: '100%',
      borderRadius: theme.borderRadius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 15,
    },
    cardGradient: {
      padding: theme.spacing.xl,
    },
    topHighlight: {
      height: 1,
      width: '100%',
      marginBottom: theme.spacing.lg,
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    logoGlow: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(99, 102, 241, 0.25)',
      top: -14,
    },
    logoCard: {
      width: 90,
      height: 90,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 8,
      marginBottom: 4,
    },
    brandSeven: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 2,
    },
    brandJournal: {
      color: theme.colors.primaryLight,
      fontSize: 18,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 2,
      paddingRight: 4,
    },
    tagline: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.5,
    },
    welcomeText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontFamily: theme.fonts.sansSemiBold,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
    footer: {
      position: 'absolute',
      bottom: 40,
      alignItems: 'center',
    },
    footerText: {
      color: theme.colors.textDark,
      fontSize: 9,
      fontFamily: theme.fonts.monoMedium,
      letterSpacing: 0.5,
    },
  });
