import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  G,
} from 'react-native-svg';

interface GlowingEquityAreaChartProps {
  data: { date: string; value: number }[];
  height?: number;
  width?: number;
}

export const GlowingEquityAreaChart: React.FC<GlowingEquityAreaChartProps> = ({
  data,
  height = 200,
  width = Dimensions.get('window').width - 64,
}) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const yAxisWidth = 56;
  const paddingRight = 16;
  const paddingTop = 28;
  const paddingBottom = 26;

  const chartW = width - yAxisWidth - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const values = data.map(d => d.value);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(10, ...values);
  const range = maxVal - minVal || 1;

  const isOverallPositive = (values[values.length - 1] ?? 0) >= 0;
  const mainColor = isOverallPositive ? '#10b981' : '#ef4444';

  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * chartW;
    const y = paddingTop + chartH - ((d.value - minVal) / range) * chartH;
    return { x, y, value: d.value, date: d.date, index: i + 1 };
  });

  // Build SVG Path with smooth curves
  const linePath = points.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const prev = arr[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 2;
    const cy1 = prev.y;
    const cx2 = prev.x + (p.x - prev.x) / 2;
    const cy2 = p.y;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.y}`;
  }, '');

  // Fill Path closed to bottom
  const zeroY = paddingTop + chartH - ((0 - minVal) / range) * chartH;
  const bottomY = paddingTop + chartH;
  const fillPath = `${linePath} L ${points[points.length - 1].x} ${bottomY} L ${points[0].x} ${bottomY} Z`;

  const activePoint = selectedIndex !== null ? points[selectedIndex] : points[points.length - 1];

  // Pick 4-5 well-spaced indices for X-axis labels
  const sampleIndices = new Set<number>();
  if (points.length <= 4) {
    points.forEach((_, i) => sampleIndices.add(i));
  } else {
    sampleIndices.add(0);
    sampleIndices.add(Math.floor(points.length * 0.33));
    sampleIndices.add(Math.floor(points.length * 0.66));
    sampleIndices.add(points.length - 1);
  }

  const formatCompact = (val: number) => {
    const abs = Math.abs(val);
    const sign = val > 0 ? '+' : val < 0 ? '-' : '';
    if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`;
    return `${sign}$${abs.toFixed(0)}`;
  };

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Interactive Tooltip on Top */}
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
            {activePoint.value >= 0 ? '+' : ''}${activePoint.value.toFixed(2)}
          </Text>
        </View>
      )}

      <View style={styles.chartRow}>
        {/* Native React Native Text for Y-Axis (100% Crisp & No SVG Clipping) */}
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

        {/* SVG Drawing Canvas for Area Curve and Dots */}
        <View style={{ width: chartW + paddingRight, height }}>
          <Svg width={chartW + paddingRight} height={height}>
            <Defs>
              <LinearGradient id="equityGradGreen" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#10b981" stopOpacity="0.45" />
                <Stop offset="0.8" stopColor="#10b981" stopOpacity="0.02" />
              </LinearGradient>
              <LinearGradient id="equityGradRed" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ef4444" stopOpacity="0.45" />
                <Stop offset="0.8" stopColor="#ef4444" stopOpacity="0.02" />
              </LinearGradient>
            </Defs>

            {/* Grid Horizontal Lines */}
            <Line
              x1={0}
              y1={paddingTop}
              x2={chartW}
              y2={paddingTop}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
            />
            <Line
              x1={0}
              y1={zeroY}
              x2={chartW}
              y2={zeroY}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <Line
              x1={0}
              y1={bottomY}
              x2={chartW}
              y2={bottomY}
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
            />

            {/* Area Gradient Fill */}
            <Path
              d={fillPath}
              fill={isOverallPositive ? 'url(#equityGradGreen)' : 'url(#equityGradRed)'}
            />

            {/* Main Glowing Curve */}
            <Path
              d={linePath}
              fill="none"
              stroke={mainColor}
              strokeWidth="2.5"
            />

            {/* Interactive Points */}
            {points.map((p, i) => {
              const isSelected = (selectedIndex === null && i === points.length - 1) || selectedIndex === i;
              const isSample = sampleIndices.has(i);

              return (
                <G key={i}>
                  {isSelected ? (
                    <>
                      <Circle
                        cx={p.x}
                        cy={p.y}
                        r={9}
                        fill={p.value >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}
                      />
                      <Circle
                        cx={p.x}
                        cy={p.y}
                        r={5}
                        fill={p.value >= 0 ? '#10b981' : '#ef4444'}
                        stroke="#07080a"
                        strokeWidth="2"
                      />
                    </>
                  ) : isSample ? (
                    <Circle
                      cx={p.x}
                      cy={p.y}
                      r={2.5}
                      fill={p.value >= 0 ? '#10b981' : '#ef4444'}
                      opacity={0.6}
                    />
                  ) : null}
                </G>
              );
            })}
          </Svg>

          {/* Clean Native X-Axis Labels placed underneath */}
          <View style={[styles.xAxisContainer, { width: chartW }]}>
            {points.map((p, i) => {
              if (!sampleIndices.has(i)) return null;
              return (
                <Text
                  key={i}
                  style={[
                    styles.xAxisLabel,
                    {
                      left: Math.max(0, Math.min(chartW - 36, p.x - 18)),
                    },
                  ]}
                >
                  {p.date}
                </Text>
              );
            })}
          </View>

          {/* Touch Overlays for each point */}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', width: chartW }]}>
            {points.map((_, i) => (
              <TouchableOpacity
                key={i}
                style={{ flex: 1, height: '100%' }}
                onPress={() => setSelectedIndex(i)}
                activeOpacity={1}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#12141c',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
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
    fontWeight: '800',
    color: '#94a3b8',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  yAxisTop: {
    position: 'absolute',
    top: 22,
    right: 6,
    color: '#34d399',
  },
  yAxisZero: {
    position: 'absolute',
    right: 6,
    color: '#64748b',
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
    color: '#64748b',
    fontSize: 8,
    fontWeight: '700',
    textAlign: 'center',
    width: 36,
  },
  tooltipBadge: {
    position: 'absolute',
    top: 6,
    right: 12,
    backgroundColor: '#0d0f15',
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
    color: '#94a3b8',
    fontSize: 9,
    fontWeight: '700',
  },
  tooltipVal: {
    fontSize: 11,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  greenText: { color: '#10b981' },
  redText: { color: '#ef4444' },
});
