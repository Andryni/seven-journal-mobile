import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
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
import { duration, easing } from '../../theme/motion';

const ABar = Animated.createAnimatedComponent(Rect);

interface RDistributionChartProps {
  /** R multiples of closed trades. */
  values: number[];
  height?: number;
  width?: number;
}

/** Histogram buckets, in R. Losses are clamped at -3R, wins at +5R. */
const BUCKETS: { label: string; min: number; max: number }[] = [
  { label: '<-2', min: -Infinity, max: -2 },
  { label: '-2', min: -2, max: -1 },
  { label: '-1', min: -1, max: -0.2 },
  { label: 'BE', min: -0.2, max: 0.2 },
  { label: '+1', min: 0.2, max: 1.5 },
  { label: '+2', min: 1.5, max: 2.5 },
  { label: '+3', min: 2.5, max: 4 },
  { label: '4+', min: 4, max: Infinity },
];

/**
 * R-Multiple distribution.
 *
 * The single most diagnostic chart for a discretionary trader, and the app
 * did not have it. Equity tells you the outcome; this tells you the *shape*
 * of your edge: whether losses cluster at -1R (stops respected) and whether
 * any winner is large enough to pay for them.
 *
 * Bars grow from the baseline with a left-to-right stagger.
 */
export const RDistributionChart: React.FC<RDistributionChartProps> = ({
  values,
  height = 170,
  width = Dimensions.get('window').width - 64,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [selected, setSelected] = useState<number | null>(null);

  const padTop = 18;
  const padBottom = 26;
  const chartH = height - padTop - padBottom;

  const counts = useMemo(() => {
    const c = BUCKETS.map(() => 0);
    for (const v of values) {
      const i = BUCKETS.findIndex(b => v >= b.min && v < b.max);
      if (i >= 0) c[i] += 1;
    }
    return c;
  }, [values]);

  const maxCount = Math.max(...counts, 1);
  const slot = width / BUCKETS.length;
  const barW = Math.min(slot * 0.62, 30);

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: duration.slow, easing: easing.out });
  }, [counts, progress]);

  // Expectancy line — where the average R sits across the distribution.
  const avgR = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

  if (values.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>{t('noDataAvailable')}</Text>
      </View>
    );
  }

  return (
    <View>
      <Svg width={width} height={height}>
        {/* Baseline */}
        <Line
          x1={0}
          y1={padTop + chartH}
          x2={width}
          y2={padTop + chartH}
          stroke={theme.colors.borderStrong}
          strokeWidth={1}
        />

        {BUCKETS.map((b, i) => {
          const count = counts[i];
          const full = (count / maxCount) * chartH;
          const x = i * slot + (slot - barW) / 2;
          const isLoss = b.max <= -0.2;
          const isBE = b.label === 'BE';
          const color = isBE
            ? theme.colors.textMuted
            : isLoss
            ? theme.colors.red
            : theme.colors.green;
          const isSel = selected === i;

          return (
            <AnimatedBar
              key={b.label}
              x={x}
              barW={barW}
              full={full}
              baseY={padTop + chartH}
              color={color}
              opacity={selected === null || isSel ? 1 : 0.35}
              progress={progress}
              onPress={() => setSelected(isSel ? null : i)}
            />
          );
        })}

        {/* Count labels */}
        {counts.map((count, i) =>
          count > 0 ? (
            <SvgText
              key={`c${i}`}
              x={i * slot + slot / 2}
              y={padTop + chartH - (count / maxCount) * chartH - 5}
              fill={theme.colors.textSecondary}
              fontSize={9}
              fontFamily={theme.fonts.monoBold}
              textAnchor="middle"
            >
              {count}
            </SvgText>
          ) : null
        )}

        {/* Bucket labels */}
        {BUCKETS.map((b, i) => (
          <SvgText
            key={`l${i}`}
            x={i * slot + slot / 2}
            y={height - 9}
            fill={theme.colors.textMuted}
            fontSize={9}
            fontFamily={theme.fonts.monoMedium}
            textAnchor="middle"
          >
            {b.label}
          </SvgText>
        ))}
      </Svg>

      {/* Readout */}
      <View style={styles.legend}>
        <Text style={styles.legendItem}>
          {t('avgRMultiple')}{' '}
          <Text style={{ color: avgR >= 0 ? theme.colors.green : theme.colors.red }}>
            {avgR >= 0 ? '+' : ''}
            {avgR.toFixed(2)}R
          </Text>
        </Text>
        <Text style={styles.legendItem}>
          {values.length} {t('positions')}
        </Text>
      </View>
    </View>
  );
};

/** Isolated so each bar owns its own animated props hook. */
const AnimatedBar: React.FC<{
  x: number;
  barW: number;
  full: number;
  baseY: number;
  color: string;
  opacity: number;
  progress: SharedValue<number>;
  onPress: () => void;
}> = ({ x, barW, full, baseY, color, opacity, progress, onPress }) => {
  const animated = useAnimatedProps(() => {
    const h = full * progress.value;
    return { height: Math.max(h, 0), y: baseY - h };
  });

  return (
    <ABar
      x={x}
      width={barW}
      rx={2}
      fill={color}
      opacity={opacity}
      animatedProps={animated}
      onPress={onPress}
    />
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    empty: { alignItems: 'center', justifyContent: 'center' },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sans,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: theme.spacing.sm,
    },
    legendItem: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
  });
