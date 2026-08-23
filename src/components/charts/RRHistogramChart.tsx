import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Rect, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useHaptic } from '../../hooks/useHaptic';

interface RRHistogramChartProps {
  rMultiples: number[];
  height?: number;
  width?: number;
}

interface Bucket {
  label: string;
  min: number;
  max: number;
  count: number;
  isPositive: boolean;
  isZero: boolean;
}

export const RRHistogramChart: React.FC<RRHistogramChartProps> = ({
  rMultiples,
  height = 200,
  width = Dimensions.get('window').width - 48,
}) => {
  const { theme } = useTheme();
  const { light } = useHaptic();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const buckets: Bucket[] = useMemo(() => {
    const b: Bucket[] = [
      { label: '< -2R', min: -Infinity, max: -2, count: 0, isPositive: false, isZero: false },
      { label: '-1R', min: -2, max: -0.5, count: 0, isPositive: false, isZero: false },
      { label: '-0.5R', min: -0.5, max: -0.05, count: 0, isPositive: false, isZero: false },
      { label: '0R (BE)', min: -0.05, max: 0.05, count: 0, isPositive: true, isZero: true },
      { label: '+1R', min: 0.05, max: 1.5, count: 0, isPositive: true, isZero: false },
      { label: '+2R', min: 1.5, max: 2.5, count: 0, isPositive: true, isZero: false },
      { label: '+3R', min: 2.5, max: 4, count: 0, isPositive: true, isZero: false },
      { label: '5R+', min: 4, max: Infinity, count: 0, isPositive: true, isZero: false },
    ];

    rMultiples.forEach(r => {
      const found = b.find(bucket => r >= bucket.min && r < bucket.max);
      if (found) found.count++;
      else if (r >= 4) b[b.length - 1].count++;
    });

    return b;
  }, [rMultiples]);

  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const totalCount = rMultiples.length || 1;

  const paddingBottom = 30;
  const paddingTop = 20;
  const chartH = height - paddingBottom - paddingTop;
  const barWidth = (width - 40) / buckets.length - 6;

  const selectedBucket = selectedIdx !== null ? buckets[selectedIdx] : null;

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.title}>DISTRIBUTION DES R-MULTIPLES</Text>
        {selectedBucket ? (
          <Text style={styles.selectedInfo}>
            {selectedBucket.label} :{' '}
            <Text style={{ fontWeight: '800', color: selectedBucket.isZero ? theme.colors.goldLight : selectedBucket.isPositive ? theme.colors.greenLight : theme.colors.redLight }}>
              {selectedBucket.count} trade{selectedBucket.count > 1 ? 's' : ''} ({((selectedBucket.count / totalCount) * 100).toFixed(0)}%)
            </Text>
          </Text>
        ) : (
          <Text style={styles.subtext}>{totalCount} trades analysés</Text>
        )}
      </View>

      {/* Chart Bars */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: chartH, justifyContent: 'space-between', paddingHorizontal: 10 }}>
        {buckets.map((b, i) => {
          const barH = (b.count / maxCount) * (chartH - 20) || 4;
          const isSelected = selectedIdx === i;
          const barColor = b.isZero
            ? theme.colors.gold
            : b.isPositive
            ? theme.colors.green
            : theme.colors.red;

          return (
            <TouchableOpacity
              key={b.label}
              style={{ alignItems: 'center', width: barWidth }}
              onPress={() => {
                light();
                setSelectedIdx(isSelected ? null : i);
              }}
              activeOpacity={0.75}
            >
              {/* Bar count on top */}
              {b.count > 0 && (
                <Text style={[styles.barCount, { color: barColor }]}>{b.count}</Text>
              )}
              {/* Vertical Bar */}
              <Animated.View
                entering={FadeInUp.delay(i * 40).duration(300)}
                style={[
                  styles.bar,
                  {
                    height: barH,
                    width: barWidth,
                    backgroundColor: barColor,
                    borderColor: isSelected ? theme.colors.textPrimary : 'transparent',
                    borderWidth: isSelected ? 1.5 : 0,
                    opacity: b.count === 0 ? 0.2 : 0.9,
                  },
                ]}
              />
              {/* X Label */}
              <Text style={[styles.xLabel, isSelected && styles.xLabelActive]}>{b.label}</Text>
            </TouchableOpacity>
          );
        })}
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
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    title: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    subtext: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoMedium,
    },
    selectedInfo: {
      color: theme.colors.textPrimary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
    },
    bar: {
      borderRadius: 4,
      minHeight: 4,
      marginBottom: 6,
    },
    barCount: {
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      marginBottom: 2,
    },
    xLabel: {
      color: theme.colors.textMuted,
      fontSize: 7.5,
      fontFamily: theme.fonts.monoBold,
      textAlign: 'center',
    },
    xLabelActive: {
      color: theme.colors.textPrimary,
      fontWeight: '800',
    },
  });
