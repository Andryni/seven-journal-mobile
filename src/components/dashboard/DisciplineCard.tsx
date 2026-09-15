import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Panel } from '../ui/Panel';
import { useDisciplineScore } from '../../features/dashboard/useDisciplineScore';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { duration, easing, stagger } from '../../theme/motion';
import type { Trade } from '../../types/domain';

/**
 * Discipline Score card — the replacement for AchievementsCard.
 * A measured process metric instead of a wall of emoji trophies.
 */
export const DisciplineCard: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const d = useDisciplineScore(trades);

  const gradeColor =
    d.grade === 'A'
      ? theme.colors.green
      : d.grade === 'B'
      ? theme.colors.primary
      : d.grade === 'C'
      ? theme.colors.gold
      : theme.colors.red;

  const labels: Record<string, string> = {
    risk: t('disciplineRisk'),
    plan: t('disciplinePlan'),
    sizing: t('disciplineSizing'),
    revenge: t('disciplineRevenge'),
  };

  return (
    <Panel title={t('disciplineScore')} subtitle={t('disciplineDesc')}>
      <View style={styles.head}>
        <AnimatedNumber
          value={d.score}
          format={v => String(Math.round(v))}
          style={[styles.score, { color: gradeColor }]}
        />
        <Text style={styles.outOf}>/100</Text>
        <View style={[styles.gradeChip, { backgroundColor: gradeColor + '1A' }]}>
          <Text style={[styles.gradeText, { color: gradeColor }]}>{d.grade}</Text>
        </View>
      </View>

      <View style={styles.bars}>
        {d.components.map((c, i) => {
          const color =
            c.score >= 80 ? theme.colors.green : c.score >= 50 ? theme.colors.gold : theme.colors.red;
          return (
            <View key={c.id} style={styles.barRow}>
              <Text style={styles.barLabel} numberOfLines={1}>
                {labels[c.id]}
              </Text>
              <View style={styles.track}>
                <ScoreBar score={c.score} color={color} index={i} />
              </View>
              <Text style={[styles.barValue, { color }]}>{c.score}</Text>
            </View>
          );
        })}
      </View>
    </Panel>
  );
};

/**
 * Each bar fills from zero on mount, staggered left-to-right, so the card
 * reads as a measurement being taken rather than a static grid.
 */
const ScoreBar: React.FC<{ score: number; color: string; index: number }> = ({
  score,
  color,
  index,
}) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      stagger(index, 70),
      withTiming(score / 100, { duration: duration.slow, easing: easing.out })
    );
  }, [score, index, progress]);

  const style = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      style={[{ height: '100%', borderRadius: 2, backgroundColor: color }, style]}
    />
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginBottom: theme.spacing.lg },
    score: {
      fontSize: theme.type.hero,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1.5,
    },
    outOf: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.mono,
    },
    gradeChip: {
      marginLeft: 'auto',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: theme.borderRadius.xs,
    },
    gradeText: {
      fontSize: theme.type.metricSm,
      fontFamily: theme.fonts.monoExtraBold,
    },
    bars: { gap: 10 },
    barRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
    barLabel: {
      width: 120,
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoMedium,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
    },
    track: {
      flex: 1,
      height: 3,
      backgroundColor: theme.colors.surfaceLight,
      borderRadius: 2,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 2 },
    barValue: {
      width: 26,
      textAlign: 'right',
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
  });
