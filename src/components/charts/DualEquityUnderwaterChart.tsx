import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line, G } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { formatCurrency } from '../../utils/formatCurrency';
import { useT } from '../../i18n';

interface DualEquityUnderwaterChartProps {
  equityData: { date: string; value: number }[];
  height?: number;
  width?: number;
}

export const DualEquityUnderwaterChart: React.FC<DualEquityUnderwaterChartProps> = ({
  equityData,
  height = 280,
  width = Dimensions.get('window').width - 48,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (!equityData || equityData.length === 0) return null;

  // 1. Calculate Peak & Underwater Drawdown for each point
  const pointsWithDD = useMemo(() => {
    let peak = 0;
    return equityData.map((d, i) => {
      if (d.value > peak) peak = d.value;
      const dd = d.value - peak; // 0 or negative
      const ddPercent = peak > 0 ? (dd / peak) * 100 : 0;
      return {
        ...d,
        index: i + 1,
        peak,
        drawdown: dd,
        ddPercent,
      };
    });
  }, [equityData]);

  const yAxisWidth = 56;
  const paddingRight = 14;
  const chartW = width - yAxisWidth - paddingRight;

  // Split height: 60% top (Equity) + 40% bottom (Underwater Drawdown)
  const topPanelH = height * 0.58;
  const bottomPanelH = height * 0.32;
  const panelGap = height * 0.08;

  // Top scale (Equity)
  const equityVals = pointsWithDD.map(p => p.value);
  const minEquity = Math.min(0, ...equityVals);
  const maxEquity = Math.max(100, ...equityVals);
  const equityRange = maxEquity - minEquity || 1;

  // Bottom scale (Drawdown - 0 to minDD)
  const ddVals = pointsWithDD.map(p => p.drawdown);
  const minDD = Math.min(-10, ...ddVals); // e.g. -500$
  const ddRange = Math.abs(minDD) || 1;

  // Map Points Coordinates
  const mappedPoints = pointsWithDD.map((p, i) => {
    const x = (i / Math.max(pointsWithDD.length - 1, 1)) * chartW;
    const topY = 20 + topPanelH - ((p.value - minEquity) / equityRange) * (topPanelH - 26);
    const bottomZeroY = topPanelH + panelGap + 12;
    const bottomY = bottomZeroY + (Math.abs(p.drawdown) / ddRange) * (bottomPanelH - 16);
    return { ...p, x, topY, bottomY, bottomZeroY };
  });

  // Top Equity Path
  const equityLinePath = mappedPoints.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.topY}`;
    const prev = arr[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 2;
    const cy1 = prev.topY;
    const cx2 = prev.x + (p.x - prev.x) / 2;
    const cy2 = p.topY;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.topY}`;
  }, '');

  const equityFillPath = `${equityLinePath} L ${mappedPoints[mappedPoints.length - 1].x} ${topPanelH + 16} L ${mappedPoints[0].x} ${topPanelH + 16} Z`;

  // Bottom Underwater Path
  const ddLinePath = mappedPoints.reduce((acc, p, i, arr) => {
    if (i === 0) return `M ${p.x} ${p.bottomY}`;
    const prev = arr[i - 1];
    const cx1 = prev.x + (p.x - prev.x) / 2;
    const cy1 = prev.bottomY;
    const cx2 = prev.x + (p.x - prev.x) / 2;
    const cy2 = p.bottomY;
    return `${acc} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${p.x} ${p.bottomY}`;
  }, '');

  const bottomZeroY = topPanelH + panelGap + 12;
  const ddFillPath = `${ddLinePath} L ${mappedPoints[mappedPoints.length - 1].x} ${bottomZeroY} L ${mappedPoints[0].x} ${bottomZeroY} Z`;

  const active = selectedIndex !== null ? mappedPoints[selectedIndex] : mappedPoints[mappedPoints.length - 1];

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Top Banner Status */}
      <View style={styles.topBanner}>
        <View>
          <Text style={styles.bannerTitle}>{t('chartDualEquityTitle')}</Text>
          <Text style={styles.bannerSub}>Trade #{active.index} · {active.date}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.equityVal, active.value >= 0 ? styles.greenText : styles.redText]}>
            {formatCurrency(active.value)}
          </Text>
          <Text style={[styles.ddVal, active.drawdown < 0 ? styles.redText : styles.greenText]}>
            DD: {formatCurrency(active.drawdown)}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        {/* Y Axis Labels */}
        <View style={[styles.yAxis, { height: height - 48 }]}>
          <Text style={[styles.yLabel, styles.greenText]}>{formatCurrency(maxEquity, { compact: true, decimals: 0 })}</Text>
          <Text style={styles.yLabel}>$0</Text>
          <View style={{ height: panelGap }} />
          <Text style={[styles.yLabel, { color: theme.colors.textMuted }]}>0% DD</Text>
          <Text style={[styles.yLabel, styles.redText]}>{formatCurrency(minDD, { compact: true, decimals: 0 })}</Text>
        </View>

        {/* SVG Canvas */}
        <View style={{ width: chartW + paddingRight, height: height - 48 }}>
          <Svg width={chartW + paddingRight} height={height - 48}>
            <Defs>
              <LinearGradient id="dualEqGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.green} stopOpacity="0.45" />
                <Stop offset="0.9" stopColor={theme.colors.green} stopOpacity="0.02" />
              </LinearGradient>
              <LinearGradient id="dualDdGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={theme.colors.red} stopOpacity="0.05" />
                <Stop offset="1" stopColor={theme.colors.red} stopOpacity="0.5" />
              </LinearGradient>
            </Defs>

            {/* Separator between Panels */}
            <Line
              x1={0}
              y1={topPanelH + 16}
              x2={chartW}
              y2={topPanelH + 16}
              stroke={theme.colors.cardBorder}
              strokeWidth="1"
            />
            {/* Drawdown 0 line */}
            <Line
              x1={0}
              y1={bottomZeroY}
              x2={chartW}
              y2={bottomZeroY}
              stroke={theme.colors.borderBright}
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* Top Equity Area */}
            <Path d={equityFillPath} fill="url(#dualEqGrad)" />
            <Path d={equityLinePath} fill="none" stroke={theme.colors.green} strokeWidth="2" />

            {/* Bottom Drawdown Area */}
            <Path d={ddFillPath} fill="url(#dualDdGrad)" />
            <Path d={ddLinePath} fill="none" stroke={theme.colors.red} strokeWidth="2" />

            {/* Selected Crosshair line */}
            {active && (
              <Line
                x1={active.x}
                y1={10}
                x2={active.x}
                y2={height - 56}
                stroke={theme.colors.primaryLight}
                strokeWidth="1"
                strokeDasharray="2 2"
              />
            )}

            {/* Live Indicator on Top */}
            <Circle cx={active.x} cy={active.topY} r={5} fill={theme.colors.greenLight} />
            <Circle cx={active.x} cy={active.bottomY} r={4} fill={theme.colors.redLight} />
          </Svg>

          {/* Touch overlay */}
          <View style={[StyleSheet.absoluteFill, { flexDirection: 'row', width: chartW }]}>
            {mappedPoints.map((_, i) => (
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

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      backgroundColor: theme.colors.chartBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      padding: 12,
      overflow: 'hidden',
    },
    topBanner: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      paddingBottom: 6,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
    },
    bannerTitle: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    bannerSub: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoMedium,
      marginTop: 2,
    },
    equityVal: {
      fontSize: 13,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    ddVal: {
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
      marginTop: 1,
    },
    yAxis: {
      width: 56,
      justifyContent: 'space-between',
      paddingRight: 6,
    },
    yLabel: {
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    greenText: { color: theme.colors.greenLight },
    redText: { color: theme.colors.redLight },
  });
