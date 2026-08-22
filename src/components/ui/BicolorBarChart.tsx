import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Rect, Line, G } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { formatCurrency } from '../../utils/formatCurrency';

interface BicolorBarChartProps {
  data: { label: string; value: number }[];
  height?: number;
  width?: number;
  yAxisPrefix?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

const MIN_BAR_WIDTH = 28; // minimum px per bar (bar + gap)
const MIN_CHART_WIDTH = Dimensions.get('window').width - 64;

export const BicolorBarChart: React.FC<BicolorBarChartProps> = ({
  data,
  height = 160,
  width = MIN_CHART_WIDTH,
  yAxisPrefix = '$',
  valuePrefix = '$',
  valueSuffix = '',
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (!data || data.length === 0) return null;

  const yAxisWidth = 52;
  const paddingRight = 12;
  const paddingTop = 20;
  const paddingBottom = 4;
  const xLabelHeight = 20;
  const totalHeight = height + xLabelHeight;

  // Calculate ideal chart width: enough room for each bar
  const idealChartWidth = data.length * MIN_BAR_WIDTH;
  const needsScroll = idealChartWidth > MIN_CHART_WIDTH;

  // Use the wider of screen width or ideal width
  const effectiveChartWidth = needsScroll ? idealChartWidth : MIN_CHART_WIDTH;
  const chartWidth = effectiveChartWidth - yAxisWidth - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map(d => Math.abs(d.value)), 100);
  const zeroY = paddingTop + chartHeight / 2;
  const barWidth = Math.min(22, chartWidth / data.length - 6);

  const activeIdx = selectedIdx !== null ? selectedIdx : data.length - 1;
  const activeItem = data[activeIdx];
  // Compute tooltip X so it stays fully visible
  const activeBarX = activeIdx * (chartWidth / data.length) + (chartWidth / data.length) / 2;
  const TOOLTIP_ESTIMATED_W = 110;
  const tooltipFitsRight = activeBarX + TOOLTIP_ESTIMATED_W / 2 < chartWidth - 8;
  const tooltipX = tooltipFitsRight
    ? Math.max(8, Math.min(activeBarX - TOOLTIP_ESTIMATED_W / 2, chartWidth - TOOLTIP_ESTIMATED_W - 8))
    : Math.max(8, activeBarX - TOOLTIP_ESTIMATED_W + 16);

  const formatCompact = (val: number) =>
    formatCurrency(val, { symbol: yAxisPrefix, compact: true, showPlus: false, decimals: 0 });

  const chartContent = (
    <View style={[styles.container, { height: totalHeight, width: effectiveChartWidth + yAxisWidth }]}>
      {/* Interactive Tooltip */}
      {activeItem && (
        <View style={[styles.tooltipBadge, { left: yAxisWidth + tooltipX, right: undefined }]}>
          <Text style={styles.tooltipDate}>{activeItem.label}</Text>
          <Text
            style={[
              styles.tooltipVal,
              activeItem.value >= 0 ? styles.greenText : styles.redText,
            ]}
          >
            {formatCurrency(activeItem.value)}
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
              stroke={theme.colors.borderBright}
              strokeWidth="1" strokeDasharray="4 4"
            />
            <Line
              x1={0} y1={paddingTop}
              x2={chartWidth} y2={paddingTop}
              stroke={theme.colors.cardBorder} strokeWidth="1"
            />
            <Line
              x1={0} y1={height - paddingBottom}
              x2={chartWidth} y2={height - paddingBottom}
              stroke={theme.colors.cardBorder} strokeWidth="1"
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
                    fill={isPositive ? theme.colors.green : theme.colors.red}
                    opacity={isSelected ? 1 : 0.7}
                    stroke={isSelected ? theme.colors.textPrimary : 'none'}
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

  // Wrap in horizontal ScrollView if data is too wide
  if (needsScroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -theme.spacing.md }}
        contentContainerStyle={{ paddingHorizontal: theme.spacing.md }}
      >
        {chartContent}
      </ScrollView>
    );
  }

  return chartContent;
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    backgroundColor: theme.colors.chartBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    position: 'relative',
    paddingVertical: 4,
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
    fontFamily: theme.fonts.monoBold,
    color: theme.colors.textSecondary,
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
    color: theme.colors.textMuted,
  },
  yAxisBottom: {
    position: 'absolute',
    bottom: 36,
    right: 4,
  },
  xAxisRow: {
    flexDirection: 'row',
    paddingTop: 4,
  },
  xAxisLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  xAxisLabelActive: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
  },
  tooltipBadge: {
    position: 'absolute',
    top: 6,
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
    overflow: 'visible',
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
