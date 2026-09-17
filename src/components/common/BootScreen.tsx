import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { CandleLoader } from '../ui/CandleLoader';
import { BrandWordmark } from '../brand/BrandWordmark';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface BootScreenProps {
  /** Optional caption, e.g. a loading phase. */
  caption?: string;
}

/**
 * Boot screen shown while fonts load and the session is restored.
 *
 * Replaces a bare white flash followed by a spinner: it says what app you
 * opened, so the wait doubles as branding rather than being dead time.
 *
 * The mark is the shipped artwork (same file as the launcher icon), so boot,
 * home screen and store all show one identity. Scaled from the window width —
 * a fixed 46px glyph is a stamp on a tablet.
 */
export const BootScreen: React.FC<BootScreenProps> = ({ caption }) => {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Scale with the device, clamped to the range a logo is allowed to occupy.
  const markSize = Math.max(72, Math.min(120, width * 0.2));

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        <Image
          source={require('../../assets/seven_tracking_logo.png')}
          style={{ width: markSize, height: markSize }}
          resizeMode="contain"
        />
        <BrandWordmark
          fontSize={17}
          fontFamily={theme.fonts.monoBold}
          letterSpacing={3.4}
          style={styles.wordmark}
        />
        <Text style={styles.tagline}>{caption ?? 'FINTECH TERMINAL'}</Text>

        {/* Candles printing left to right: the same loader the rest of the
            app uses, so waiting always looks like the same thing. */}
        <View style={styles.loaderSlot}>
          <CandleLoader size={30} />
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    loaderSlot: { marginTop: 22 },
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
    },
    tagline: {
      marginTop: 6,
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
      letterSpacing: 2.2,
    },
  });
