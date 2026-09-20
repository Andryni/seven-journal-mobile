import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native';
import { CandleLoader } from '../ui/CandleLoader';
import { BrandWordmark } from '../brand/BrandWordmark';
import {
  BOOT_TAGLINE,
  BOOT_WORDMARK,
  BRAND_TAGLINE,
  bootLockupLines,
  lockupBoxWidth,
} from '../brand/lockupGeometry';
import { SpacedLabel } from '../ui/SpacedLabel';
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

  // Computed box for both brand lines -- see lockupGeometry. The caption is a
  // status line, not brand: it gets the same box and ellipsizes honestly.
  const lockupWidth = useMemo(
    () => lockupBoxWidth(width - theme.spacing.lg * 2, bootLockupLines()),
    [width, theme.spacing.lg]
  );

  return (
    <View style={styles.container}>
      <View style={styles.stack}>
        <Image
          source={require('../../assets/seven_tracking_logo.png')}
          style={{ width: markSize, height: markSize }}
          resizeMode="contain"
        />
        <BrandWordmark
          fontSize={BOOT_WORDMARK.fontSize}
          fontFamily={theme.fonts.monoBold}
          letterSpacing={BOOT_WORDMARK.letterSpacing}
          maxFontSizeMultiplier={1.3}
          style={[styles.wordmark, { width: lockupWidth }]}
        />
        {/* numberOfLines: an over-wide tagline must ellipsize, never wrap --
            a second line would push the loader off the boot frame. SpacedLabel
            books the trailing letter-spacing gap so TERMINAL keeps its L. */}
        <SpacedLabel
          fontSize={BOOT_TAGLINE.fontSize}
          fontFamily={theme.fonts.mono}
          letterSpacing={BOOT_TAGLINE.letterSpacing}
          maxFontSizeMultiplier={1.3}
          style={[styles.tagline, { width: lockupWidth }]}
          numberOfLines={1}
        >
          {caption ?? BRAND_TAGLINE}
        </SpacedLabel>

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
    // Stretched, not content-sized: a text child of a shrink-to-fit column is
    // measured against a width that column is itself deriving from the
    // measurement, and the tail of the run is what pays for it (the reported
    // "SEVEN JOURNA…" and the vanishing TERMINAL). Full width plus centring
    // makes the box independent of any measurement.
    stack: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    // Width from the caller (lockupGeometry): a computed box, not one the
    // layout pass has to resolve.
    wordmark: {
      marginTop: theme.spacing.md,
      color: theme.colors.textPrimary,
      textAlign: 'center',
    },
    tagline: {
      marginTop: 6,
      color: theme.colors.textMuted,
      textAlign: 'center',
    },
  });
