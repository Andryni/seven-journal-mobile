import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../types/navigation';
import { useTrades } from '../features/trades/useTrades';
import { useAccounts } from '../features/accounts/useAccounts';
import { useDailyLock } from '../features/guard/useDailyLock';
import { computeMetricTrends } from '../features/dashboard/metricTrends';
import { outcomeVariant } from '../utils/tradeOutcome';
import { usePerformanceMetrics } from '../features/dashboard/usePerformanceMetrics';
import type { Trade } from '../types/domain';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { localeFor, useT } from '../i18n';
import { Panel, Hairline } from '../components/ui/Panel';
import { LivePanel } from '../components/ui/LivePanel';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { GlowingEquityAreaChart } from '../components/ui/GlowingEquityAreaChart';
import { BicolorBarChart } from '../components/ui/BicolorBarChart';
import { ShieldAlert, Share2, ChevronRight, BookOpen, Info } from 'lucide-react-native';
import { MarketSessionsBar } from '../components/dashboard/MarketSessionsBar';
import { DailyRiskGauge } from '../components/dashboard/DailyRiskGauge';
import { DisciplineCard } from '../components/dashboard/DisciplineCard';
import { CostImpactCard } from '../components/dashboard/CostImpactCard';
import { ExcursionCard } from '../components/dashboard/ExcursionCard';
import { EmptyState } from '../components/ui/EmptyState';
import { PressableScale } from '../components/ui/PressableScale';
import { useUIStore } from '../store/uiStore';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { Sparkline } from '../components/ui/Sparkline';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { duration, stagger } from '../theme/motion';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useMoney, useCurrencySymbol } from '../features/accounts/useMoney';
import { isSameLocalDay } from '../utils/formatDate';
import { scopeTrades, hasMixedCurrencies } from '../features/accounts/accountScope';

/**
 * Dashboard — "Trading Desk" rebuild.
 *
 * The previous version stacked a fake live ticker, a hero gradient, an
 * achievements wall, a checklist, a position calculator, a risk gauge and a
 * sessions bar into one scroll. That reads as a feed, not a cockpit.
 *
 * This version answers, in order: how much am I up? how much risk is left
 * today? what does the curve look like? what did I just do? Everything else
 * moved to the screen where it actually belongs.
 */
