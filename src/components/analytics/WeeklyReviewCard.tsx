import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Panel, Hairline } from '../ui/Panel';
import { Sparkline } from '../ui/Sparkline';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { useMoney } from '../../features/accounts/useMoney';
import { useWeeklyReview } from '../../features/analytics/useWeeklyReview';
import { duration, stagger } from '../../theme/motion';
import type { Trade } from '../../types/domain';

/**
 * Weekly Review — the feedback loop the journal was missing.
 *
 * Everything here is a delta or a ranking: absolute numbers already live on
 * the dashboard. The question this answers is "am I getting better, and at
 * what".
 */
export const WeeklyReviewCard: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const { theme } = useTheme();
  const money = useMoney();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const w = useWeeklyReview(trades);

  const mentalLabels: Record<string, string> = {
    revenge: t('mentalRevenge'),
    fomo: t('mentalFomo'),
    greedy: t('mentalGreedy'),
  };

  // Cumulative curve across the week, for the sparkline.
  const cumulative = useMemo(() => {
    let acc = 0;
    return w.dailyPnL.map(d => (acc += d.value));
  }, [w.dailyPnL]);

  const rangeLabel = `${w.rangeStart.getDate()}/${w.rangeStart.getMonth() + 1} — ${new Date(
    w.rangeEnd.getTime() - 1
  ).getDate()}/${w.rangeStart.getMonth() + 1}`;

  if (!w.hasData) {
    return (
      <Panel title={t('weeklyReview')} subtitle={rangeLabel}>
        <Text style={styles.empty}>{t('noWeekData')}</Text>
      </Panel>
    );
  }

  const DeltaIcon = w.deltaPnL > 0 ? TrendingUp : w.deltaPnL < 0 ? TrendingDown : Minus;
  const deltaColor =
    w.deltaPnL > 0 ? theme.colors.green : w.deltaPnL < 0 ? theme.colors.red : theme.colors.textMuted;

  return (
    <Panel title={t('weeklyReview')} subtitle={rangeLabel}>
      {/* Headline: the week's P&L, its delta, and its shape */}
      <Animated.View entering={FadeIn.duration(duration.base)} style={styles.head}>
        <View style={{ flex: 1 }}>
          <AnimatedNumber
            value={w.netPnL}
            format={v => money(v, { thousandsSeparator: true })}
            style={[
              styles.headValue,
              { color: w.netPnL >= 0 ? theme.colors.green : theme.colors.red },
            ]}
          />
          <View style={styles.deltaRow}>
            <DeltaIcon size={11} color={deltaColor} strokeWidth={2} />
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {/* No manual '+': the formatter already signs positives, and
                  this line used to read "++$400". */}
              {money(w.deltaPnL, { decimals: 0 })}
            </Text>
            <Text style={styles.deltaLabel}>{t('weeklyVsPrev')}</Text>
          </View>
        </View>
        <Sparkline data={cumulative} baseline={0} width={86} height={34} />
      </Animated.View>

      <Hairline style={{ marginVertical: theme.spacing.md }} />

      {/* Three-up stat line */}
      <View style={styles.stats}>
        <Stat label={t('tradesCount')} value={String(w.trades)} theme={theme} />
        <View style={styles.vRule} />
        <Stat
          label={t('winRate')}
          value={`${w.winRate.toFixed(0)}%`}
          color={w.winRate >= 50 ? theme.colors.green : theme.colors.red}
          theme={theme}
        />
        <View style={styles.vRule} />
        <Stat
          label={t('avgRMultiple')}
          value={`${w.avgR >= 0 ? '+' : ''}${w.avgR.toFixed(2)}R`}
          sub={`${w.deltaAvgR >= 0 ? '+' : ''}${w.deltaAvgR.toFixed(2)}`}
          color={w.avgR >= 0 ? theme.colors.green : theme.colors.red}
          theme={theme}
        />
      </View>

      <Hairline style={{ marginVertical: theme.spacing.md }} />

      {/* Rankings — what actually paid this week */}
      {w.bestSetup ? (
        <Insight
          index={0}
          label={t('bestSetup')}
          name={w.bestSetup.key}
          value={money(w.bestSetup.pnl, { decimals: 0 })}
          meta={`${w.bestSetup.trades}T · ${w.bestSetup.winRate.toFixed(0)}%`}
          color={theme.colors.green}
          theme={theme}
        />
      ) : null}

      {w.worstSetup && w.worstSetup.key !== w.bestSetup?.key ? (
        <Insight
          index={1}
          label={t('worstSetup')}
          name={w.worstSetup.key}
          value={money(w.worstSetup.pnl, { decimals: 0 })}
          meta={`${w.worstSetup.trades}T · ${w.worstSetup.winRate.toFixed(0)}%`}
          color={theme.colors.red}
          theme={theme}
        />
      ) : null}

      {w.bestSession ? (
        <Insight
          index={2}
          label={t('bestSession')}
          name={w.bestSession.key}
          value={money(w.bestSession.pnl, { decimals: 0 })}
          meta={`${w.bestSession.trades}T`}
          color={theme.colors.cyan}
          theme={theme}
        />
      ) : null}

      {/* Behavioural flag */}
      {w.recurringMistake ? (
        <Animated.View
          entering={FadeIn.delay(stagger(3)).duration(duration.base)}
          style={styles.warning}
        >
          <AlertTriangle size={13} color={theme.colors.gold} strokeWidth={2} />
          <Text style={styles.warningText}>
            <Text style={styles.warningLabel}>{t('recurringMistake')} </Text>
            {mentalLabels[w.recurringMistake.state] ?? w.recurringMistake.state} ×
            {w.recurringMistake.count}
          </Text>
        </Animated.View>
      ) : null}
    </Panel>
  );
};

