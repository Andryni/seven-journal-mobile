import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, PanResponder } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { duration as motionDuration, easing as motionEasing } from '../../theme/motion';
import { formatCurrency } from '../../utils/formatCurrency';
import { buildAxis, downsample, nearestIndex, smoothPath } from '../../utils/chartScale';
import { hapticLight } from '../../utils/haptics';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  G,
} from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface GlowingEquityAreaChartProps {
  /** Currency symbol for the axis and tooltip. Defaults to '$'. */
  symbol?: string;
  data: { date: string; value: number }[];
  height?: number;
  width?: number;
  /**
   * Forces the curve colour. A drawdown series is never good news, but its
   * last value is 0 whenever the account sits at a new high, and "0 >= 0"
   * painted the whole chart green. Callers plotting a loss-only series pass
   * 'negative' so the colour states what the data means.
   */
  tone?: 'auto' | 'negative' | 'positive';
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
  symbol = '$',
  height = 200,
  width = Dimensions.get('window').width - 64,
  tone = 'auto',
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
      duration: motionDuration.deliberate,
      easing: motionEasing.out,
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

  // Reveal via a container fade rather than an animated <ClipPath>. Under
  // Reanimated 4 the clip rect kept its initial zero width on device, so the
  // curve, its glow and the area fill were all clipped away: the card showed
  // axes and a tooltip over an empty frame. The live ring sat outside the clip
  // group, which is why a single dot remained visible.
  const revealStyle = useAnimatedStyle(() => ({ opacity: reveal.value }));

  const pulseRingProps = useAnimatedProps(() => ({
    r: 5 + pulse.value * 8,
    opacity: 0.6 * (1 - pulse.value),
  }));

  // Hooks must run unconditionally, so the responder is created before the
  // empty-data bail-out and reads its bounds from a ref.
  const scrubBounds = React.useRef({ width: 1, count: 0 });
  const scrubResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: evt => {
          const { width, count } = scrubBounds.current;
          const idx = nearestIndex(evt.nativeEvent.locationX, width, count);
          if (idx >= 0) {
            setSelectedIndex(idx);
            hapticLight();
          }
        },
        onPanResponderMove: evt => {
          const { width, count } = scrubBounds.current;
          const idx = nearestIndex(evt.nativeEvent.locationX, width, count);
          setSelectedIndex(prev => {
            // Only buzz when the selection actually changes, otherwise the
            // phone vibrates continuously for the whole drag.
            if (idx !== prev && idx >= 0) hapticLight();
            return idx >= 0 ? idx : prev;
          });
        },
        // Deliberately no reset on release: leaving the readout on the last
        // inspected point is what lets someone read the number after lifting.
      }),
    []
  );

  if (!data || data.length === 0) return null;

  // A 900-trade curve is three SVG nodes per pixel and renders as a slab; the
  // shape survives far fewer points, and scrubbing stays responsive.
  const plotted = downsample(data, 120);

  const values = plotted.map(d => d.value);
  // Round axis bounds, always including zero. The old code used
  // `Math.max(10, ...)`, so an account that never cleared $10 got an axis
  // three times taller than its own data and a curve pinned to the floor.
  const axis = buildAxis(values, 4);
  const minVal = axis.min;
  const maxVal = axis.max;
  const range = maxVal - minVal || 1;

  const isOverallPositive =
    tone === 'auto' ? (values[values.length - 1] ?? 0) >= 0 : tone === 'positive';
  const mainColor = isOverallPositive ? theme.colors.green : theme.colors.red;
  const mainColorLight = isOverallPositive ? theme.colors.greenLight : theme.colors.redLight;

  const points = plotted.map((d, i) => {
    const x = (i / Math.max(plotted.length - 1, 1)) * chartW;
    const y = paddingTop + chartH - ((d.value - minVal) / range) * chartH;
    return { x, y, value: d.value, date: d.date, index: i + 1 };
  });

  // Catmull-Rom rather than midpoint handles: the old curve derived its
  // control points from the segment alone, so a single spike made the line
  // overshoot and dip below an axis the data never actually crossed.
  const linePath = smoothPath(points, 0.5);

  const zeroY = paddingTop + chartH - ((0 - minVal) / range) * chartH;
  const bottomY = paddingTop + chartH;
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;

  // Keep the responder's geometry in sync with what is actually drawn.
  scrubBounds.current = { width: chartW, count: points.length };

  const lastPoint = points[points.length - 1];
  // A stale index survives a data refresh (fewer points than before), which
  // would index past the end and crash on activePoint.value.
  const safeIndex =
    selectedIndex !== null && selectedIndex < points.length ? selectedIndex : null;
  const activePoint = safeIndex !== null ? points[safeIndex] : lastPoint;
  const isCrosshairVisible = safeIndex !== null;

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

  // Decimals come from the axis step, not a constant: on a sub-unit scale
  // (a small drawdown curve) rounding to 0 made adjacent ticks print the
  // same label. Compact mode still collapses thousands to "12k".
  const formatCompact = (val: number) =>
    formatCurrency(val, {
      symbol,
      compact: true,
      decimals: Math.abs(val) >= 1000 ? 0 : axis.decimals,
    });

  return (
    <View style={{ width }}>
      {/* Readout in normal flow, above the plot. Pinned absolutely inside the
          canvas it ran past the card's right edge and the amount was clipped
          mid-digit -- the longer the number, the more was lost. */}
      {activePoint && (
        <View style={styles.readout}>
          <Text style={styles.readoutDate} numberOfLines={1}>
            #{activePoint.index} · {activePoint.date}
          </Text>
          <Text
            style={[
              styles.readoutVal,
              activePoint.value >= 0 ? styles.greenText : styles.redText,
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {formatCurrency(activePoint.value, { symbol })}
          </Text>
        </View>
      )}

      <View style={[styles.container, { width, height }]}>

      <View style={styles.chartRow}>
        {/* Y-Axis: one label per round tick from the shared scale, instead of
            the raw min/max which produced labels like "$1,247.33". */}
        <View style={[styles.yAxisContainer, { height }]}>
          {axis.ticks.map(tick => {
            const y = paddingTop + chartH - axis.normalize(tick) * chartH;
            const isZero = tick === 0;
            return (
              <Text
                key={tick}
                style={[
                  styles.yAxisLabel,
                  { position: 'absolute', right: 8, top: y - 7 },
                  isZero && styles.yAxisZeroTick,
                  tick < 0 && styles.redText,
                ]}
                numberOfLines={1}
              >
                {isZero ? `${symbol}0` : formatCompact(tick)}
              </Text>
            );
          })}
        </View>

        <Animated.View style={[{ width: chartW + paddingRight, height }, revealStyle]}>
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
            </Defs>

            {/* Grid: a faint line per axis tick, so the eye can read a value
                off the curve without a crosshair. */}
            {axis.ticks.map(tick => {
              const y = paddingTop + chartH - axis.normalize(tick) * chartH;
              if (tick === 0) return null;
              return (
                <Line
                  key={`grid-${tick}`}
                  x1={0}
                  y1={y}
                  x2={chartW}
                  y2={y}
                  stroke={theme.colors.cardBorder}
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />
              );
            })}
            <Line x1={0} y1={paddingTop} x2={chartW} y2={paddingTop} stroke={theme.colors.cardBorder} strokeWidth="1" />
            <Line x1={0} y1={zeroY} x2={chartW} y2={zeroY} stroke={theme.colors.borderBright} strokeWidth="1" strokeDasharray="4 4" />
            <Line x1={0} y1={bottomY} x2={chartW} y2={bottomY} stroke={theme.colors.cardBorder} strokeWidth="1" />

            {/* Everything data-driven is revealed left → right */}
            <G>
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
              fill={activePoint.value >= 0 ? withAlpha(theme.colors.green, 0.3) : withAlpha(theme.colors.red, 0.3)}
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

          {/* Scrub layer.
              This used to be one TouchableOpacity per point -- up to 120 views
              stacked over the plot, each needing a discrete tap on a ~3px
              target. Dragging did nothing, and tapping mostly missed. A single
              responder tracks the finger and snaps to the nearest point. */}
          <View
            style={[StyleSheet.absoluteFill, { width: chartW }]}
            {...scrubResponder.panHandlers}
          />
        </Animated.View>
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
  yAxisZeroTick: {
    color: theme.colors.textSecondary,
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
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    textAlign: 'center',
    width: 42,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  readoutDate: {
    flexShrink: 1,
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
  },
  readoutVal: {
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  greenText: { color: theme.colors.green },
  redText: { color: theme.colors.red },
});
