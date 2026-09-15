import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Fingerprint } from 'lucide-react-native';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { duration } from '../theme/motion';
import { PressableScale } from '../components/ui/PressableScale';

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
  const styles = useMemo(() => createStyles(theme), [theme]);

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
        <Text style={styles.wordmark}>SEVEN JOURNAL</Text>
        <View style={styles.rule} />

        <PressableScale
          style={styles.button}
          onPress={onAuthenticate}
          disabled={isAuthenticating}
          accessibilityLabel="Déverrouiller"
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
    content: { alignItems: 'center' },
    logo: { width: 68, height: 68, marginBottom: theme.spacing.lg },
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
