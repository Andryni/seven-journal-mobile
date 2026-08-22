import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
  amount?: string; // e.g. "$1,234"
}

interface DonutChartProps {
  data: DonutSlice[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

/** Convert polar to cartesian for SVG arc */
const polarToCartesian = (
  cx: number, cy: number, r: number, angleDeg: number,
) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

/** SVG arc path */
const describeArc = (
  cx: number, cy: number, r: number, startAngle: number, endAngle: number,
): string => {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.99) {
    // Full circle — draw two half-arcs
    const mid = startAngle + 180;
    const a = polarToCartesian(cx, cy, r, startAngle);
    const b = polarToCartesian(cx, cy, r, mid);
    return [
      `M ${a.x} ${a.y}`,
      `A ${r} ${r} 0 1 1 ${b.x} ${b.y}`,
      `A ${r} ${r} 0 1 1 ${a.x} ${a.y}`,
    ].join(' ');
  }
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArc = sweep > 180 ? 1 : 0;
  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`,
  ].join(' ');
};

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 180,
  strokeWidth = 28,
  centerLabel,
  centerValue,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const total = data.reduce((s, d) => s + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;

  // Build arc slices
  let currentAngle = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const angle = total > 0 ? (d.value / total) * 360 : 0;
      const start = currentAngle;
      currentAngle += angle;
      return { ...d, startAngle: start, endAngle: currentAngle, angle };
    });

  return (
    <View style={styles.container}>
      {/* Donut SVG */}
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          {/* Background ring */}
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={theme.colors.cardBorder}
            strokeWidth={strokeWidth}
            opacity={0.3}
          />
          {/* Data arcs */}
          {slices.map((slice, i) => (
            <Path
              key={i}
              d={describeArc(cx, cy, r, slice.startAngle, slice.endAngle)}
              fill="none"
              stroke={slice.color}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
            />
          ))}
        </Svg>

        {/* Center text */}
        <View style={styles.centerContainer}>
          {centerValue && (
            <Text style={styles.centerValue}>{centerValue}</Text>
          )}
          {centerLabel && (
            <Text style={styles.centerLabel}>{centerLabel}</Text>
          )}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {data
          .filter((d) => d.value > 0)
          .map((d, i) => {
            const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : '0.0';
            return (
              <View key={i} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: d.color }]} />
                <View style={styles.legendText}>
                  <Text style={styles.legendLabel}>{d.label}</Text>
                  <Text style={styles.legendDetail}>
                    {d.amount || d.value} · {pct}%
                  </Text>
                </View>
              </View>
            );
          })}
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      paddingVertical: 8,
    },
    centerContainer: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
    },
    centerValue: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily: theme.fonts.monoExtraBold,
      letterSpacing: -0.5,
    },
    centerLabel: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
      marginTop: 2,
    },
    legend: {
      flex: 1,
      gap: 10,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      flex: 1,
    },
    legendLabel: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontFamily: theme.fonts.sansBold,
    },
    legendDetail: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.monoMedium,
      marginTop: 1,
    },
  });
