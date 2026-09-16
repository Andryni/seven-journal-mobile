import React, { useMemo } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { BarChart3 } from 'lucide-react-native';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT } from '../i18n';
import { localeFor } from '../i18n';
import { useTrades } from '../features/trades/useTrades';
import { useWeeklyReview } from '../features/analytics/useWeeklyReview';
import { useMoney } from '../features/accounts/useMoney';
import { Panel, Hairline } from '../components/ui/Panel';
import { Metric } from '../components/ui/Metric';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { duration, stagger } from '../theme/motion';
import { mentalStateLabel } from '../i18n';
import { scopeTrades } from '../features/accounts/accountScope';
import { useUIStore } from '../store/uiStore';

/**
 * Weekly review — the Sunday ritual, on its own surface.
 *
 * The WeeklyReviewCard lived inside Analytics where nobody opened it on the
 * day it matters. This screen gives the ritual its address in the More menu:
 * five numbers, the week's daily bars, and ONE action for next week derived
 * from the weakest signal — not five KPIs and no conclusion.
 */
export const WeeklyReviewScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeAccountId = useUIStore(s => s.activeAccountId);

  const { trades: allTrades, isLoading } = useTrades();
  const trades = useMemo(() => scopeTrades(allTrades, activeAccountId), [allTrades, activeAccountId]);
  const w = useWeeklyReview(trades);

  /** The one action: the clearest weakness in the week's own data. */
  const action = useMemo<string | null>(() => {
    if (!w.hasData) return null;
    if (w.recurringMistake) {
      const label = mentalStateLabel(t, w.recurringMistake.state).toLowerCase();
      return t('weeklyActionTilt', { state: label, count: w.recurringMistake.count });
    }
    if (w.worstSetup && w.worstSetup.pnl < 0 && w.worstSetup.trades >= 2) {
      return t('weeklyActionSetup', { setup: w.worstSetup.key, pnl: money(w.worstSetup.pnl, { decimals: 0 }) });
    }
    if (w.bestSetup && w.bestSetup.pnl > 0 && w.bestSetup.trades >= 2) {
      return t('weeklyActionBest', { setup: w.bestSetup.key });
    }
    return null;
  }, [w, t, money]);

  const maxAbs = useMemo(
    () => Math.max(...w.dailyPnL.map(d => Math.abs(d.value)), 1),
    [w.dailyPnL]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonCard lines={6} />
      </View>
    );
  }

  if (!w.hasData) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState icon={<BarChart3 size={22} color={theme.colors.textMuted} />} title={t('weeklyEmptyTitle')} description={t('weeklyEmptyMsg')} />
      </View>
    );
  }

  const rangeLabel = `${w.rangeStart.toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short' })} – ${new Date(
    w.rangeEnd.getTime() - 1
  ).toLocaleDateString(localeFor(lang), { day: 'numeric', month: 'short' })}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero: the week's net result and the verdict vs last week. */}
      <Animated.View entering={FadeInDown.duration(duration.slow)} style={styles.hero}>
        <Text style={styles.heroLabel}>{t('weeklyNet')}</Text>
        <Text style={[styles.heroValue, { color: w.netPnL >= 0 ? theme.colors.green : theme.colors.red }]}>
          {money(w.netPnL, { decimals: 0, thousandsSeparator: true })}
        </Text>
        <Text style={[styles.heroDelta, { color: w.deltaPnL >= 0 ? theme.colors.green : theme.colors.red }]}>
          {w.deltaPnL >= 0 ? '▲ +' : '▼ '}
          {money(w.deltaPnL, { decimals: 0 })} {t('weeklyVsPrevShort')}
        </Text>
        <Text style={styles.heroRange}>{rangeLabel}</Text>
      </Animated.View>

      {/* Five numbers. */}
      <Animated.View entering={FadeIn.delay(stagger(1)).duration(duration.base)}>
        <Panel title={t('weeklyReview')}>
          <View style={styles.metricGrid}>
            <Metric label={t('weeklyTrades')} value={String(w.trades)} size="small" />
            <Metric label={t('winRate')} value={`${w.winRate.toFixed(0)}%`} size="small" tone="default" />
            <Metric
              label={t('weeklyAvgR')}
              value={`${w.avgR >= 0 ? '+' : ''}${w.avgR.toFixed(2)}R`}
              size="small"
              tone={w.avgR >= 0 ? 'pnl' : 'info'}
              pnlValue={w.avgR}
            />
          </View>
          <Hairline />
          <View style={styles.metricGrid}>
            <Metric
              label={t('bestSetup')}
              value={w.bestSetup?.key ?? '—'}
              sub={w.bestSetup ? money(w.bestSetup.pnl, { decimals: 0 }) : undefined}
              size="small"
              align="left"
              tone="pnl"
            />
            <Metric
              label={t('worstSetup')}
              value={w.worstSetup?.key ?? '—'}
              sub={w.worstSetup ? money(w.worstSetup.pnl, { decimals: 0 }) : undefined}
              size="small"
              align="right"
              tone="pnl"
              pnlValue={w.worstSetup?.pnl ?? 0}
            />
          </View>
        </Panel>
      </Animated.View>

      {/* The week, Monday-first, bars from a zero baseline. */}
      <Animated.View entering={FadeIn.delay(stagger(2)).duration(duration.base)}>
        <Panel title={t('weeklyDaily')}>
          <View style={styles.barsRow}>
            {w.dailyPnL.map(d => {
              const h = (Math.abs(d.value) / maxAbs) * 44;
              const up = d.value >= 0;
              return (
                <View key={d.label} style={styles.barCol}>
                  <View style={styles.barSlot}>
                    {d.value !== 0 && (
                      <View
                        style={{
                          width: 14,
                          height: Math.max(h, 3),
                          borderRadius: 3,
                          backgroundColor: up ? theme.colors.green : theme.colors.red,
                          marginTop: up ? 44 - h : 0,
                        }}
                      />
                    )}
                  </View>
                  <Text style={styles.barLabel}>{d.label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.zeroLine} />
        </Panel>
      </Animated.View>

      {/* The conclusion: ONE action, from the week's weakest signal. */}
      {action ? (
        <Animated.View entering={FadeIn.delay(stagger(3)).duration(duration.base)}>
          <View style={[styles.actionBox, { borderColor: theme.colors.primary }]}>
            <Text style={[styles.actionTitle, { color: theme.colors.primary }]}>{t('weeklyActionLabel')}</Text>
            <Text style={styles.actionText}>{action}</Text>
          </View>
        </Animated.View>
      ) : null}
    </ScrollView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    center: { alignItems: 'center', justifyContent: 'center' },
    content: {
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    hero: { alignItems: 'center', paddingVertical: theme.spacing.lg },
    heroLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 2,
    },
    heroValue: {
      fontSize: theme.type.hero,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
      marginTop: 6,
    },
    heroDelta: {
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
      marginTop: 4,
    },
    heroRange: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      letterSpacing: 1,
      marginTop: 6,
    },
    metricGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
    barsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingHorizontal: theme.spacing.sm,
    },
    barCol: { alignItems: 'center', gap: 6 },
    barSlot: { height: 44, justifyContent: 'flex-end' },
    barLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.5,
    },
    zeroLine: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.hairline, marginTop: 6 },
    actionBox: {
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.card,
      gap: 6,
    },
    actionTitle: {
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.6,
    },
    actionText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sansSemiBold,
      lineHeight: 18,
    },
  });
