import React, { useEffect, useRef } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';

/**
 * Horizontal shake, replayed whenever `trigger` changes to a new truthy value.
 *
 * A static red box says "there is a message"; a shake says "your action was
 * rejected, look here" — motion is what the eye actually catches when the
 * keyboard is up and the thumb is about to retry. The amplitude ramps down
 * (8→1px) so it reads as damping, not a stuck buzzer.
 */
export const ShakeOn: React.FC<{
  /** Any changing value; the shake replays each time it becomes truthy. */
  trigger: string | number | boolean | null | undefined;
  children: React.ReactNode;
}> = ({ trigger, children }) => {
  const x = useSharedValue(0);
  const lastRef = useRef<string | number | boolean | null | undefined>(undefined);

  useEffect(() => {
    if (!trigger || trigger === lastRef.current) return;
    lastRef.current = trigger;
    x.value = withSequence(
      withTiming(-7, { duration: 55 }),
      withTiming(6, { duration: 55 }),
      withTiming(-4, { duration: 55 }),
      withTiming(3, { duration: 55 }),
      withTiming(-1, { duration: 55 }),
      withTiming(0, { duration: 55 })
    );
  }, [trigger, x]);

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return <Animated.View style={style}>{children}</Animated.View>;
};
