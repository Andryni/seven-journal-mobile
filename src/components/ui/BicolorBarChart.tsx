import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Rect, Line, Text as SvgText, G } from 'react-native-svg';
import { theme } from '../../theme';

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

  const paddingHorizontal = 36;
  const paddingVertical = 24;
  const chartWidth = width - paddingHorizontal * 2;
  const chartHeight = height - paddingVertical * 2;

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 100);
  const zeroY = paddingVertical + chartHeight / 2;
  const barWidth = Math.min(24, chartWidth / data.length - 6);

  const activeItem = selectedIdx !== null ? data[selectedIdx] : data[data.length - 1];

  return (
    <View style={[styles.container, { height, width }]}>
      {/* Interactive Tooltip on Top */}
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

      <Svg width={width} height={height}>
        {/* Zero Axis Line */}
        <Line
          x1={paddingHorizontal}
          y1={zeroY}
          x2={width - paddingHorizontal}
          y2={zeroY}
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />

        {/* Reference Lines */}
        <Line
          x1={paddingHorizontal}
          y1={paddingVertical}
          x2={width - paddingHorizontal}
          y2={paddingVertical}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />
        <Line
          x1={paddingHorizontal}
          y1={height - paddingVertical}
          x2={width - paddingHorizontal}
          y2={height - paddingVertical}
          stroke="rgba(255, 255, 255, 0.05)"
          strokeWidth="1"
        />

        {/* Max & Min Labels */}
        <SvgText
          x={paddingHorizontal - 6}
          y={paddingVertical + 4}
          fill="#94a3b8"
          fontSize="8"
          fontWeight="bold"
          textAnchor="end"
        >
          +{yAxisPrefix}{maxVal.toFixed(0)}
        </SvgText>
        <SvgText
          x={paddingHorizontal - 6}
          y={zeroY + 3}
          fill="#64748b"
          fontSize="8"
          fontWeight="bold"
          textAnchor="end"
        >
          {yAxisPrefix}0
        </SvgText>
        <SvgText
          x={paddingHorizontal - 6}
          y={height - paddingVertical + 4}
          fill="#94a3b8"
          fontSize="8"
          fontWeight="bold"
          textAnchor="end"
        >
          -{yAxisPrefix}{maxVal.toFixed(0)}
        </SvgText>

        {/* Bars */}
        {data.map((item, index) => {
          const x = paddingHorizontal + index * (chartWidth / data.length) + (chartWidth / data.length - barWidth) / 2;
          const isPositive = item.value >= 0;
          const barHeight = (Math.abs(item.value) / maxVal) * (chartHeight / 2);
          const y = isPositive ? zeroY - barHeight : zeroY;
          const isSelected = (selectedIdx === null && index === data.length - 1) || selectedIdx === index;

          return (
            <G key={index}>
              {/* Bar */}
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                fill={isPositive ? '#10b981' : '#ef4444'}
                opacity={isSelected ? 1 : 0.65}
                stroke={isSelected ? '#ffffff' : 'none'}
                strokeWidth={isSelected ? 1.5 : 0}
                rx={3}
              />

              {/* X Axis Label */}
              <SvgText
                x={x + barWidth / 2}
                y={height - 6}
                fill={isSelected ? '#ffffff' : '#94a3b8'}
                fontSize="8"
                fontWeight={isSelected ? 'bold' : 'normal'}
                textAnchor="middle"
              >
                {item.label}
              </SvgText>
            </G>
          );
        })}
      </Svg>

      {/* Interactive Touch Areas */}
      <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', paddingHorizontal }]}>
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
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#181920',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
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
