import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Rect, Line, G } from 'react-native-svg';

interface BicolorBarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  width?: number;
  yAxisPrefix?: string;
}

export const BicolorBarChart: React.FC<BicolorBarChartProps> = ({
  data,
  height = 160,
  width = Dimensions.get('window').width - 64,
  yAxisPrefix = '$',
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const yAxisWidth = 52;
  const paddingRight = 12;
  const paddingTop = 20;
  const paddingBottom = 4; // bars end here, X labels go below
  const xLabelHeight = 20; // reserved space for X-axis labels
  const totalHeight = height + xLabelHeight;

  const chartWidth = width - yAxisWidth - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 100);
  const zeroY = paddingTop + chartHeight / 2;
  const barWidth = Math.min(22, chartWidth / data.length - 6);

  const activeItem = selectedIdx !== null ? data[selectedIdx] : data[data.length - 1];

  const formatCompact = (val: number) => {
    if (val >= 1000000) return `${yAxisPrefix}${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${yAxisPrefix}${(val / 1000).toFixed(1)}k`;
    return `${yAxisPrefix}${val.toFixed(0)}`;
  };

  return (
    <View style={[styles.container, { height: totalHeight, width }]}>
      {/* Interactive Tooltip */}
      {activeItem && (
        <View style={styles.tooltipBadge}>
          <Text style={styles.tooltipDate}>{activeItem.label}</Text>
          <Text
            style={[
              styles.tooltipVal,
              activeItem.value >= 0 ? styles.greenText : styles.redText,
            ]}
          >
            {activeItem.value >= 0 ? '+' : ''}${activeItem.value.toFixed(2)}
          </Text>
        </View>
      )}

      <View style={styles.chartRow}>
        {/* Native Y-Axis Labels */}
        <View style={[styles.yAxisContainer, { height }]}>
          <Text style={[styles.yAxisLabel, styles.yAxisTop, styles.greenText]}>
            +{formatCompact(maxVal)}
          </Text>
          <Text style={[styles.yAxisLabel, styles.yAxisMid, { top: zeroY - 7 }]}>
            {yAxisPrefix}0
          </Text>
          <Text style={[styles.yAxisLabel, styles.yAxisBottom, styles.redText]}>
            -{formatCompact(maxVal)}
          </Text>
        </View>

        {/* SVG Chart Canvas + X labels below */}
        <View style={{ width: chartWidth + paddingRight, height: totalHeight }}>
          <Svg width={chartWidth + paddingRight} height={height}>
            {/* Zero Axis Line */}
            <Line
              x1={0} y1={zeroY}
              x2={chartWidth} y2={zeroY}
              stroke="rgba(255, 255, 255, 0.15)"
              strokeWidth="1" strokeDasharray="4 4"
            />
            <Line
              x1={0} y1={paddingTop}
              x2={chartWidth} y2={paddingTop}
              stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1"
            />
            <Line
              x1={0} y1={height - paddingBottom}
              x2={chartWidth} y2={height - paddingBottom}
              stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1"
            />

            {/* Bars */}
            {data.map((item, index) => {
              const x = index * (chartWidth / data.length) + (chartWidth / data.length - barWidth) / 2;
              const isPositive = item.value >= 0;
              const barHeight = (Math.abs(item.value) / maxVal) * (chartHeight / 2);
              const y = isPositive ? zeroY - barHeight : zeroY;
              const isSelected = (selectedIdx === null && index === data.length - 1) || selectedIdx === index;

              return (
                <G key={index}>
                  <Rect
                    x={x} y={y}
                    width={barWidth}
                    height={Math.max(barHeight, 2)}
                    fill={isPositive ? '#10b981' : '#ef4444'}
                    opacity={isSelected ? 1 : 0.7}
                    stroke={isSelected ? '#ffffff' : 'none'}
                    strokeWidth={isSelected ? 1.5 : 0}
                    rx={3}
                  />
                </G>
              );
            })}
          </Svg>

          {/* Native X-Axis Labels — OUTSIDE SVG, fully visible */}
          <View style={[styles.xAxisRow, { width: chartWidth, height: xLabelHeight }]}>
            {data.map((item, index) => {
              const segmentWidth = chartWidth / data.length;
              const isSelected = (selectedIdx === null && index === data.length - 1) || selectedIdx === index;
              return (
                <Text
                  key={index}
                  style={[
                    styles.xAxisLabel,
                    { width: segmentWidth },
                    isSelected && styles.xAxisLabelActive,
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
              );
            })}
          </View>

          {/* Touch Overlays */}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', width: chartWidth, height }]}>
            {data.map((_, idx) => (
              <TouchableOpacity
                key={idx}
                style={{ flex: 1, height: '100%' }}
                onPress={() => setSelectedIdx(idx)}
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
    borderColor: 'rgba(255, 255, 255, 0.05)',
    position: 'relative',
    paddingVertical: 4,
    // NO overflow: 'hidden' — X labels must be visible
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  yAxisContainer: {
    width: 52,
    paddingRight: 4,
    position: 'relative',
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
    top: 16,
    right: 4,
  },
  yAxisMid: {
    position: 'absolute',
    right: 4,
    color: '#64748b',
  },
  yAxisBottom: {
    position: 'absolute',
    bottom: 36, // account for xLabelHeight
    right: 4,
  },
  xAxisRow: {
    flexDirection: 'row',
    paddingTop: 4,
  },
  xAxisLabel: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  xAxisLabelActive: {
    color: '#ffffff',
    fontWeight: '900',
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
