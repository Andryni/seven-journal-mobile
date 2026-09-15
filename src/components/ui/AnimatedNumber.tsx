import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp, Animated } from 'react-native';
import { duration as motionDuration, easing } from '../../theme/motion';

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
      easing: easing.out.factory(),
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