export const DashboardScreen: React.FC = () => {
  const { theme } = useTheme();
  const money = useMoney();
  const sym = useCurrencySymbol();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { isLocked, lockReason } = useDailyLock();
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const activeAccountId = useUIStore(s => s.activeAccountId);

  const [shareModalVisible, setShareModalVisible] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find(a => a.id === activeAccountId) ?? accounts[0] ?? null,
    [accounts, activeAccountId]
  );

  /**
   * Every figure on this screen is scoped to the selected account.
   *
   * It previously fed the raw `trades` list to usePerformanceMetrics while the
   * currency symbol came from the active account, so selecting a EUR account
   * relabelled the combined P&L of every account as euros. DailyRiskGauge
   * already filtered by account, which made the gauge disagree with the hero
   * number right above it.
   */
  const scopedTrades = useMemo(
    () => scopeTrades(trades, activeAccountId),
    [trades, activeAccountId]
  );

  /**
   * With no account selected we show a combined view. That total is only
   * honest if the accounts share a currency.
   */
  const mixedCurrencies = useMemo(
    () => hasMixedCurrencies(trades, accounts, activeAccountId),
    [trades, accounts, activeAccountId]
  );

  const m = usePerformanceMetrics(scopedTrades, lang);

  const todayPnL = useMemo(
    () =>
      scopedTrades
        .filter(tr => isSameLocalDay(tr.entry_time))
        .reduce((sum, tr) => sum + (tr.pnl || 0), 0),
    [scopedTrades]
  );

  /** Cumulative equity points, for the hero sparkline. */
  const equitySeries = useMemo(
    () => m.equityCurve.map(e => e.pnl),
    [m.equityCurve]
  );

  const trends = useMemo(() => computeMetricTrends(scopedTrades), [scopedTrades]);

  /**
   * The KPI frame states the verdict before the numbers are read: green when
   * the book is net positive AND the expectancy per trade is, red when it is
   * losing, neutral until there is enough closed activity to judge.
   */
  const kpiTone: 'neutral' | 'positive' | 'negative' = useMemo(() => {
    if (m.closedTrades === 0) return 'neutral';
    if (m.netPnL > 0 && m.profitFactor >= 1) return 'positive';
    if (m.netPnL < 0) return 'negative';
    return 'neutral';
  }, [m.closedTrades, m.netPnL, m.profitFactor]);

  const expectancy = useMemo(() => {
    if (m.closedTrades === 0) return 0;
    return m.netPnL / m.closedTrades;
  }, [m.netPnL, m.closedTrades]);

  if (tradesLoading || accountsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* A combined total across currencies is not a quantity. Say so rather
          than stamping one symbol on a sum of euros and dollars. */}
      {mixedCurrencies ? (
        <View style={styles.warnBanner}>
          <Info color={theme.colors.red} size={14} strokeWidth={2} />
          <Text style={styles.warnBannerText}>
            <Text style={styles.warnBannerStrong}>{t('mixedCurrencies')}</Text>
            {'  '}
            {t('mixedCurrenciesHint')}
          </Text>
        </View>
      ) : null}

      {/* ── 1. HERO — the one number that matters, and nothing next to it ── */}
      <Animated.View entering={FadeInDown.duration(duration.base)} style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>{t('netPnlTotal')}</Text>
          <PressableScale
            style={styles.shareBtn}
            onPress={() => setShareModalVisible(true)}
            accessibilityLabel={t('sharePnl')}
            hitSlop={8}
          >
            <Share2 size={13} color={theme.colors.textSecondary} strokeWidth={1.75} />
          </PressableScale>
        </View>

        {/* Counts up on mount and on every data change — the number arrives
            rather than appearing, which reads as live. */}
        <View style={styles.heroValueRow}>
          <AnimatedNumber
            value={m.netPnL}
            format={v => money(v, { thousandsSeparator: true })}
            style={[
              styles.heroValue,
              { color: m.netPnL >= 0 ? theme.colors.green : theme.colors.red },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          />
          {equitySeries.length > 1 ? (
            <Sparkline data={equitySeries} width={80} height={32} />
          ) : null}
        </View>

        {/* Inline secondary readout — today / open / trades */}
        <View style={styles.heroMeta}>
          <Text style={styles.heroMetaItem}>
            {t('todayLabel')}{' '}
            <Text
              style={{
                color:
                  todayPnL > 0
                    ? theme.colors.green
                    : todayPnL < 0
                    ? theme.colors.red
                    : theme.colors.textSecondary,
              }}
            >
              {money(todayPnL)}
            </Text>
          </Text>
          <Text style={styles.heroDot}>·</Text>
          <Text style={styles.heroMetaItem}>
            {m.totalTrades} {t('positions')}
          </Text>
          {m.openTrades > 0 ? (
            <>
              <Text style={styles.heroDot}>·</Text>
              <Text style={[styles.heroMetaItem, { color: theme.colors.primary }]}>
                {m.openTrades} {t('openPositionsShort')}
              </Text>
            </>
          ) : null}
        </View>
      </Animated.View>

      {/* ── 2. SESSIONS ──
          Which session is open decides whether to trade at all, so it belongs
          above the numbers, not buried under the charts at the bottom of the
          scroll where it was never seen before the decision was made. */}
      <MarketSessionsBar />

      {/* ── 3. LOCK GUARD — highest-priority interrupt ── */}
      {isLocked ? (
        <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.lockBanner}>
          <ShieldAlert color={theme.colors.red} size={18} strokeWidth={1.75} />
          <View style={styles.lockContent}>
            <Text style={styles.lockTitle}>{t('sessionLockedShort')}</Text>
            <Text style={styles.lockDesc} numberOfLines={2}>
              {lockReason || t('lockReasonFallback')}
            </Text>
          </View>
        </Animated.View>
      ) : null}

      {/* ── 3. METRIC GRID ──
          Four metrics on one row left each column ~80px wide, so "+$1253"
          and "100.0%" sat directly under their labels with no air and the
          row read as a wall of digits. A 2x2 grid gives each number a full
          half-width cell and restores the label/value/sub hierarchy. */}
      <LivePanel flush tone={kpiTone} live={m.openTrades > 0}>
        <View style={styles.metricGrid}>
          <View style={styles.metricRow}>
            <View style={styles.metricCell}>
              <Metric
                label={t('winRateGlobal')}
                value={`${m.winRate.toFixed(1)}%`}
                // Breakeven trades are shown only when they exist: padding
                // every account with "/ 0BE" costs width for no information.
                sub={
                  m.breakevenCount > 0
                    ? `${m.winCount}W / ${m.lossCount}L / ${m.breakevenCount}BE`
                    : `${m.winCount}W / ${m.lossCount}L`
                }
                size="small"
                align="center"
                trend={trends.winRate}
              />
            </View>
            <View style={styles.vRule} />
            <View style={styles.metricCell}>
              <Metric
                label={t('profitFactor')}
                // 0 means "no losses yet", so the ratio has no denominator.
                // An em dash says that; "0.00" would read as a total failure.
                value={m.profitFactor > 0 ? m.profitFactor.toFixed(2) : '—'}
                sub={`R ${m.avgRMultiple >= 0 ? '+' : ''}${m.avgRMultiple.toFixed(2)}`}
                size="small"
                align="center"
                tone="accent"
                trend={trends.profitFactor}
              />
            </View>
          </View>

          <View style={styles.hRule} />

          <View style={styles.metricRow}>
            <View style={styles.metricCell}>
              <Metric
                label={t('expectancyShort')}
                value={money(expectancy, { decimals: 0 })}
                sub={t('perTrade')}
                size="small"
                align="center"
                tone="pnl"
                pnlValue={expectancy}
                trend={trends.expectancy}
              />
            </View>
            <View style={styles.vRule} />
            <View style={styles.metricCell}>
              <Metric
                label={t('maxDrawdownLabel')}
                value={money(-m.maxDrawdown, { decimals: 0 })}
                sub={`${m.dayWinRate.toFixed(0)}% ${t('greenDaysShort')}`}
                size="small"
                align="center"
                tone="pnl"
                pnlValue={-m.maxDrawdown}
                trend={trends.drawdown}
                trendInverted
              />
            </View>
          </View>
        </View>
      </LivePanel>

      {/* ── 4. RISK TODAY ── */}
      <DailyRiskGauge trades={trades} account={activeAccount} />

      {/* ── 5. EMPTY STATE ── */}
      {m.totalTrades === 0 ? (
        <Panel>
          <EmptyState
            icon={<BookOpen size={22} color={theme.colors.primary} />}
            title={t('emptyDashTitle')}
            description={t('emptyDashDesc')}
            actionLabel={t('emptyDashCta')}
            onAction={() => navigation.navigate('Trades')}
          />
        </Panel>
      ) : null}

      {/* ── 6. EQUITY ── */}
      {m.equityCurve.length > 0 ? (
        <Panel title={t('equityLive')}>
          <GlowingEquityAreaChart
                symbol={sym}
            data={m.equityCurve.map(e => ({ date: e.date, value: e.pnl }))}
            height={180}
          />
        </Panel>
      ) : null}

      {m.dailyPnL.length > 0 ? (
        <Panel title={t('dailyPnl')}>
          <BicolorBarChart
                yAxisPrefix={sym}
            data={m.dailyPnL.map(d => ({ label: d.date, value: d.pnl }))}
            height={150}
          />
        </Panel>
      ) : null}

      {/* ── 7. DISCIPLINE (replaces the achievements wall) ── */}
      {m.totalTrades > 0 ? <DisciplineCard trades={scopedTrades} /> : null}

      {m.totalTrades > 0 ? <CostImpactCard trades={scopedTrades} /> : null}

      {m.totalTrades > 0 ? <ExcursionCard trades={scopedTrades} /> : null}

      {/* ── 10. RECENT TRADES — blotter preview ── */}
      <Panel
        title={t('lastTrades')}
        flush
        action={
          <PressableScale
            style={styles.viewAll}
            onPress={() => navigation.navigate('Trades')}
            accessibilityLabel={t('viewAll')}
            hitSlop={8}
          >
            <Text style={styles.viewAllText}>{t('viewAll')}</Text>
            <ChevronRight size={12} color={theme.colors.primary} strokeWidth={2} />
          </PressableScale>
        }
      >
        {m.recentTrades.length === 0 ? (
          <Text style={styles.emptyText}>{t('noRecentTrades')}</Text>
        ) : (
          m.recentTrades.map((tr: Trade, i: number) => (
            <Animated.View
              key={tr.id}
              entering={FadeIn.delay(stagger(i)).duration(duration.fast)}
            >
              <View style={styles.blotterRow}>
                <View
                  style={[
                    styles.dirRail,
                    { backgroundColor: tr.direction === 'BUY' ? theme.colors.green : theme.colors.red },
                  ]}
                />
                <View style={styles.blotterLeft}>
                  <Text style={styles.pair}>{tr.pair}</Text>
                  <Text style={styles.time}>
                    {new Date(tr.entry_time).toLocaleDateString(localeFor(lang), {
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    {new Date(tr.entry_time).toLocaleTimeString(localeFor(lang), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.blotterRight}>
                  <Text
                    style={[
                      styles.pnl,
                      {
                        color:
                          tr.pnl === null
                            ? theme.colors.textSecondary
                            : tr.pnl >= 0
                            ? theme.colors.green
                            : theme.colors.red,
                      },
                    ]}
                  >
                    {tr.pnl !== null ? money(tr.pnl) : '—'}
                  </Text>
                  <Badge
                    label={tr.result}
                    size="sm"
                    variant={outcomeVariant(tr)}
                  />
                </View>
              </View>
              {i < m.recentTrades.length - 1 ? <Hairline inset={16} /> : null}
            </Animated.View>
          ))
        )}
      </Panel>

      <ShareCardModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        trades={scopedTrades}
        accountName={activeAccount?.name || 'Compte Principal'}
      />
    </ScrollView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    center: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Hero
    warnBanner: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.red,
    },
    warnBannerText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
      lineHeight: 17,
    },
    warnBannerStrong: {
      color: theme.colors.red,
      fontFamily: theme.fonts.monoBold,
    },
    hero: {
      marginBottom: theme.spacing.lg,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    shareBtn: {
      padding: 4,
    },
    heroValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: theme.spacing.md,
    },
    heroValue: {
      flex: 1,
      fontSize: theme.type.hero,
      lineHeight: theme.type.hero * 1.08,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1.8,
      marginTop: 6,
    },
    heroMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      flexWrap: 'wrap',
    },
    heroMetaItem: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoMedium,
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.4,
    },
    heroDot: {
      color: theme.colors.textDark,
      fontSize: theme.type.label,
    },

    // Lock
    lockBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.redMuted,
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.red,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    lockContent: { flex: 1 },
    lockTitle: {
      color: theme.colors.red,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
    },
    lockDesc: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 3,
      lineHeight: 14,
    },

    // Metric strip
    metricGrid: {
      paddingVertical: theme.spacing.xs,
    },
    metricRow: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    metricCell: {
      flex: 1,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.sm,
      // Centred: left-aligned, each value sat hard against the divider while
      // its sparkline floated in the empty half of the cell, so the block read
      // as four ragged columns instead of one grid.
      alignItems: 'center',
    },
    vRule: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: theme.colors.hairline,
    },
    hRule: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.hairline,
      marginHorizontal: theme.spacing.md,
    },

    // View all
    viewAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      color: theme.colors.primary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },

    // Blotter
    blotterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    dirRail: {
      width: 2,
      height: 24,
      borderRadius: 1,
    },
    blotterLeft: { flex: 1 },
    pair: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    time: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    blotterRight: { alignItems: 'flex-end', gap: 4 },
    pnl: {
      fontSize: theme.type.metricSm,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sans,
      textAlign: 'center',
      paddingVertical: theme.spacing.lg,
    },
  });
