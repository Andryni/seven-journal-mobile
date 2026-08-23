import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { AnimatedNumberTicker } from '../ui/AnimatedNumberTicker';

interface RadialGaugeSpeedometerProps {
  value: number; // Current value (e.g. 68 for 68%)
  min?: number;
  max?: number;
  size?: number;
  label?: string;
  unit?: string;
  target?: number;
  zones?: { min: number; max: number; color: string }[];
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const RadialGaugeSpeedometer: React.FC<RadialGaugeSpeedometerProps> = ({
  value,
  min = 0,
  max = 100,
  size = 200,
  label = 'WIN RATE',
  unit = '%',
  target = 60,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const clampedVal = Math.min(Math.max(value, min), max);
  const percentage = (clampedVal - min) / (max - min || 1);

  // Gauge angles: 140° to 400° (total 260° sweep)
  const startAngle = 140;
  const totalSweep = 260;
  const radius = (size - 32) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;

  const animProgress = useSharedValue(0);

  useEffect(() => {
    animProgress.value = withSpring(percentage, {
      damping: 14,
      stiffness: 120,
      mass: 0.9,
    });
  }, [percentage]);

  const polarToCartesian = (centerX: number, centerY: number, r: number, angleInDegrees: number) => {
    'worklet';
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + r * Math.cos(angleInRadians),
      y: centerY + r * Math.sin(angleInRadians),
    };
  };

  const describeArc = (x: number, y: number, r: number, start: number, end: number) => {
    const startPoint = polarToCartesian(x, y, r, end);
    const endPoint = polarToCartesian(x, y, r, start);
    const largeArcFlag = end - start <= 180 ? '0' : '1';
    return `M ${startPoint.x} ${startPoint.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${endPoint.x} ${endPoint.y}`;
  };

  const bgTrackPath = describeArc(cx, cy, radius, startAngle, startAngle + totalSweep);

  const targetAngle = startAngle + ((target - min) / (max - min)) * totalSweep;
  const targetPointOuter = polarToCartesian(cx, cy, radius + 8, targetAngle);
  const targetPointInner = polarToCartesian(cx, cy, radius - 8, targetAngle);

  // Needle props animation
  const animatedNeedleProps = useAnimatedProps(() => {
    const currentAngle = startAngle + animProgress.value * totalSweep;
    const tip = polarToCartesian(cx, cy, radius - 14, currentAngle);
    return {
      x2: tip.x,
      y2: tip.y,
    };
  });

  const animatedBeaconProps = useAnimatedProps(() => {
    const currentAngle = startAngle + animProgress.value * totalSweep;
    const point = polarToCartesian(cx, cy, radius, currentAngle);
    return {
      cx: point.x,
      cy: point.y,
    };
  });

  return (
    <View style={[styles.container, { width: size, height: size * 0.78 }]}>
      <Svg width={size} height={size * 0.78}>
        <Defs>
          <LinearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={theme.colors.red} />
            <Stop offset="0.45" stopColor={theme.colors.gold} />
            <Stop offset="0.85" stopColor={theme.colors.green} />
          </LinearGradient>
        </Defs>

        {/* Background Track */}
        <Path
          d={bgTrackPath}
          fill="none"
          stroke={theme.colors.surface}
          strokeWidth="10"
          strokeLinecap="round"
        />

        {/* Active Gradient Track */}
        <Path
          d={bgTrackPath}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="8"
          strokeLinecap="round"
          opacity={0.85}
        />

        {/* Target Marker Pin */}
        <Line
          x1={targetPointInner.x}
          y1={targetPointInner.y}
          x2={targetPointOuter.x}
          y2={targetPointOuter.y}
          stroke={theme.colors.goldLight}
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Pulsing Beacon along Track */}
        <AnimatedCircle
          animatedProps={animatedBeaconProps}
          r={7}
          fill={percentage >= 0.5 ? theme.colors.greenLight : theme.colors.redLight}
          opacity={0.9}
        />
        <AnimatedCircle
          animatedProps={animatedBeaconProps}
          r={12}
          fill={percentage >= 0.5 ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}
        />

        {/* Center Pivot Circle */}
        <Circle cx={cx} cy={cy} r={6} fill={theme.colors.textPrimary} />
        <Circle cx={cx} cy={cy} r={12} fill="transparent" stroke={theme.colors.cardBorder} strokeWidth="2" />

        {/* Needle Line */}
        <AnimatedLine
          x1={cx}
          y1={cy}
          animatedProps={animatedNeedleProps}
          stroke={theme.colors.textPrimary}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </Svg>

      {/* Central Metrics Display */}
      <View style={[styles.metricsOverlay, { top: size * 0.38 }]}>
        <AnimatedNumberTicker
          value={value}
          suffix={unit}
          decimals={1}
          style={[
            styles.valueText,
            { color: percentage >= 0.5 ? theme.colors.greenLight : theme.colors.redLight },
          ]}
        />
        <Text style={styles.labelText}>{label}</Text>
        {target !== undefined && (
          <Text style={styles.targetText}>Target: {target}{unit}</Text>
        )}
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      position: 'relative',
    },
    metricsOverlay: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    valueText: {
      fontSize: 22,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    labelText: {
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      color: theme.colors.textSecondary,
      letterSpacing: 1,
      marginTop: 2,
    },
    targetText: {
      fontSize: 8,
      fontFamily: theme.fonts.monoMedium,
      color: theme.colors.goldLight,
      marginTop: 2,
    },
  });
