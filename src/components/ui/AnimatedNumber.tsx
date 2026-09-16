import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp, Animated } from 'react-native';
import { duration as motionDuration, easing } from '../../theme/motion';

/**
 * Reanimated's Easing.bezier returns a FACTORY ({ factory(): fn }), because
 * the curve is built on the UI thread; RN's Animated.timing wants the plain
 * `(v: number) => number`. Unwrap `.factory()` when present — and unwrap
 * again if the factory itself returns a factory (true in the test shim).
 * (Calling `.factory()` unconditionally threw on every mount — a failure the
 * fabric error reporter swallowed until the ErrorEvent shim exposed it.)
 */
function toRnCurve(value: unknown): (v: number) => number {
  let current: unknown = value;
  for (let depth = 0; depth < 4; depth++) {
    if (typeof current === 'function') return current as (v: number) => number;
    const candidate = current as { factory?: () => unknown } | null;
    if (candidate && typeof candidate.factory === 'function') {
      current = candidate.factory();
      continue;
    }
    break;
  }
  // Unreachable with a real easing; fall back to linear rather than crash.
  return (v: number) => v;
}

const rnCurve = toRnCurve(easing.out);

interface AnimatedNumberProps {
  /** Target numeric value to animate to */
  value: number;
  /** Formats the animated value into the displayed string */
  format?: (v: number) => string;
  style?: StyleProp<TextStyle>;
  /** Animation duration in ms. Defaults to the motion system's `slow`. */
  duration?: number;
  /** Extra props forwarded to the underlying Text (numberOfLines, etc). */
  numberOfLines?: number;
  adjustsFontSizeToFit?: boolean;
  minimumFontScale?: number;
}

/**
 * Terminal-style counting number.
 * Animates from the previously displayed value to the new one
 * (e.g. P&L rolling up like a Bloomberg ticker).
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  format = (v) => v.toFixed(2),
  style,
  duration = motionDuration.slow,
  numberOfLines,
  adjustsFontSizeToFit,
  minimumFontScale,
}) => {
  const animated = useRef(new Animated.Value(0)).current;
  const fromRef = useRef(0);
  const [display, setDisplay] = useState(() => format(0));

  useEffect(() => {
    const from = fromRef.current;
    animated.setValue(0);

    const id = animated.addListener(({ value: p }) => {
      setDisplay(format(from + (value - from) * p));
    });

    Animated.timing(animated, {
      toValue: 1,
      duration,
      // Shared curve from the motion system: data settles, never overshoots.
      easing: rnCurve,
      useNativeDriver: false,
    }).start(() => {
      fromRef.current = value;
      setDisplay(format(value));
    });

    return () => animated.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      adjustsFontSizeToFit={adjustsFontSizeToFit}
      minimumFontScale={minimumFontScale}
    >
      {display}
    </Text>
  );
};
