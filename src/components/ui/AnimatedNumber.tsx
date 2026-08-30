import React, { useEffect, useRef, useState } from 'react';
import { Text, TextStyle, StyleProp, Animated, Easing } from 'react-native';

interface AnimatedNumberProps {
  /** Target numeric value to animate to */
  value: number;
  /** Formats the animated value into the displayed string */
  format?: (v: number) => string;
  style?: StyleProp<TextStyle>;
  /** Animation duration in ms (default 800) */
  duration?: number;
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
  duration = 800,
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
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      fromRef.current = value;
      setDisplay(format(value));
    });

    return () => animated.removeListener(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return <Text style={style}>{display}</Text>;
};
