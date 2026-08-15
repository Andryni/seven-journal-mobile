import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Line,
  Text as SvgText,
  G,
  Rect,
} from 'react-native-svg';
import { theme } from '../../theme';

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

  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;

  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const values = data.map(d => d.value);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(10, ...values);
  const range = maxVal - minVal || 1;

  const isOverallPositive = (values[values.length - 1] ?? 0) >= 0;
  const mainColor = isOverallPositive ? '#10b981' : '#ef4444';

  const points = data.map((d, i) => {
    const x = paddingLeft + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = paddingTop + chartH - ((d.value - minVal) / range) * chartH;
    return { x, y, value: d.value, date: d.date };
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

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Interactive Tooltip on Top */}
      {activePoint && (
        <View style={styles.tooltipBadge}>
          <Text style={styles.tooltipDate}>{activePoint.date}</Text>
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

      <Svg width={width} height={height}>
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
          x1={paddingLeft}
          y1={paddingTop}
          x2={width - paddingRight}
          y2={paddingTop}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />
        <Line
          x1={paddingLeft}
          y1={zeroY}
          x2={width - paddingRight}
          y2={zeroY}
          stroke="rgba(255, 255, 255, 0.12)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
        <Line
          x1={paddingLeft}
          y1={bottomY}
          x2={width - paddingRight}
          y2={bottomY}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />

        {/* Y Axis Labels */}
        <SvgText
          x={paddingLeft - 6}
          y={paddingTop + 4}
          fill="#94a3b8"
          fontSize="9"
          fontWeight="bold"
          textAnchor="end"
        >
          +${maxVal.toFixed(0)}
        </SvgText>
        <SvgText
          x={paddingLeft - 6}
          y={zeroY + 3}
          fill="#64748b"
          fontSize="9"
          fontWeight="bold"
          textAnchor="end"
        >
          $0
        </SvgText>
        <SvgText
          x={paddingLeft - 6}
          y={bottomY + 3}
          fill="#94a3b8"
          fontSize="9"
          fontWeight="bold"
          textAnchor="end"
        >
          -${Math.abs(minVal).toFixed(0)}
        </SvgText>

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
          strokeWidth="3"
        />

        {/* Interactive Dots and Click Areas */}
        {points.map((p, i) => {
          const isSelected = (selectedIndex === null && i === points.length - 1) || selectedIndex === i;
          return (
            <G key={i}>
              {/* Pulsing glow circle on active point */}
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
              ) : (
                <Circle
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill={p.value >= 0 ? '#10b981' : '#ef4444'}
                  opacity={0.6}
                />
              )}

              {/* X Axis Label */}
              <SvgText
                x={p.x}
                y={height - 8}
                fill="#64748b"
                fontSize="8"
                fontWeight="700"
                textAnchor="middle"
              >
                {p.date.slice(5) || p.date}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Touch overlays for each point */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', paddingLeft, paddingRight }]}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181920',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tooltipBadge: {
    position: 'absolute',
    top: 6,
    right: 12,
    backgroundColor: '#121318',
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
