import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Image, Animated, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { BrandWordmark } from '../brand/BrandWordmark';
import {
  BOOT_TAGLINE,
  BOOT_WORDMARK,
  BRAND_TAGLINE,
  bootLockupLines,
  lockupBoxWidth,
} from '../brand/lockupGeometry';
import { SpacedLabel } from '../ui/SpacedLabel';

interface AnimatedSplashScreenProps {
  onAnimationFinish: () => void;
  /**
   * Whether the Google fonts have finished loading. The wordmark and tagline
   * are not MOUNTED before that -- see the note in the body: they used to be
   * mounted and merely hidden, which laid them out in the fallback font and
   * left the layout cache describing a narrower run of glyphs than the real
   * face paints. That is the reported "the L of JOURNAL / the word TERMINAL
   * sometimes vanish", and it is why the mark alone holds the screen until
   * the fonts are in.
   */
  fontsReady?: boolean;
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
  fontsReady = true,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();

  // Same scale rule as BootScreen, so the mark never jumps between the two.
  const markSize = Math.max(72, Math.min(120, width * 0.2));

  // The box both brand lines are given: the screen, floored at the worst-case
  // width of the runs. Computed, never measured -- see lockupGeometry.
  const lockupWidth = useMemo(
    () => lockupBoxWidth(width - theme.spacing.lg * 2, bootLockupLines()),
    [width, theme.spacing.lg]
  );

  useEffect(() => {
    /**
     * The whole app waits on this callback, so it must not be the only way out.
     *
     * Animated.start(cb) does not guarantee the callback runs: if the
     * animation is interrupted -- Android backgrounding the app during launch,
     * the driver being torn down, a dropped frame batch -- it simply never
     * fires. splashFinished then stays false forever and the app sits on the
     * logo. That is the intermittent freeze, and it survived the earlier
     * session-loading fix because it has nothing to do with the session.
     *
     * A single guarded `done` is called by whichever comes first: the
     * animation or a hard ceiling slightly longer than its own duration.
     */
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onAnimationFinish();
    };

    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
      // Long enough to read the mark and wordmark; short enough to not stall.
      Animated.delay(900),
      Animated.timing(opacity, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]);

    anim.start(finish);
    // 320 + 900 + 280 = 1500ms of animation; 2200 leaves slack for a slow
    // first frame without being a perceptible wait if the callback is lost.
    const failsafe = setTimeout(finish, 2200);

    return () => {
      clearTimeout(failsafe);
      anim.stop();
      // Unmounting must still release the gate: React may remount this
      // component, and a second splash cycle is far better than a dead app.
      finish();
    };
  }, [opacity, onAnimationFinish]);

  return (
    <View style={styles.container}>
      <Animated.View
        style={{
          opacity,
          flex: 1,
          alignSelf: 'stretch',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <View style={styles.stack}>
          {/* Vector, not the PNG: a bitmap has to be decoded before it can be
              shown, which is exactly the moment the user saw a blank frame. */}
          <Image
            source={require('../../assets/seven_tracking_logo.png')}
            style={{ width: markSize, height: markSize }}
            resizeMode="contain"
          />
          {/* The mark needs no font and shows immediately. The text is not
              rendered until fontsReady, and hidden would not be enough: a
              mounted-but-transparent Text is still MEASURED, and the family
              name does not change when the font file finally lands, so the
              stale (fallback-font) layout survives and clips the tail of the
              real face. Not mounting it is the only version of this that
              cannot happen. */}
          {fontsReady ? (
            <>
              <BrandWordmark
                fontSize={BOOT_WORDMARK.fontSize}
                fontFamily={theme.fonts.monoBold}
                letterSpacing={BOOT_WORDMARK.letterSpacing}
                maxFontSizeMultiplier={1.3}
                style={[styles.wordmark, { width: lockupWidth }]}
              />
              {/* SpacedLabel, not a bare Text: the trailing letter-spacing gap
                  is unmeasured on Android and the final L of TERMINAL was the
                  reported casualty. Same cure as the wordmark's JOURNAL. */}
              <SpacedLabel
                fontSize={BOOT_TAGLINE.fontSize}
                fontFamily={theme.fonts.mono}
                letterSpacing={BOOT_TAGLINE.letterSpacing}
                maxFontSizeMultiplier={1.3}
                style={[styles.tagline, { width: lockupWidth }]}
              >
                {BRAND_TAGLINE}
              </SpacedLabel>
            </>
          ) : null}
        </View>
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
    // Mirrors BootScreen's stack so the two boot surfaces read as one screen
    // when the splash hands over to it.
    //
    // alignSelf stretch + padding, never a content-sized column: a text child
    // of a shrink-to-fit parent is measured against a width the parent itself
    // is deriving from that measurement, and any stale value clips the tail.
    stack: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    // Width comes from the caller (lockupGeometry), never from '100%' of a
    // parent: the parent's width is itself resolved by a layout pass, and a
    // resolved width is what cut the tail off this brand the first time.
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
