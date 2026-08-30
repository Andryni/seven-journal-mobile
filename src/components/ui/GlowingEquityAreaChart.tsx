import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { formatCurrency } from '../../utils/formatCurrency';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  G,
  ClipPath,
  Rect,
} from 'react-native-svg';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface GlowingEquityAreaChartProps {
  data: { date: string; value: number }[];
  height?: number;
  width?: number;
}

/**
 * Terminal equity curve:
 * - left-to-right draw-in reveal animation on mount / data change
 * - true neon glow (3 stacked strokes: halo, mid, core)
 * - crosshair on the selected point
 * - pulsing "live" ring on the latest point
 */
export const GlowingEquityAreaChart: React.FC<GlowingEquityAreaChartProps> = ({
  data,
  height = 200,
  width = Dimensions.get('window').width - 64,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const yAxisWidth = 56;
  const paddingRight = 16;
  const paddingTop = 28;
  const paddingBottom = 26;

  const chartW = width - yAxisWidth - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  // ── Animations (hooks must run unconditionally) ──
  const reveal = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: 1100,
      easing: Easing.out(Easing.cubic),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.length]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 0 })
      ),
      -1
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clipProps = useAnimatedProps(() => ({
    width: reveal.value * (chartW + paddingRight),
  }));

  const pulseRingProps = useAnimatedProps(() => ({
    r: 5 + pulse.value * 8,
    opacity: 0.6 * (1 - pulse.value),
  }));

  if (!data || data.length === 0) return null;

  const values = data.map(d => d.value);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(10, ...values);
  const range = maxVal - minVal || 1;

  const isOverallPositive = (values[values.length - 1] ?? 0) >= 0;
  const mainColor = isOverallPositive ? theme.colors.green : theme.colors.red;
  const mainColorLight = isOverallPositive ? theme.colors.greenLight : theme.colors.redLight;

  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * chartW;
    const y = paddingTop + chartH - ((d.value - minVal) / range) * chartH;
    return { x, y, value: d.value, date: d.date, index: i + 1 };
  });

  // Smooth bezier path
  const linePath = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (p.x - prev.x) / 2;
    const cy2 = p.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
  }, '');

  const zeroY = paddingTop + chartH - ((0 - minVal) / range) * chartH;
  const bottomY = paddingTop + chartH;
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;

  const lastPoint = points[points.length - 1];
  const activePoint = selectedIndex !== null ? points[selectedIndex] : lastPoint;
  const isCrosshairVisible = selectedIndex !== null;

  // Pick well-spaced X labels
  const sampleIndices = new Set<number>();
  const maxLabels = Math.min(5, points.length);
  if (points.length <= maxLabels) {
    points.forEach((_, i) => sampleIndices.add(i));
  } else {
    const step = Math.floor((points.length - 1) / (maxLabels - 1));
    for (let i = 0; i < maxLabels; i++) {
      const idx = i === maxLabels - 1 ? points.length - 1 : i * step;
      sampleIndices.add(idx);
    }
  }

  const formatCompact = (val: number) => formatCurrency(val, { compact: true, decimals: 0 });

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Tooltip */}
      {activePoint && (
        <View style={styles.tooltipBadge}>
          <Text style={styles.tooltipDate}>
            Trade #{activePoint.index} · {activePoint.date}
          </Text>
          <Text
            style={[
              styles.tooltipVal,
              activePoint.value >= 0 ? styles.greenText : styles.redText,
            ]}
          >
            {formatCurrency(activePoint.value)}
          </Text>
        </View>
      )}

      <View style={styles.chartRow}>
        {/* Y-Axis native labels */}
        <View style={[styles.yAxisContainer, { height }]}>
          <Text style={[styles.yAxisLabel, styles.yAxisTop]}>
            {formatCompact(maxVal)}
          </Text>
          <Text style={[styles.yAxisLabel, styles.yAxisZero, { top: zeroY - 7 }]}>
            $0
          </Text>
          {minVal < 0 && (
            <Text style={[styles.yAxisLabel, styles.yAxisBottom, styles.redText]}>
              {formatCompact(minVal)}
            </Text>
          )}
        </View>

        <View style={{ width: chartW + paddingRight, height }}>
          <Svg width={chartW + paddingRight} height={height}>
            <Defs>
              <LinearGradient id="equityGradGreen" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.green} stopOpacity="0.45" />
                <Stop offset="0.8" stopColor={theme.colors.green} stopOpacity="0.02" />
              </LinearGradient>
              <LinearGradient id="equityGradRed" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.red} stopOpacity="0.45" />
                <Stop offset="0.8" stopColor={theme.colors.red} stopOpacity="0.02" />
              </LinearGradient>
              <ClipPath id="revealClip">
                <AnimatedRect x="0" y="0" height={height} animatedProps={clipProps} />
              </ClipPath>
            </Defs>

            {/* Grid */}
            <Line x1={0} y1={paddingTop} x2={chartW} y2={paddingTop} stroke={theme.colors.cardBorder} strokeWidth="1" />
            <Line x1={0} y1={zeroY} x2={chartW} y2={zeroY} stroke={theme.colors.borderBright} strokeWidth="1" strokeDasharray="4 4" />
            <Line x1={0} y1={bottomY} x2={chartW} y2={bottomY} stroke={theme.colors.cardBorder} strokeWidth="1" />

            {/* Everything data-driven is revealed left → right */}
            <G clipPath="url(#revealClip)">
              {/* Area fill */}
              <Path
                d={fillPath}
                fill={isOverallPositive ? 'url(#equityGradGreen)' : 'url(#equityGradRed)'}
              />

              {/* True neon glow: halo → mid → core */}
              <Path d={linePath} fill="none" stroke={mainColor} strokeWidth="9" strokeOpacity="0.10" strokeLinecap="round" />
              <Path d={linePath} fill="none" stroke={mainColor} strokeWidth="5" strokeOpacity="0.22" strokeLinecap="round" />
              <Path d={linePath} fill="none" stroke={mainColorLight} strokeWidth="2.2" strokeLinecap="round" />

              {/* Sample dots */}
              {points.map((p, i) =>
                sampleIndices.has(i) && i !== points.length - 1 ? (
                  <Circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={2.5}
                    fill={p.value >= 0 ? theme.colors.green : theme.colors.red}
                    opacity={0.6}
                  />
                ) : null
              )}
            </G>

            {/* Crosshair on selection */}
            {isCrosshairVisible && (
              <G>
                <Line
                  x1={activePoint.x}
                  y1={paddingTop}
                  x2={activePoint.x}
                  y2={bottomY}
                  stroke={theme.colors.borderBright}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                <Line
                  x1={0}
                  y1={activePoint.y}
                  x2={chartW}
                  y2={activePoint.y}
                  stroke={theme.colors.borderBright}
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
              </G>
            )}

            {/* Pulsing live ring on the last point */}
            <AnimatedCircle
              cx={lastPoint.x}
              cy={lastPoint.y}
              fill="none"
              stroke={mainColor}
              strokeWidth="1.5"
              animatedProps={pulseRingProps}
            />

            {/* Active point marker */}
            <Circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={9}
              fill={activePoint.value >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}
            />
            <Circle
              cx={activePoint.x}
              cy={activePoint.y}
              r={5}
              fill={activePoint.value >= 0 ? theme.colors.green : theme.colors.red}
              stroke={theme.colors.background}
              strokeWidth="2"
            />
          </Svg>

          {/* X-Axis labels */}
          <View style={[styles.xAxisContainer, { width: chartW }]}>
            {points.map((p, i) => {
              if (!sampleIndices.has(i)) return null;
              return (
                <Text
                  key={i}
                  style={[
                    styles.xAxisLabel,
                    { left: Math.max(0, Math.min(chartW - 30, p.x - 15)) },
                  ]}
                >
                  {p.date}
                </Text>
              );
            })}
          </View>

          {/* Touch zones */}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', width: chartW }]}>
            {points.map((_, i) => (
              <TouchableOpacity
                key={i}
                style={{ flex: 1, height: '100%' }}
                onPress={() => setSelectedIndex(selectedIndex === i ? null : i)}
                activeOpacity={1}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.chartBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    overflow: 'hidden',
    position: 'relative',
    paddingVertical: 4,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisContainer: {
    width: 56,
    paddingRight: 6,
    position: 'relative',
    justifyContent: 'space-between',
  },
  yAxisLabel: {
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    color: theme.colors.textSecondary,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  yAxisTop: {
    position: 'absolute',
    top: 22,
    right: 6,
    color: theme.colors.greenLight,
  },
  yAxisZero: {
    position: 'absolute',
    right: 6,
    color: theme.colors.textMuted,
  },
  yAxisBottom: {
    position: 'absolute',
    bottom: 24,
    right: 6,
  },
  xAxisContainer: {
    position: 'absolute',
    bottom: 4,
    height: 16,
  },
  xAxisLabel: {
    position: 'absolute',
    color: theme.colors.textMuted,
    fontSize: 7,
    fontFamily: theme.fonts.monoBold,
    textAlign: 'center',
    width: 42,
  },
  tooltipBadge: {
    position: 'absolute',
    top: 6,
    right: 12,
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.borderBright,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    zIndex: 20,
  },
  tooltipDate: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
  },
  tooltipVal: {
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  greenText: { color: theme.colors.green },
  redText: { color: theme.colors.red },
});
