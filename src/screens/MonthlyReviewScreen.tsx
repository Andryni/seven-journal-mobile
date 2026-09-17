import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { CalendarRange, ChevronLeft, ChevronRight, Share2 } from 'lucide-react-native';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT, localeFor, mentalStateLabel } from '../i18n';
import { useTrades } from '../features/trades/useTrades';
import { useMonthlyReview, monthlyPnlHistory } from '../features/analytics/periodReview';
import { useMoney } from '../features/accounts/useMoney';
import { Panel, Hairline } from '../components/ui/Panel';
import { Metric } from '../components/ui/Metric';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { SeriesStrip } from '../components/ui/SeriesStrip';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { PressableScale } from '../components/ui/PressableScale';
import { duration, stagger } from '../theme/motion';
import { scopeTrades } from '../features/accounts/accountScope';
import { useAccounts } from '../features/accounts/useAccounts';
import { useUIStore } from '../store/uiStore';

/**
 * Monthly review — the weekly ritual zoomed out.
 *
 * Same skeleton as WeeklyReviewScreen on purpose: a ritual survives on
 * familiarity. What changes with the horizon is the calendar: at a month the
 * daily bars show the shape of the whole month and the best/worst DAY are
 * named, which a week is too short to reveal.
 */
export const MonthlyReviewScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeAccountId = useUIStore(s => s.activeAccountId);
  const { accounts } = useAccounts();

  const { trades: allTrades, isLoading } = useTrades();
  const trades = useMemo(() => scopeTrades(allTrades, activeAccountId), [allTrades, activeAccountId]);

  /**
   * Period navigation, in months back from the live month.
   *
   * The default is 0 — the review always opens on the month you are in. The
   * arrows move the anchor; the hook recomputes every figure against the
   * anchored month and its predecessor, so "vs mois dernier" always compares
   * the month on screen with the one before it, not with the live one.
   */
  const [monthsBack, setMonthsBack] = useState(0);
  const anchor = useMemo(
    () => new Date(new Date().getFullYear(), new Date().getMonth() - monthsBack, 1),
    [monthsBack]
  );
  const m = useMonthlyReview(trades, anchor);

  /**
   * Gains per month since the first trade, through the END of the anchored
   * month: the bound is exclusive, so passing the anchor's start would drop
   * the very month under review — the live month-to-date included.
   */
  const historyTo = useMemo(
    () => new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1),
    [anchor]
  );
  const monthlyHistory = useMemo(
    () => monthlyPnlHistory(trades, historyTo),
    [trades, historyTo]
  );

  const [shareModalVisible, setShareModalVisible] = useState(false);

  /** The one action: the clearest weakness in the month's own data. */
  const action = useMemo<string | null>(() => {
    if (!m.hasData) return null;
    if (m.recurringMistake) {
      const label = mentalStateLabel(t, m.recurringMistake.state).toLowerCase();
      return t('monthlyActionTilt', { state: label, count: m.recurringMistake.count });
    }
    if (m.worstSetup && m.worstSetup.pnl < 0 && m.worstSetup.trades >= 2) {
      return t('monthlyActionSetup', { setup: m.worstSetup.key, pnl: money(m.worstSetup.pnl, { decimals: 0 }) });
    }
    if (m.bestSetup && m.bestSetup.pnl > 0 && m.bestSetup.trades >= 2) {
      return t('monthlyActionBest', { setup: m.bestSetup.key });
    }
    return null;
  }, [m, t, money]);

  const maxAbs = useMemo(
    () => Math.max(...m.dailyPnL.map(d => Math.abs(d.value)), 1),
    [m.dailyPnL]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonCard lines={6} />
      </View>
    );
  }

  if (!m.hasData) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState icon={<CalendarRange size={22} color={theme.colors.textMuted} />} title={t('monthlyEmptyTitle')} description={t('monthlyEmptyMsg')} />
      </View>
    );
  }

  const monthLabel = m.rangeStart.toLocaleDateString(localeFor(lang), {
    month: 'long',
    year: 'numeric',
  });

  const prevMonthLabel = m.prevStart.toLocaleDateString(localeFor(lang), {
    month: 'long',
    year: 'numeric',
  });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero: the month's net result and the verdict vs last month. */}
      <Animated.View entering={FadeInDown.duration(duration.slow)} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroLabel}>{t('monthlyNet')}</Text>
          <PressableScale
            style={styles.shareBtn}
            onPress={() => setShareModalVisible(true)}
            accessibilityLabel={t('sharePnl')}
            hitSlop={10}
          >
            <Share2 size={13} color={theme.colors.textSecondary} strokeWidth={1.75} />
          </PressableScale>
        </View>
        <Text style={[styles.heroValue, { color: m.netPnL >= 0 ? theme.colors.green : theme.colors.red }]}>
          {money(m.netPnL, { decimals: 0, thousandsSeparator: true })}
        </Text>
        <Text style={[styles.heroDelta, { color: m.deltaPnL >= 0 ? theme.colors.green : theme.colors.red }]}>
          {/* The sign travels with the money format; a manual '+' here doubled
              it -- same bug as the weekly review's "++$1550". */}
          {m.deltaPnL >= 0 ? '▲ ' : '▼ '}
          {money(m.deltaPnL, { decimals: 0 })} {t('monthlyVsPrevShort')}
        </Text>
        <Text style={styles.heroRange}>{monthLabel}</Text>
        {/* The affordance for moving the whole review between months. Shown
            while an earlier month exists OR the view is navigated: stepping
            back to the journal's first month must still leave a way forward. */}
        {m.canGoPrev || monthsBack > 0 ? (
          <View style={styles.navRow}>
            {m.canGoPrev ? (
              <PressableScale
                onPress={() => setMonthsBack(b => b + 1)}
                hitSlop={10}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel={t('a11yPrevMonth')}
                testID="monthly-prev"
              >
                <ChevronLeft size={14} color={theme.colors.textPrimary} strokeWidth={2.2} />
              </PressableScale>
            ) : null}
            {monthsBack > 0 ? (
              <PressableScale
                onPress={() => setMonthsBack(b => Math.max(0, b - 1))}
                hitSlop={10}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel={t('a11yNextMonth')}
                testID="monthly-next"
              >
                <ChevronRight size={14} color={theme.colors.textPrimary} strokeWidth={2.2} />
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </Animated.View>

      {/* Month vs month: cumulative mini-curves, this month against the one before it. */}
      <Animated.View entering={FadeIn.delay(stagger(1)).duration(duration.base)}>
        <SeriesStrip
          title={t('seriesMonthVsMonth')}
          leftCaption={monthLabel.toUpperCase()}
          rightCaption={t('monthlyPrevLabel', { month: prevMonthLabel }).toUpperCase()}
          current={m.cumPnL}
          previous={m.prevCumPnL}
          currentNet={money(m.netPnL, { decimals: 0, thousandsSeparator: true })}
          previousNet={money(m.prevPnL, { decimals: 0, thousandsSeparator: true })}
          currentPositive={m.netPnL >= 0}
        />
      </Animated.View>

      {/* Week vs week inside the month: the calendar weeks, side by side. */}
      <Animated.View entering={FadeIn.delay(stagger(2)).duration(duration.base)}>
        <SeriesStrip
          title={t('seriesWeekVsWeek')}
          leftCaption={t('weeklyCaption').toUpperCase()}
          rightCaption={t('prevMonthWeeksCaption', { month: prevMonthLabel }).toUpperCase()}
          current={weekCumulative(m.weeklyPnL)}
          previous={weekCumulative(m.prevWeeklyPnL)}
          currentNet={money(sumPnl(m.weeklyPnL), { decimals: 0, thousandsSeparator: true })}
          previousNet={money(sumPnl(m.prevWeeklyPnL), { decimals: 0, thousandsSeparator: true })}
          currentPositive={sumPnl(m.weeklyPnL) >= 0}
        />
      </Animated.View>

      {/* Gains per month: one mini curve over the journal's whole history. */}
      {monthlyHistory.length > 1 ? (
        <Animated.View entering={FadeIn.delay(stagger(3)).duration(duration.base)}>
          <SeriesStrip
            title={t('seriesMonthlyHistory')}
            leftCaption={t('seriesMonthlyHistoryCaption').toUpperCase()}
            rightCaption={t('seriesMonthlyHistoryNet').toUpperCase()}
            current={monthlyHistory.map(h => h.value)}
            previous={[]}
            currentNet={money(
              monthlyHistory.reduce((s, h) => s + h.value, 0),
              { decimals: 0, thousandsSeparator: true }
            )}
            previousNet={t('seriesMonthlyHistoryTrades', String(monthlyHistory.reduce((s, h) => s + h.trades, 0)))}
            currentPositive={monthlyHistory.reduce((s, h) => s + h.value, 0) >= 0}
          />
        </Animated.View>
      ) : null}

      {/* Six numbers. */}
      <Animated.View entering={FadeIn.delay(stagger(4)).duration(duration.base)}>
        <Panel title={t('monthlyReview')}>
          <View style={styles.metricGrid}>
            <Metric label={t('monthlyTrades')} value={String(m.trades)} size="small" />
            <Metric label={t('winRate')} value={`${m.winRate.toFixed(0)}%`} size="small" tone="default" />
            <Metric
              label={t('monthlyAvgR')}
              value={`${m.avgR >= 0 ? '+' : ''}${m.avgR.toFixed(2)}R`}
              size="small"
              tone={m.avgR >= 0 ? 'pnl' : 'info'}
              pnlValue={m.avgR}
            />
          </View>
          <Hairline />
          <View style={styles.metricGrid}>
            <Metric
              label={t('monthlyGreenDays')}
              value={`${m.greenDays}/${m.tradingDays}`}
              sub={t('monthlyGreenSub')}
              size="small"
            />
            <Metric
              label={t('bestSetup')}
              value={m.bestSetup?.key ?? '—'}
              sub={m.bestSetup ? money(m.bestSetup.pnl, { decimals: 0 }) : undefined}
              size="small"
              align="left"
              tone="pnl"
            />
            <Metric
              label={t('worstSetup')}
              value={m.worstSetup?.key ?? '—'}
              sub={m.worstSetup ? money(m.worstSetup.pnl, { decimals: 0 }) : undefined}
              size="small"
              align="right"
              tone="pnl"
              pnlValue={m.worstSetup?.pnl ?? 0}
            />
          </View>
        </Panel>
      </Animated.View>

      {/* The month, day 1 first, bars from a zero baseline. */}
      <Animated.View entering={FadeIn.delay(stagger(5)).duration(duration.base)}>
        <Panel title={t('monthlyDaily')}>
          <View style={styles.barsRow}>
            {m.dailyPnL.map(d => {
              const h = (Math.abs(d.value) / maxAbs) * 44;
              const up = d.value >= 0;
              // Extremes stay lit, the rest dims: the verdicts below name the
              // best/worst day, the chart should point at the same ones.
              const isExtreme =
                (m.bestDay && d.label === m.bestDay.label) ||
                (m.worstDay && d.label === m.worstDay.label);
              return (
                <View key={d.label} style={styles.barCol}>
                  <View style={styles.barSlot}>
                    {d.value !== 0 && (
                      <View
                        style={{
                          width: 8,
                          height: Math.max(h, 3),
                          borderRadius: 2,
                          backgroundColor: up ? theme.colors.green : theme.colors.red,
                          marginTop: up ? 44 - h : 0,
                        }}
                      />
                    )}
                  </View>
                  {/* Day numbers at a stride; extremes keep full opacity. */}
                  <Text
                    style={[
                      styles.barLabel,
                      Number(d.label) % 5 !== 0 && !isExtreme && styles.barLabelDim,
                      isExtreme && styles.barLabelStrong,
                    ]}
                  >
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={styles.zeroLine} />
          {(m.bestDay || m.worstDay) && (
            <View style={styles.dayVerdicts}>
              {m.bestDay ? (
                <Text style={[styles.dayVerdict, { color: theme.colors.green }]}>
                  {t('monthlyBestDay', { day: m.bestDay.label, pnl: money(m.bestDay.value, { decimals: 0 }) })}
                </Text>
              ) : null}
              {m.worstDay && m.worstDay.value < 0 ? (
                <Text style={[styles.dayVerdict, { color: theme.colors.red }]}>
                  {t('monthlyWorstDay', { day: m.worstDay.label, pnl: money(m.worstDay.value, { decimals: 0 }) })}
                </Text>
              ) : null}
            </View>
          )}
        </Panel>
      </Animated.View>

      {/* The conclusion: ONE action, from the month's weakest signal. */}
      {action ? (
        <Animated.View entering={FadeIn.delay(stagger(6)).duration(duration.base)}>
          <View style={[styles.actionBox, { borderColor: theme.colors.primary }]}>
            <Text style={[styles.actionTitle, { color: theme.colors.primary }]}>{t('monthlyActionLabel')}</Text>
            <Text style={styles.actionText}>{action}</Text>
          </View>
        </Animated.View>
      ) : null}

      <ShareCardModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        trades={trades}
        accountName={
          accounts.find(a => a.id === activeAccountId)?.name || accounts[0]?.name || 'Seven Journal'
        }
      />
    </ScrollView>
  );
};

/** Cumulative curve over a per-period series: the mini curve reads total drift, not each bar. */
function weekCumulative(weeks: { value: number }[]): number[] {
  let acc = 0;
  return weeks.map(w => {
    acc += w.value;
    return Math.round(acc * 100) / 100;
  });
}

function sumPnl(weeks: { value: number }[]): number {
  return Math.round(weeks.reduce((s, w) => s + w.value, 0) * 100) / 100;
}

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
    heroTopRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.sm,
    },
    shareBtn: {
      width: 30,
      height: 30,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    navRow: {
      flexDirection: 'row',
      gap: 6,
      marginTop: 10,
    },
    navBtn: {
      width: 28,
      height: 28,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
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
      textTransform: 'capitalize',
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
      paddingHorizontal: theme.spacing.xs,
    },
    barCol: { alignItems: 'center', gap: 4, flex: 1 },
    barSlot: { height: 44, justifyContent: 'flex-end', alignItems: 'center' },
    barLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0,
    },
    barLabelDim: { color: 'transparent' },
    barLabelStrong: {
      color: theme.colors.textSecondary,
      fontFamily: theme.fonts.monoBold,
    },
    zeroLine: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.hairline, marginTop: 6 },
    dayVerdicts: { marginTop: 10, gap: 3 },
    dayVerdict: {
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
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
