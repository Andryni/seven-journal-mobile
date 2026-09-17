import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Easing } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';

/**
 * The "the coach is working" state.
 *
 * Two layers, because a spinner says "something is happening" while a trader
 * waiting on an answer wants "what is it doing now". The dots pulse like the
 * CandleLoader (same visual language), and below them the status word
 * advances through real phases of the request: reading the journal,
 * comparing, writing. ~1.4s per word: long enough to be read, short enough
 * to feel alive. Words cycle i18n-driven; if the answer lands early the
 * component unmounts mid-cycle, which is fine — it is pure presentation.
 */

/** Status words shown in rotation while the request is in flight. */
const WORD_KEYS = ['thinkingReading', 'thinkingComparing', 'thinkingWriting'] as const;

/** Milliseconds each status word stays on screen. */
const WORD_MS = 1400;
/** Stagger between the three dots. */
const DOT_STAGGER_MS = 160;

const Dot: React.FC<{ theme: AppTheme; index: number }> = ({ theme, index }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    // One pulse every ~900ms per dot, staggered, unbounded repeat — the
    // component lives only while the request does.
    progress.value = withDelay(
      index * DOT_STAGGER_MS,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 480, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
  }, [progress, index]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0.25, 1]),
    transform: [{ translateY: interpolate(progress.value, [0, 1], [0, -3]) }],
  }));

  return (
    <Animated.View
      style={[
        {
          width: 5,
          height: 9,
          borderRadius: 1.5,
          backgroundColor: theme.colors.primaryLight,
        },
        style,
      ]}
    />
  );
};

export const ThinkingIndicator: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhase(p => (p + 1) % WORD_KEYS.length), WORD_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <View
      style={styles.wrap}
      accessibilityRole="text"
      accessibilityLabel={t('thinkingA11y')}
      accessibilityLiveRegion="polite"
    >
      <View style={styles.dotsRow}>
        <Dot theme={theme} index={0} />
        <Dot theme={theme} index={1} />
        <Dot theme={theme} index={2} />
      </View>
      <Text style={styles.word}>{t(WORD_KEYS[phase])}</Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 12,
      backgroundColor: theme.colors.surface,
      gap: 6,
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
    },
    word: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.5,
    },
  });
