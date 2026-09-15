import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  /** Text displayed in the middle of the donut (e.g. total count) */
  centerLabel?: string;
  centerSub?: string;
}

/**
 * Custom animated SVG donut — replaces the heavy react-native-chart-kit
 * PieChart dependency. Slices sweep in on mount, legend shows counts + %.
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 150,
  strokeWidth = 20,
  centerLabel,
  centerSub,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const total = data.reduce((s, d) => s + Math.max(d.value, 0), 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = 0;
    sweep.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.map(d => d.value).join(',')]);

  // Precompute slice offsets
  let acc = 0;
  const slices = data
    .filter(d => d.value > 0)
    .map(d => {
      const fraction = d.value / total;
      const slice = { ...d, fraction, start: acc };
      acc += fraction;
      return slice;
    });

  return (
    <View style={styles.row}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} originX={size / 2} originY={size / 2}>
            {/* Track */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={theme.colors.surface}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {slices.map((s, i) => (
              <DonutSliceArc
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                circumference={circumference}
                fraction={s.fraction}
                start={s.start}
                color={s.color}
                strokeWidth={strokeWidth}
                sweep={sweep}
              />
            ))}
          </G>
        </Svg>
        {(centerLabel || centerSub) && (
          <View style={styles.center}>
            {centerLabel ? <Text style={styles.centerLabel}>{centerLabel}</Text> : null}
            {centerSub ? <Text style={styles.centerSub}>{centerSub}</Text> : null}
          </View>
        )}
      </View>

      {/* Legend lists EVERY category, including the empty ones.
          It used to render `slices`, which drops zero-value entries because a
          0% arc cannot be drawn. That is right for the ring and wrong for the
          legend: a missing "BE" row reads as "this app does not track
          breakeven", when the honest answer is "you have none". */}
      <View style={styles.legend}>
        {data.map((d, i) => {
          const fraction = total > 0 ? d.value / total : 0;
          const isEmpty = d.value === 0;
          return (
            <View key={i} style={styles.legendRow}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: d.color, opacity: isEmpty ? 0.3 : 1 },
                ]}
              />
              <Text
                style={[styles.legendLabel, isEmpty && styles.legendEmpty]}
                numberOfLines={1}
              >
                {d.label}
              </Text>
              <Text
                style={[
                  styles.legendVal,
                  { color: d.color },
                  isEmpty && styles.legendEmpty,
                ]}
              >
                {d.value} · {(fraction * 100).toFixed(0)}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const DonutSliceArc: React.FC<{
  cx: number;
  cy: number;
  r: number;
  circumference: number;
  fraction: number;
  start: number;
  color: string;
  strokeWidth: number;
  sweep: SharedValue<number>;
}> = ({ cx, cy, r, circumference, fraction, start, color, strokeWidth, sweep }) => {
  const animatedProps = useAnimatedProps(() => {
    const visible = Math.max(0, Math.min(fraction, sweep.value - start));
    return {
      strokeDashoffset: circumference * (1 - visible),
    };
  });

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      r={r}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      fill="none"
      strokeDasharray={`${circumference} ${circumference}`}
      animatedProps={animatedProps}
      rotation={start * 360}
      originX={cx}
      originY={cy}
    />
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.lg,
    },
    center: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    centerLabel: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    centerSub: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    legend: {
      flex: 1,
      gap: theme.spacing.sm,
    },
    legendEmpty: {
      color: theme.colors.textMuted,
    },
    legendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 9,
      height: 9,
      borderRadius: 3,
    },
    legendLabel: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: theme.fonts.sansSemiBold,
      flex: 1,
    },
    legendVal: {
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
  });
