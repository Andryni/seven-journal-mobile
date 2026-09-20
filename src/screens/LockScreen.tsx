import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator, useWindowDimensions } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Fingerprint } from 'lucide-react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import type { AppTheme } from '../theme';
import { duration } from '../theme/motion';
import { PressableScale } from '../components/ui/PressableScale';
import { BrandWordmark } from '../components/brand/BrandWordmark';
import { BRAND_WORDMARK, lockupBoxWidth } from '../components/brand/lockupGeometry';

interface LockScreenProps {
  onAuthenticate: () => void;
  isAuthenticating: boolean;
}

/**
 * Shown instead of the app when the biometric lock is armed.
 * Prompts automatically on mount so the common path is zero taps.
 */
export const LockScreen: React.FC<LockScreenProps> = ({ onAuthenticate, isAuthenticating }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();

  // Same computed box as the splash and boot screen, so the wordmark cannot
  // lose its L here either -- see lockupGeometry.
  const wordmarkWidth = useMemo(
    () =>
      lockupBoxWidth(width - theme.spacing.lg * 2, [
        { text: BRAND_WORDMARK, fontSize: theme.type.title, letterSpacing: 4, mono: true },
      ]),
    [width, theme.spacing.lg, theme.type.title]
  );

  useEffect(() => {
    onAuthenticate();
    // Prompt once on mount; retries are user-initiated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View entering={FadeIn.duration(duration.base)} style={styles.content}>
        <Image
          source={require('../assets/seven_tracking_logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <BrandWordmark
          fontSize={theme.type.title}
          fontFamily={theme.fonts.monoBold}
          letterSpacing={4}
          maxFontSizeMultiplier={1.3}
          style={[styles.wordmark, { width: wordmarkWidth }]}
        />
        <View style={styles.rule} />

        <PressableScale
          style={styles.button}
          onPress={onAuthenticate}
          disabled={isAuthenticating}
          accessibilityLabel={t('unlockA11y')}
        >
          {isAuthenticating ? (
            <ActivityIndicator size="small" color={theme.colors.background} />
          ) : (
            <>
              <Fingerprint size={16} color={theme.colors.background} strokeWidth={2} />
              <Text style={styles.buttonText}>DÉVERROUILLER</Text>
            </>
          )}
        </PressableScale>
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
    // Stretched for the same reason as the boot and splash lockups: the
    // wordmark must not be measured against a width this column derives from
    // the measurement itself, or its final L is the casualty.
    content: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    logo: { width: 68, height: 68, marginBottom: theme.spacing.lg },
    // Width from the caller (lockupGeometry).
    wordmark: {
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    rule: {
      width: 28,
      height: 2,
      backgroundColor: theme.colors.primary,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.xxl,
      borderRadius: 1,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 22,
      height: 44,
      minWidth: 190,
      borderRadius: theme.borderRadius.sm,
    },
    buttonText: {
      color: theme.colors.background,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoExtraBold,
      letterSpacing: 1.2,
    },
  });
