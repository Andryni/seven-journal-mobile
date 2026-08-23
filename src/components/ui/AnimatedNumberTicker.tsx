import React, { useEffect, useState } from 'react';
import { Text, TextStyle, StyleSheet } from 'react-native';

interface AnimatedNumberTickerProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  style?: TextStyle | TextStyle[];
  duration?: number;
}

export const AnimatedNumberTicker: React.FC<AnimatedNumberTickerProps> = ({
  value,
  prefix = '',
  suffix = '',
  decimals = 2,
  style,
  duration = 600,
}) => {
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const endValue = value;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (endValue - startValue) * easeOut;
      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [value, duration]);

  const formatted = displayValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <Text style={[styles.text, style]}>
      {prefix}{formatted}{suffix}
    </Text>
  );
};

const styles = StyleSheet.create({
  text: {
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