const Stat: React.FC<{
  label: string;
  value: string;
  sub?: string;
  color?: string;
  theme: AppTheme;
}> = ({ label, value, sub, color, theme }) => (
  <View style={{ flex: 1, alignItems: 'center' }}>
    <Text
      style={{
        color: theme.colors.textMuted,
        fontSize: theme.type.micro,
        fontFamily: theme.fonts.monoBold,
        letterSpacing: 0.9,
        textTransform: 'uppercase',
        marginBottom: 4,
      }}
      numberOfLines={1}
    >
      {label}
    </Text>
    <Text
      style={{
        color: color ?? theme.colors.textPrimary,
        fontSize: theme.type.metricSm,
        fontFamily: theme.fonts.monoExtraBold,
        fontVariant: ['tabular-nums'],
      }}
    >
      {value}
    </Text>
    {sub ? (
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 9,
          fontFamily: theme.fonts.mono,
          marginTop: 2,
        }}
      >
        {sub}
      </Text>
    ) : null}
  </View>
);

const Insight: React.FC<{
  index: number;
  label: string;
  name: string;
  value: string;
  meta: string;
  color: string;
  theme: AppTheme;
}> = ({ index, label, name, value, meta, color, theme }) => (
  <Animated.View
    entering={FadeIn.delay(stagger(index)).duration(duration.base)}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 8,
      gap: theme.spacing.sm,
    }}
  >
    <View style={{ width: 2, height: 22, borderRadius: 1, backgroundColor: color }} />
    <View style={{ flex: 1 }}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 9,
          fontFamily: theme.fonts.monoBold,
          letterSpacing: 1,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: theme.colors.textPrimary,
          fontSize: theme.type.body,
          fontFamily: theme.fonts.monoMedium,
          marginTop: 2,
        }}
        numberOfLines={1}
      >
        {name}
      </Text>
    </View>
    <View style={{ alignItems: 'flex-end' }}>
      <Text
        style={{
          color,
          fontSize: theme.type.body,
          fontFamily: theme.fonts.monoExtraBold,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 9,
          fontFamily: theme.fonts.mono,
          marginTop: 2,
        }}
      >
        {meta}
      </Text>
    </View>
  </Animated.View>
);

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    empty: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sans,
      textAlign: 'center',
      paddingVertical: theme.spacing.lg,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    headValue: {
      fontSize: theme.type.display,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.8,
    },
    deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
    deltaText: {
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    deltaLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
    },
    stats: { flexDirection: 'row', alignItems: 'center' },
    vRule: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: theme.colors.hairline,
    },
    warning: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      backgroundColor: theme.colors.goldGlow,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    warningText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoMedium,
    },
    warningLabel: { color: theme.colors.gold, fontFamily: theme.fonts.monoBold },
  });
