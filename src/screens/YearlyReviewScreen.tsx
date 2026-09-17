import React, { useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { CalendarRange, ChevronLeft, ChevronRight, Share2 } from 'lucide-react-native';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT, localeFor } from '../i18n';
import { useTrades } from '../features/trades/useTrades';
import { useYearlyReview } from '../features/analytics/useYearlyReview';
import { useMoney } from '../features/accounts/useMoney';
import { Panel, Hairline } from '../components/ui/Panel';
import { Metric } from '../components/ui/Metric';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonCard } from '../components/ui/Skeleton';
import { Sparkline } from '../components/ui/Sparkline';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { PressableScale } from '../components/ui/PressableScale';
import { duration, stagger } from '../theme/motion';
import { scopeTrades } from '../features/accounts/accountScope';
import { useAccounts } from '../features/accounts/useAccounts';
import { useUIStore } from '../store/uiStore';

/**
 * Yearly review — the ritual zoomed out to twelve months.
 *
 * Same skeleton as the weekly and monthly reviews on purpose: a ritual
 * survives on familiarity. What the year adds is concentration: twelve
 * month-bars expose the quarter that made the year and the stretch that bled,
 * and the best/worst month verdicts name them — the month-to-month delta of
 * the monthly review averages exactly that away.
 */
