import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { BootScreen } from './BootScreen';

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
  const { width } = useWindowDimensions();

  // Same scale rule as BootScreen, so the mark never jumps between the two.
  const markSize = Math.max(72, Math.min(120, width * 0.2));

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
      <Animated.View style={{ opacity, flex: 1, alignSelf: 'stretch' }}>
        {/* Vector, not the PNG: a bitmap has to be decoded before it can be
            shown, which is exactly the moment the user saw a blank frame. */}
        <BootScreen />
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
  });
