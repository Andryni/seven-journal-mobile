import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { formatCurrency } from '../../utils/formatCurrency';
import { duration, easing } from '../../theme/motion';
import type { Trade } from '../../types/domain';

const ARect = Animated.createAnimatedComponent(Rect);

interface HourlyPerformanceChartProps {
  trades: Trade[];
  height?: number;
  width?: number;
}

/**
 * P&L by hour of day — a diverging column chart around a zero axis.
 *
 * Timing was previously shown as a session heatmap only (Asia/London/NY),
 * which is too coarse: most traders bleed in one or two specific hours.
 * Bars grow out of the zero line; tapping one pins its readout.
 */
export const HourlyPerformanceChart: React.FC<HourlyPerformanceChartProps> = ({
  trades,
  height = 180,
  width = Dimensions.get('window').width - 64,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selected, setSelected] = useState<number | null>(null);

  const padTop = 14;
  const padBottom = 24;
  const chartH = height - padTop - padBottom;

  const hours = useMemo(() => {
    const buckets = Array.from({ length: 24 }, () => ({ pnl: 0, count: 0 }));
    for (const tr of trades) {
      if (tr.pnl === null) continue;
      const h = new Date(tr.entry_time).getHours();
      buckets[h].pnl += tr.pnl;
      buckets[h].count += 1;
    }
    return buckets;
  }, [trades]);

  const maxAbs = Math.max(...hours.map(h => Math.abs(h.pnl)), 1);
  const zeroY = padTop + chartH / 2;
  const halfH = chartH / 2;
  const slot = width / 24;
  const barW = Math.max(slot * 0.6, 3);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: duration.slow, easing: easing.out });
  }, [hours, progress]);

  const active = selected !== null ? hours[selected] : null;
  const hasData = hours.some(h => h.count > 0);

  if (!hasData) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{t('noDataAvailable')}</Text>
      </View>
    );
  }

  return (
    <View>
      {/* Pinned readout */}
      <View style={styles.readout}>
        {active ? (
          <>
            <Text style={styles.readoutHour}>
              {String(selected).padStart(2, '0')}:00
            </Text>
            <Text
              style={[
                styles.readoutPnl,
                { color: active.pnl >= 0 ? theme.colors.green : theme.colors.red },
              ]}
            >
              {formatCurrency(active.pnl)}
            </Text>
            <Text style={styles.readoutCount}>
              {active.count} {t('positions')}
            </Text>
          </>
        ) : (
          <Text style={styles.readoutHint}>{t('tapBarHint')}</Text>
        )}
      </View>

      <Svg width={width} height={height}>
        {/* Zero axis */}
        <Line
          x1={0}
          y1={zeroY}
          x2={width}
          y2={zeroY}
          stroke={theme.colors.borderStrong}
          strokeWidth={1}
        />

        {hours.map((h, i) => {
          const full = (Math.abs(h.pnl) / maxAbs) * halfH;
          const up = h.pnl >= 0;
          const isSel = selected === i;
          return (
            <HourBar
              key={i}
              x={i * slot + (slot - barW) / 2}
              barW={barW}
              full={full}
              zeroY={zeroY}
              up={up}
              color={
                h.count === 0
                  ? theme.colors.surfaceLight
                  : up
                  ? theme.colors.green
                  : theme.colors.red
              }
              opacity={selected === null || isSel ? 1 : 0.3}
              progress={progress}
            />
          );
        })}

        {/* Hour ticks every 4h */}
        {[0, 4, 8, 12, 16, 20].map(h => (
          <SvgText
            key={h}
            x={h * slot + slot / 2}
            y={height - 7}
            fill={theme.colors.textMuted}
            fontSize={8}
            fontFamily={theme.fonts.mono}
            textAnchor="middle"
          >
            {String(h).padStart(2, '0')}
          </SvgText>
        ))}
      </Svg>

      {/* Touch layer — SVG onPress is unreliable for thin bars */}
      <View style={[styles.touchLayer, { height: height - padBottom }]} pointerEvents="box-none">
        {hours.map((_, i) => (
          <Pressable
            key={i}
            style={{ width: slot, height: '100%' }}
            onPress={() => setSelected(selected === i ? null : i)}
            accessibilityLabel={`${i}:00`}
          />
        ))}
      </View>
    </View>
  );
};

const HourBar: React.FC<{
  x: number;
  barW: number;
  full: number;
  zeroY: number;
  up: boolean;
  color: string;
  opacity: number;
  progress: SharedValue<number>;
}> = ({ x, barW, full, zeroY, up, color, opacity, progress }) => {
  const animated = useAnimatedProps(() => {
    const h = Math.max(full * progress.value, 0.5);
    return { height: h, y: up ? zeroY - h : zeroY };
  });
  return <ARect x={x} width={barW} rx={1} fill={color} opacity={opacity} animatedProps={animated} />;
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    empty: { alignItems: 'center', justifyContent: 'center' },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sans,
    },
    readout: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: theme.spacing.sm,
      height: 20,
      marginBottom: 4,
    },
    readoutHour: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    readoutPnl: {
      fontSize: theme.type.metricSm,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    readoutCount: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
    },
    readoutHint: {
      color: theme.colors.textDark,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
    },
    touchLayer: {
      position: 'absolute',
      top: 24,
      left: 0,
      right: 0,
      flexDirection: 'row',
    },
  });