export const YearlyReviewScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeAccountId = useUIStore(s => s.activeAccountId);
  const { accounts } = useAccounts();

  const { trades: allTrades, isLoading } = useTrades();
  const trades = useMemo(() => scopeTrades(allTrades, activeAccountId), [allTrades, activeAccountId]);

  /** Year navigation, back from the live year — same pattern as the monthly review. */
  const [yearsBack, setYearsBack] = useState(0);
  const year = useMemo(() => new Date().getFullYear() - yearsBack, [yearsBack]);
  const y = useYearlyReview(trades, year);

  const [shareModalVisible, setShareModalVisible] = useState(false);

  const monthName = (m: number) =>
    new Date(y.year, m, 1).toLocaleDateString(localeFor(lang), { month: 'short' });

  const maxAbs = useMemo(
    () => Math.max(...y.monthlyPnL.map(d => Math.abs(d.value)), 1),
    [y.monthlyPnL]
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <SkeletonCard lines={6} />
      </View>
    );
  }

  if (!y.hasData) {
    return (
      <View style={[styles.container, styles.center]}>
        <EmptyState
          icon={<CalendarRange size={22} color={theme.colors.textMuted} />}
          title={t('yearlyEmptyTitle')}
          description={t('yearlyEmptyMsg')}
        />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero: the year's net result, with the arrows to walk back through years. */}
      <Animated.View entering={FadeInDown.duration(duration.slow)} style={styles.hero}>
        <View style={styles.heroTopRow}>
          <Text style={styles.heroLabel}>{t('yearlyNet')}</Text>
          <PressableScale
            style={styles.shareBtn}
            onPress={() => setShareModalVisible(true)}
            accessibilityLabel={t('sharePnl')}
            hitSlop={8}
          >
            <Share2 size={13} color={theme.colors.textSecondary} strokeWidth={1.75} />
          </PressableScale>
        </View>
        <Text style={[styles.heroValue, { color: y.netPnL >= 0 ? theme.colors.green : theme.colors.red }]}>
          {money(y.netPnL, { decimals: 0, thousandsSeparator: true })}
        </Text>
        <Text style={styles.heroRange}>{y.year}</Text>
        {/* Shown while an earlier year exists OR the view is navigated: the
            first year of the journal must still leave a way forward. */}
        {y.canGoPrev || yearsBack > 0 ? (
          <View style={styles.navRow}>
            {y.canGoPrev ? (
              <PressableScale
                onPress={() => setYearsBack(b => b + 1)}
                hitSlop={8}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel={t('a11yPrevYear')}
                testID="yearly-prev"
              >
                <ChevronLeft size={14} color={theme.colors.textPrimary} strokeWidth={2.2} />
              </PressableScale>
            ) : null}
            {yearsBack > 0 ? (
              <PressableScale
                onPress={() => setYearsBack(b => Math.max(0, b - 1))}
                hitSlop={8}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel={t('a11yNextYear')}
                testID="yearly-next"
              >
                <ChevronRight size={14} color={theme.colors.textPrimary} strokeWidth={2.2} />
              </PressableScale>
            ) : null}
          </View>
        ) : null}
      </Animated.View>

      {/* The year as one cumulative curve: concentration and drawdowns at a glance. */}
      {y.cumPnL.length > 1 ? (
        <Animated.View entering={FadeIn.delay(stagger(1)).duration(duration.base)}>
          <Panel title={t('yearlyCurve')}>
            <View style={styles.curveBox}>
              <Sparkline data={y.cumPnL} baseline={0} width={320} height={72} strokeWidth={1.8} />
            </View>
          </Panel>
        </Animated.View>
      ) : null}

      {/* Twelve month-bars, centred on zero: where the year happened. */}
      <Animated.View entering={FadeIn.delay(stagger(2)).duration(duration.base)}>
        <Panel title={t('yearlyByMonth')}>
          <View style={styles.barsRow}>
            {y.monthlyPnL.map((m, i) => {
              const h = (Math.abs(m.value) / maxAbs) * 44;
              const up = m.value >= 0;
              return (
                <View key={m.label} style={styles.barCol}>
                  <View style={styles.barSlot}>
                    {m.value !== 0 && (
                      <View
                        style={{
                          width: 9,
                          height: Math.max(h, 3),
                          borderRadius: 2,
                          backgroundColor: up ? theme.colors.green : theme.colors.red,
                          marginTop: up ? 44 - h : 0,
                        }}
                      />
                    )}
                  </View>
                  <Text style={styles.barLabel}>{monthName(i).toUpperCase()}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.zeroLine} />
          <View style={styles.verdicts}>
            {y.bestMonth ? (
              <Text style={[styles.verdict, { color: theme.colors.green }]}>
                ▲{' '}
                {t('yearlyBestMonth', {
                  month: monthName(y.bestMonth.month),
                  pnl: money(y.bestMonth.value, { decimals: 0 }),
                })}
              </Text>
            ) : null}
            {y.worstMonth && y.worstMonth.value < 0 ? (
              <Text style={[styles.verdict, { color: theme.colors.red }]}>
                ▼{' '}
                {t('yearlyWorstMonth', {
                  month: monthName(y.worstMonth.month),
                  pnl: money(y.worstMonth.value, { decimals: 0 }),
                })}
              </Text>
            ) : null}
          </View>
        </Panel>
      </Animated.View>

      {/* The year in eight numbers. */}
      <Animated.View entering={FadeIn.delay(stagger(3)).duration(duration.base)}>
        <Panel title={t('yearlyReview')}>
          <View style={styles.metricGrid}>
            <Metric label={t('yearlyTrades')} value={String(y.trades)} size="small" />
            <Metric label={t('winRate')} value={`${y.winRate.toFixed(0)}%`} size="small" tone="default" />
            <Metric
              label={t('scCumulR')}
              value={`${y.totalR >= 0 ? '+' : ''}${y.totalR.toFixed(1)}R`}
              size="small"
              tone={y.totalR >= 0 ? 'pnl' : 'info'}
              pnlValue={y.totalR}
            />
          </View>
          <Hairline />
          <View style={styles.metricGrid}>
            <Metric
              label={t('bestSetup')}
              value={y.bestMonth ? monthName(y.bestMonth.month) : '—'}
              sub={y.bestMonth ? money(y.bestMonth.value, { decimals: 0 }) : undefined}
              size="small"
              align="left"
              tone="pnl"
              pnlValue={y.bestMonth?.value ?? 0}
            />
            <Metric
              label={t('worstSetup')}
              value={y.worstMonth ? monthName(y.worstMonth.month) : '—'}
              sub={y.worstMonth ? money(y.worstMonth.value, { decimals: 0 }) : undefined}
              size="small"
              align="right"
              tone="pnl"
              pnlValue={y.worstMonth?.value ?? 0}
            />
          </View>
          <Hairline />
          <Metric
            label={t('yearlyStreaks')}
            value={t('yearlyStreaksValue', { green: y.bestStreak, red: y.worstStreak })}
            size="small"
          />
        </Panel>
      </Animated.View>

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
    heroRange: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      letterSpacing: 1,
      marginTop: 6,
    },
    curveBox: { alignItems: 'center', paddingVertical: theme.spacing.sm },
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
      fontSize: 7,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0,
    },
    zeroLine: { height: StyleSheet.hairlineWidth, backgroundColor: theme.colors.hairline, marginTop: 6 },
    verdicts: { marginTop: 10, gap: 3 },
    verdict: {
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    metricGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: theme.spacing.sm,
    },
  });
