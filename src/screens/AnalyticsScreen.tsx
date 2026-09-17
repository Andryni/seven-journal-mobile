import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import { useTrades } from '../features/trades/useTrades';
import { useRefresh } from '../features/data/useRefresh';
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigation, RouteProp, NavigationRouteContext } from '@react-navigation/native';
import type { RootTabParamList } from '../types/navigation';
import { TradesScreenProps } from '../types/navigation';
import type { TradesDrill } from '../store/uiStore';
import { hapticLight } from '../utils/haptics';
import { useAccounts } from '../features/accounts/useAccounts';
import { usePlaybookSetups, usePlaybook } from '../features/playbook/usePlaybook';
import { useAnalytics } from '../features/analytics/useAnalytics';
import { formatCurrency, currencySymbol } from '../utils/formatCurrency';
import type { FormatCurrencyOptions } from '../utils/formatCurrency';
import { useUIStore } from '../store/uiStore';
import type { Trade } from '../types/domain';
import { SkeletonCard, SkeletonPanels } from '../components/ui/Skeleton';
import { CostImpactCard } from '../components/dashboard/CostImpactCard';
import { ExcursionCard } from '../components/dashboard/ExcursionCard';
import { TagPerformanceCard } from '../components/dashboard/TagPerformanceCard';
import { DisciplineCard } from '../components/dashboard/DisciplineCard';
import { scopeTrades } from '../features/accounts/accountScope';
import { withAlpha } from '../theme';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT, useI18nStore } from '../i18n';
import { formatShortDate, localDayKey } from '../utils/formatDate';
import { Card } from '../components/ui/Card';
import { Panel } from '../components/ui/Panel';
import { DonutChart } from '../components/ui/DonutChart';
import { GlowingEquityAreaChart } from '../components/ui/GlowingEquityAreaChart';
import { BicolorBarChart } from '../components/ui/BicolorBarChart';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { SessionHeatmapCard } from '../components/analytics/SessionHeatmapCard';
import { WeeklyReviewCard } from '../components/analytics/WeeklyReviewCard';
import { InsightsCard } from '../components/analytics/InsightsCard';
import { ResultSplitCard } from '../components/analytics/ResultSplitCard';
import { HBarBreakdown } from '../components/ui/HBarBreakdown';
import type { HBreakdownItem } from '../components/ui/HBarBreakdown';
import { RDistributionChart } from '../components/ui/RDistributionChart';
import { HourlyPerformanceChart } from '../components/ui/HourlyPerformanceChart';
import {
  ProgressRing,
  AnimatedProgressBar,
  StatusChip,
} from '../components/analytics/PropFirmWidgets';
import {
  Activity,
  TrendingUp,
  BarChart3,
  Target,
  Clock,
  Brain,
  Award,
  Flame,
  Shield,
  Share2,
  Info,
} from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;


/**
 * Analytics was split across 7 tabs, several of which held two cards each.
 * That is a lot of tapping to compare related numbers. They are now grouped
 * into 4 views that answer 4 distinct questions:
 *   PERF      — how am I doing?               (overview + equity)
 *   EDGE      — where does my edge come from? (distribution + rolling)
 *   BREAKDOWN — which category pays?          (setup/pair/tf)
 *   TIMING    — when do I trade well?         (session/weekday/hour)
 *   MIND      — what does my head cost me?    (discipline/mental/tags)
 *   PROP      — am I passing?                 (prop firm)
 */
type TabType = 'perf' | 'edge' | 'breakdown' | 'timing' | 'mind' | 'propfirm';

const TABS: { id: TabType; labelKey: string; icon: React.FC<{ color?: string; size?: number }> }[] = [
  { id: 'perf', labelKey: 'tabPerf', icon: TrendingUp },
  { id: 'edge', labelKey: 'tabEdge', icon: Target },
  { id: 'breakdown', labelKey: 'tabBreakdown', icon: BarChart3 },
  { id: 'timing', labelKey: 'tabTiming', icon: Clock },
  { id: 'mind', labelKey: 'tabMind', icon: Brain },
  { id: 'propfirm', labelKey: 'tabPropFirm', icon: Award },
];


export const AnalyticsScreen: React.FC = () => {
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { t } = useT();
  const lang = useI18nStore(l => l.lang);
  const navigation = useNavigation<TradesScreenProps['navigation']>();
  const setTradesDrill = useUIStore(st => st.setTradesDrill);
  const { trades, isLoading: tradesLoading } = useTrades();
  const { refreshing, onRefresh } = useRefresh();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { setups: playbookSetups, isLoading: setupsLoading } = usePlaybookSetups();
  // Debriefs feed the coach's discipline aggregates (streak, mistake cost).
  const { debriefs } = usePlaybook();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);

  // Deep link: the dashboard's KPI grid navigates here with a tab preselected
  // (tap Win Rate -> Edge, tap Drawdown -> Prop firm). Params apply once on
  // mount; in-tab taps then drive the state as before. Read through the raw
  // route context: useRoute() throws when the screen is mounted bare (tests),
  // useContext simply yields null there.
  const routeContext = React.useContext(NavigationRouteContext) as
    | RouteProp<RootTabParamList, 'Analytics'>
    | null;
  const [activeTab, setActiveTab] = useState<TabType>(routeContext?.params?.initialTab ?? 'perf');
  const [dateRange, setDateRange] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const dateRangeOptions = [
    { key: '7d' as const, labelKey: 'dateRange7d' as const },
    { key: '30d' as const, labelKey: 'dateRange30d' as const },
    { key: '90d' as const, labelKey: 'dateRange90d' as const },
    { key: 'all' as const, labelKey: 'dateRangeAll' as const },
  ];

  // All derived analytics live in the hook; this screen is presentation only.
  const {
    closed,
    selectedAccount,
    initialBalance,
    profitTarget,
    maxDrawdownLimit,
    wins,
    losses,
    totalPnL,
    profitFactor,
    winRate,
    avgWin,
    avgLoss,
    avgR,
    expectancy,
    equityKitData,
    maxDrawdown,
    currentDrawdown,
    drawdownData,
    dailyPnL,
    winRateTrend,
    setupBreakdown,
    pairBreakdown,
    tfBreakdown,
    mentalBreakdown,
    sessionBreakdown,
    dayOfWeekAnalysis,
    holdingTimeData,
    expectancyR,
    propFirmData,
    ddProjection,
    consistencyData,
    challengeCountdown,
    isAggregate,
    hasMixedCurrencies,
  } = useAnalytics({
    trades,
    accounts,
    playbookSetups,
    activeAccountId,
    dateRange,
    lang,
    t,
  });

  /**
   * A bar answers "which category pays?"; pressing it opens the trade list
   * narrowed to exactly those trades. The drill payload carries the raw
   * filter value; the label is already localized here.
   */
  const drillToTrades = useCallback(
    (payload: string, item: { label: string }) => {
      const parts = payload.split(':');
      const kind = parts[0] as TradesDrill['kind'];
      setTradesDrill({ kind, value: parts.slice(1).join(':'), label: item.label });
      hapticLight();
      navigation.navigate('Trades');
    },
    [navigation, setTradesDrill]
  );

  /**
   * The analysis cards moved here from the dashboard, which had grown to
   * eleven stacked sections. They scope to the selected account the same way
   * every other figure on this screen does.
   */
  const scopedTrades = useMemo(
    () => scopeTrades(trades, activeAccountId),
    [trades, activeAccountId]
  );

  /**
   * Challenge / funded accounts answer "am I passing?". Demo and personal
   * accounts answer "am I growing?". Those are different questions and the
   * prop-firm panel -- profit target, drawdown cap, consistency rule -- only
   * answers the first. Anything not explicitly a prop account gets growth.
   */
  const isPropAccount =
    selectedAccount?.type === 'challenge' || selectedAccount?.type === 'funded';

  /** Capital-growth view, used where the prop tracker would be meaningless. */
  const growth = useMemo(() => {
    const balance = initialBalance + totalPnL;
    const returnPct = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;
    const days = new Set(closed.map(tr => tr.entry_time.slice(0, 10))).size;
    const avgDailyPct = days > 0 ? returnPct / days : 0;
    // Compounding at the observed daily rate; only meaningful while positive.
    const monthsToDouble =
      avgDailyPct > 0 ? Math.log(2) / Math.log(1 + avgDailyPct / 100) / 21 : null;
    const ddPct = initialBalance > 0 ? (maxDrawdown / initialBalance) * 100 : 0;
    return { balance, returnPct, days, avgDailyPct, monthsToDouble, ddPct };
  }, [initialBalance, totalPnL, closed, maxDrawdown]);

  // Analytics is scoped to one account, so all figures share its currency.
  const sym = currencySymbol(selectedAccount?.currency);
  const money = (v: number, o: FormatCurrencyOptions = {}) =>
    formatCurrency(v, { symbol: sym, ...o });

  const dataLoading = tradesLoading || accountsLoading || setupsLoading;
  const panelCount = activeTab === 'perf' ? 5 : activeTab === 'edge' ? 4 : activeTab === 'breakdown' ? 3 : activeTab === 'timing' ? 4 : activeTab === 'mind' ? 3 : 4;

  return (
    <ScrollView
      style={s.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.card}
        />
      }
    >
      {/* HEADER */}
      <Animated.View entering={FadeInDown.duration(350)} style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.screenTitle}>{t('tabAnalytics')}</Text>
          <Text style={s.screenSubtitle}>{t('screenSubtitleAnalytics')}</Text>
        </View>
        <TouchableOpacity
              style={s.shareBtn}
              onPress={() => setShareModalVisible(true)}
              activeOpacity={0.7}
            >
              <Share2 size={13} color={theme.colors.primaryLight} />
              <Text style={s.shareBtnText}>{t('sharePnl')}</Text>
            </TouchableOpacity>
      </Animated.View>

      {/* TABS SELECTOR */}
      {/* The strip is ~517px against a ~360dp screen, so it scrolls by design.
          What was missing is the CUE: with the indicator hidden and the last
          tab flush to the edge, nothing said more tabs existed. Trailing
          padding leaves the next tab half-visible, which is the cue. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabsScroll}
        contentContainerStyle={s.tabsContent}
      >
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[s.tabItem, isActive && s.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Icon color={isActive ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
              <Text style={[s.tabText, isActive && s.tabTextActive]}>
                {/* A demo or personal account has no challenge to pass, so
                    labelling the tab "PROP FIRM TRACKER" promises rules that
                    do not exist. Same slot, honest name. */}
                {tab.id === 'propfirm' && !isPropAccount ? t('tabGrowth') : t(tab.labelKey as any)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* DATE RANGE FILTER */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        {dateRangeOptions.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[s.dateRangeBtn, dateRange === opt.key && s.dateRangeBtnActive]}
            onPress={() => setDateRange(opt.key)}
          >
            <Text style={[s.dateRangeText, dateRange === opt.key && s.dateRangeTextActive]}>
              {t(opt.labelKey as any)}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 9, fontFamily: theme.fonts.monoBold, alignSelf: 'center' }}>
          {dataLoading ? '…' : `${closed.length} ${t('tradesInPeriod')}`}
        </Text>
      </View>

      {/* Panel placeholders while the queries settle: tabs, header and the
          date filter above are real chrome, so the skeletons slot into the
          same frame the content will occupy — no full-screen swap. */}
      {dataLoading ? (
        <SkeletonPanels count={panelCount} rowsPerPanel={4} />
      ) : (
      <>

      {/* ── TAB 1 : VUE D'ENSEMBLE ── */}
      {hasMixedCurrencies && (
        <View style={s.warnBanner}>
          <Info color={theme.colors.red} size={14} />
          <Text style={s.warnBannerText}>
            <Text style={s.warnBannerStrong}>{t('mixedCurrencies')}</Text>
            {'  '}
            {t('mixedCurrenciesHint')}
          </Text>
        </View>
      )}

      {activeTab === 'perf' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* Weekly feedback loop sits above the raw KPIs: deltas first,
              absolutes second. */}
          <WeeklyReviewCard trades={trades} />

          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('kpiGlobal')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('netPnlTotal')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, totalPnL >= 0 ? s.greenText : s.redText]}>
                    {/* formatCurrency, not a hand-rolled prefix: the manual
                        version put the sign AFTER the symbol ("$-2000")
                        while the dashboard showed "-$2000". */}
                    {money(totalPnL, { decimals: 2 })}
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('winRate')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.cyan }]}>{winRate.toFixed(1)}%</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('profitFactor')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.primaryLight }]}>
                    {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('profitLossRatio')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.goldLight }]}>
                    {avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '1.0'}x
                  </Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('avgRMultiple')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, avgR >= 0 ? s.greenText : s.redText]}>
                    {avgR >= 0 ? '+' : ''}{avgR.toFixed(2)}R
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('expectancy')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, expectancy >= 0 ? s.greenText : s.redText]}>
                    {money(expectancy, { decimals: 2 })}
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(60).duration(350)}>
            <Card title={t('expectancyR')} subtitle={t('expectancyDesc')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.kpiBox, { flex: 0, minWidth: 80, alignItems: 'center' }]}>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, expectancyR.value >= 0 ? s.greenText : s.redText, { fontSize: 22 }]}>
                    {expectancyR.value >= 0 ? '+' : ''}{expectancyR.value.toFixed(2)}R
                  </Text>
                  <Text style={[s.kpiLabel, { marginTop: 4 }]}>{t('expectancyR')}</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={s.rowBetween}>
                    <Text numberOfLines={2} style={s.subMuted}>{t('winRate')} ({t('holdingTimeWins')})</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, s.greenText]}>{expectancyR.winPct > 0 ? `${(expectancyR.winPct * 100).toFixed(0)}%` : '—'}</Text>
                  </View>
                  <View style={s.rowBetween}>
                    <Text numberOfLines={2} style={s.subMuted}>Avg Win R</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, s.greenText]}>+{expectancyR.avgWinR.toFixed(2)}R</Text>
                  </View>
                  <View style={s.rowBetween}>
                    <Text numberOfLines={2} style={s.subMuted}>Avg Loss R</Text>
                    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, s.redText]}>{expectancyR.avgLossR.toFixed(2)}R</Text>
                  </View>
                </View>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('equityGlowing')}>
              <GlowingEquityAreaChart
                symbol={sym}
                data={equityKitData.labels.map((l, i) => ({
                  date: l || `#${i + 1}`,
                  value: equityKitData.datasets[0].data[i] || 0,
                }))}
                height={190}
              />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200).duration(350)}>
            <Card title={t('dailyPnl')}>
              {dailyPnL.length > 0 ? (
                <BicolorBarChart data={dailyPnL} height={170} yAxisPrefix={sym} />
              ) : (
                <Text style={s.emptyText}>{t('noTradesYet')}</Text>
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 2 : EQUITY & DRAWDOWN ── */}
      {activeTab === 'perf' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('equityDrawdown')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxDrawdown')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.redText]}>{money(-maxDrawdown, { decimals: 2 })}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('currentDrawdown')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, currentDrawdown > 0 ? s.redText : s.greenText]}>
                    {money(-currentDrawdown, { decimals: 2 })}
                  </Text>
                </View>
              </View>
              <GlowingEquityAreaChart
                symbol={sym}
                data={equityKitData.labels.map((l, i) => ({
                  date: l || `#${i + 1}`,
                  value: equityKitData.datasets[0].data[i] || 0,
                }))}
                height={190}
              />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('drawdownCurve')}>
              {drawdownData.length > 0 ? (
                <GlowingEquityAreaChart
                  symbol={sym}
                  data={drawdownData.map(d => ({ date: d.label, value: d.value }))}
                  height={160}
                  tone="negative"
                />
              ) : (
                <Text style={s.emptyText}>{t('noDrawdownData')}</Text>
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 3 : DISTRIBUTION ── */}
      {activeTab === 'edge' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.duration(350)}>
            <Card title={t('rDistribution')}>
              <RDistributionChart
                values={closed
                  .filter(tr => tr.r_multiple !== null)
                  .map(tr => tr.r_multiple as number)}
              />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            {/* Classified by the DECLARED result (TP/SL/BE), not the sign of
                net PnL — a BE exit minus commissions used to be counted as a
                loss, hiding the BE bucket entirely. */}
            <ResultSplitCard trades={closed} symbol={sym} />
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('rollingWinRate')}>
              {winRateTrend.length > 0 ? (
                <BicolorBarChart
                  /* Percentage points away from break-even, not an amount. */
                  yAxisSuffix="%"
                  data={winRateTrend.map(wr => ({ label: wr.label, value: wr.value - 50 }))}
                  height={170}
                />
              ) : (
                <Text style={s.emptyText}>{t('notEnoughTrades')}</Text>
              )}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200).duration(350)}>
            <Card title={t('lastPositionsPnl')}>
              <BicolorBarChart
                yAxisPrefix={sym}
                data={closed.slice(-7).map((t, idx) => ({
                  label: `${t.pair.slice(0, 3)}#${idx + 1}`,
                  value: t.pnl || 0,
                }))}
                height={170}
              />
            </Card>
          </Animated.View>

          {/* Holding Time Analysis */}
          <Animated.View entering={FadeIn.delay(300).duration(350)}>
            <Card title={t('holdingTimeAnalysis')}>
              {holdingTimeData.filter(h => h.count > 0).length === 0 ? (
                <Text style={s.emptyText}>{t('noTradesYet')}</Text>
              ) : (
                <HBarBreakdown
                  symbol={sym}
                  onRowPress={drillToTrades}
                  items={holdingTimeData
                    .filter(h => h.count > 0)
                    .map(ht => ({
                      label: ht.label,
                      value: ht.pnl,
                      count: ht.count,
                      winRate: ht.winRate,
                      sub: ht.avgR !== null && ht.avgR !== undefined
                        ? `${ht.avgR >= 0 ? '+' : ''}${ht.avgR.toFixed(2)}R`
                        : undefined,
                      payload: `holding:${ht.range}`,
                    }))}
                />
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 4 : BREAKDOWN (qui paie ?) ── */}
      {activeTab === 'breakdown' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* What the edge actually costs, and what it leaves on the table. */}
          <CostImpactCard trades={scopedTrades} />
          <ExcursionCard trades={scopedTrades} />
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('winRateBySetup')}>
              <HBarBreakdown
                symbol={sym}
                onRowPress={drillToTrades}
                items={setupBreakdown.map(st => ({
                  label: st.name,
                  value: st.pnl,
                  count: st.count,
                  winRate: st.winRate,
                  payload: `setup:${st.name}`,
                }))}
              />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('perfByInstrument')}>
              <HBarBreakdown
                symbol={sym}
                onRowPress={drillToTrades}
                items={pairBreakdown.map(p => ({
                  label: p.name,
                  value: p.pnl,
                  count: p.total,
                  winRate: p.winRate,
                  payload: `pair:${p.name}`,
                }))}
              />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200).duration(350)}>
            <Card title={t('perfByTimeframe')}>
              <HBarBreakdown
                symbol={sym}
                onRowPress={drillToTrades}
                items={tfBreakdown.map(tf => ({
                  label: tf.name,
                  value: tf.pnl,
                  count: tf.total,
                  winRate: tf.winRate,
                  payload: `timeframe:${tf.name}`,
                }))}
              />
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 5 : TIMING ── */}
      {activeTab === 'timing' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* Statistical findings first: they say what to change, whereas the
              charts below only say what happened. Debriefs feed the AI
              summary's discipline aggregates. */}
          <InsightsCard
            trades={closed}
            playbookSetups={playbookSetups}
            debriefs={debriefs}
          />

          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            {/* 24h diverging columns replace the aggregated bar chart:
                bleed usually concentrates in one or two specific hours. */}
            <Card title={t('hourlyPerformance')}>
              <HourlyPerformanceChart trades={closed} symbol={sym} />
            </Card>
          </Animated.View>
            {/* Session Heatmap */}
            <SessionHeatmapCard trades={closed} />

          {/* Session Performance Breakdown */}
          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('sessionBreakdown')}>
              {sessionBreakdown.filter(s => s.count > 0).length === 0 ? (
                <Text style={s.emptyText}>{t('noTradesYet')}</Text>
              ) : (
                <HBarBreakdown
                  symbol={sym}
                  onRowPress={drillToTrades}
                  items={sessionBreakdown
                    .filter(s => s.count > 0)
                    .map(sb => ({
                      label: t(sb.labelKey as any),
                      value: sb.pnl,
                      count: sb.count,
                      winRate: sb.winRate,
                      sub: `${sb.avgR >= 0 ? '+' : ''}${sb.avgR.toFixed(2)}R`,
                      payload: `session:${sb.name}`,
                    }))}
                />
              )}
            </Card>
          </Animated.View>

          {/* Day of Week Analysis */}
          <Animated.View entering={FadeIn.delay(200).duration(350)}>
            <Card title={t('dayOfWeekAnalysis')}>
              {dayOfWeekAnalysis.filter(d => d.count > 0).length === 0 ? (
                <Text style={s.emptyText}>{t('noTradesYet')}</Text>
              ) : (
                <HBarBreakdown
                  symbol={sym}
                  onRowPress={drillToTrades}
                  items={dayOfWeekAnalysis
                    .filter(d => d.count > 0)
                    .map(dw => ({
                      label: dw.name,
                      value: dw.pnl,
                      count: dw.count,
                      winRate: dw.winRate,
                      payload: `weekday:${dw.nameEn ?? dw.name}`,
                    }))}
                />
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 6 : MENTAL ── */}
      {activeTab === 'mind' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <DisciplineCard trades={scopedTrades} />
          <TagPerformanceCard trades={scopedTrades} />
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('mentalImpact')}>
              {mentalBreakdown.filter(m => m.count > 0).length === 0 ? (
                <Text style={s.emptyText}>{t('noTradesYet')}</Text>
              ) : (
                <HBarBreakdown
                  symbol={sym}
                  onRowPress={drillToTrades}
                  items={mentalBreakdown
                    .filter(m => m.count > 0)
                    .map(mb => ({
                      label: mb.state,
                      value: mb.pnl,
                      count: mb.count,
                      winRate: mb.winRate,
                      payload: `mental:${mb.state.toLowerCase()}`,
                    }))}
                />
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 7bis : ACCOUNT GROWTH (demo / personal) ── */}
      {activeTab === 'propfirm' && !isAggregate && !isPropAccount && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Panel>
            <View style={s.scopeNotice}>
              <Info color={theme.colors.primaryLight} size={16} />
              <View style={{ flex: 1 }}>
                <Text style={s.scopeTitle}>
                  {selectedAccount?.type === 'demo'
                    ? t('growthNoticeDemo')
                    : t('growthNoticePersonal')}
                </Text>
                <Text style={s.scopeText}>{t('growthNoticeHint')}</Text>
              </View>
            </View>
          </Panel>

          <Animated.View entering={FadeIn.delay(80).duration(350)}>
            <Card title={t('accountGrowth')}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 }}>
                <ProgressRing
                  progress={Math.min(Math.abs(growth.returnPct) / 100, 1)}
                  color={growth.returnPct >= 0 ? theme.colors.green : theme.colors.red}
                  label={t('returnOnCapital')}
                  value={`${growth.returnPct >= 0 ? '+' : ''}${growth.returnPct.toFixed(1)}%`}
                  theme={theme}
                  delay={200}
                />
                <ProgressRing
                  progress={Math.min(growth.ddPct / 100, 1)}
                  color={growth.ddPct > 20 ? theme.colors.red : theme.colors.cyan}
                  label={t('maxDrawdownLabel')}
                  value={`${growth.ddPct.toFixed(0)}%`}
                  theme={theme}
                  delay={300}
                />
                <ProgressRing
                  progress={winRate / 100}
                  color={theme.colors.primaryLight}
                  label={t('winRate')}
                  value={`${winRate.toFixed(0)}%`}
                  theme={theme}
                  delay={400}
                />
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(160).duration(350)}>
            <Card title={t('growthStats')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('currentBalance')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={s.kpiVal}>
                    {money(growth.balance, { showPlus: false, decimals: 0, thousandsSeparator: true })}
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('netPnlTotal')}</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[s.kpiVal, totalPnL >= 0 ? s.greenText : s.redText]}
                  >
                    {money(totalPnL, { decimals: 0, thousandsSeparator: true })}
                  </Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('avgDailyReturn')}</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                    style={[s.kpiVal, growth.avgDailyPct >= 0 ? s.greenText : s.redText]}
                  >
                    {growth.avgDailyPct >= 0 ? '+' : ''}
                    {growth.avgDailyPct.toFixed(2)}%
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('monthsToDouble')}</Text>
                  {/* A negative or flat edge never doubles. Printing a huge
                      number there would read as a forecast; say so instead. */}
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={[s.kpiVal, { color: theme.colors.goldLight }]}>
                    {growth.monthsToDouble !== null && growth.monthsToDouble < 600
                      ? growth.monthsToDouble.toFixed(1)
                      : t('neverAtThisRate')}
                  </Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('tradingDays')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.cyan }]}>
                    {growth.days}
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('profitFactor')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={s.kpiVal}>
                    {profitFactor === Infinity ? '\u221e' : profitFactor.toFixed(2)}
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 7 : PROP FIRM TRACKER ── */}
      {/* Prop-firm rules are per-account: a profit target or a drawdown limit
          summed across accounts is not a number that means anything. Rather
          than render a confident-looking wrong figure, ask for a scope. */}
      {activeTab === 'propfirm' && isAggregate && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Panel>
            <View style={s.scopeNotice}>
              <Info color={theme.colors.gold} size={16} />
              <View style={{ flex: 1 }}>
                <Text style={s.scopeTitle}>{t('aggregateNotice')}</Text>
                <Text style={s.scopeText}>{t('aggregateHint')}</Text>
              </View>
            </View>
          </Panel>
        </Animated.View>
      )}

      {activeTab === 'propfirm' && !isAggregate && isPropAccount && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* Status Chips */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: 12 }}>
            <StatusChip
              icon={propFirmData.profitPct >= 1 ?
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: withAlpha(theme.colors.green, 0.2), alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: theme.colors.greenLight, fontSize: 10 }}>✓</Text>
                </View> :
                <Flame color={theme.colors.gold} size={18} />
              }
              label={t('propFirmStatus')}
              value={propFirmData.profitPct >= 1 ? t('propFirmPassed') : t('propFirmInProgress')}
              color={propFirmData.profitPct >= 1 ? theme.colors.greenLight : theme.colors.goldLight}
              theme={theme}
              delay={0}
            />
            <StatusChip
              icon={<Target color={theme.colors.primaryLight} size={18} />}
              label={t('totalTrades')}
              value={`${closed.length}`}
              color={theme.colors.primaryLight}
              theme={theme}
              delay={80}
            />
            <StatusChip
              icon={<Shield color={propFirmData.drawdownPct > 0.9 ? theme.colors.red : theme.colors.cyan} size={18} />}
              label={t('maxDrawdownKpi')}
              value={`${(propFirmData.drawdownPct * 100).toFixed(0)}%`}
              color={propFirmData.drawdownPct > 0.9 ? theme.colors.redLight : theme.colors.cyanLight}
              theme={theme}
              delay={160}
            />
          </View>

          {/* Progress Rings */}
          <Animated.View entering={FadeIn.delay(80).duration(350)}>
            <Card title={t('challengeProgress')}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 }}>
                <ProgressRing
                  progress={propFirmData.profitPct}
                  color={theme.colors.green}
                  label={t('target')}
                  value={money(totalPnL, { decimals: 0 })}
                  theme={theme}
                  delay={200}
                />
                <ProgressRing
                  progress={1 - propFirmData.drawdownPct}
                  color={propFirmData.drawdownPct > 0.9 ? theme.colors.red : theme.colors.cyan}
                  label={t('cap')}
                  value={`${(propFirmData.drawdownPct * 100).toFixed(0)}%`}
                  theme={theme}
                  delay={300}
                />
                <ProgressRing
                  progress={propFirmData.wrPct}
                  color={theme.colors.primaryLight}
                  label={t('winRate')}
                  value={`${winRate.toFixed(0)}%`}
                  theme={theme}
                  delay={400}
                />
              </View>
            </Card>
          </Animated.View>

          {/* Progress Bars */}
          <Animated.View entering={FadeIn.delay(160).duration(350)}>
            <Card title={t('meters')}>
              <AnimatedProgressBar label={t('target')} current={totalPnL} limit={profitTarget} color={theme.colors.green} theme={theme} />
              <AnimatedProgressBar label={t('maxDrawdownLabel')} current={maxDrawdown} limit={maxDrawdownLimit} color={theme.colors.red} invert theme={theme} />
              {propFirmData.dailyLossLimit > 0 && (
                <AnimatedProgressBar label={t('maxLossPerDay')} current={propFirmData.worstDay < 0 ? Math.abs(propFirmData.worstDay) : 0} limit={propFirmData.dailyLossLimit} color={theme.colors.gold} invert theme={theme} />
              )}
            </Card>
          </Animated.View>

          {/* Stats Grid */}
          <Animated.View entering={FadeIn.delay(240).duration(350)}>
            <Card title={t('challengeStats')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('bestDay')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.greenText]}>{money(propFirmData.bestDay, { decimals: 2 })}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('worstDay')}</Text>
                  {/* worstDay est déjà signé (min des P&L journaliers) : le
                      "${...}" précédent rendait "$-500" au lieu de "-$500". */}
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.redText]}>{money(propFirmData.worstDay, { decimals: 2 })}</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxWinStreak')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.greenText]}>{propFirmData.maxConsecWins}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxLossStreak')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.redText]}>{propFirmData.maxConsecLosses}</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('tradingDays')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.cyan }]}>{propFirmData.uniqueDays}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('consistencyScore')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.goldLight }]}>{propFirmData.consistencyPct.toFixed(0)}%</Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* Challenge Parameters */}
          <Animated.View entering={FadeIn.delay(320).duration(350)}>
            <Card title={t('challengeParams')}>
              <View style={s.rowBetween}>
                <Text numberOfLines={2} style={s.subMuted}>{t('profitTargetLabelStat')}</Text>
                <Text numberOfLines={1} style={s.boldWhite}>${profitTarget.toLocaleString()}</Text>
              </View>
              <View style={s.rowBetween}>
                <Text numberOfLines={2} style={s.subMuted}>{t('maxDrawdownLimitStat')}</Text>
                <Text numberOfLines={1} style={s.boldWhite}>${maxDrawdownLimit.toLocaleString()}</Text>
              </View>
              <View style={s.rowBetween}>
                <Text numberOfLines={2} style={s.subMuted}>{t('initialBalanceLabel2')}</Text>
                <Text numberOfLines={1} style={s.boldWhite}>${initialBalance.toLocaleString()}</Text>
              </View>
              {selectedAccount?.max_daily_loss_limit && (
                <View style={s.rowBetween}>
                  <Text numberOfLines={2} style={s.subMuted}>{t('maxDailyLossLabel2')}</Text>
                  <Text numberOfLines={1} style={s.boldWhite}>{money(selectedAccount.max_daily_loss_limit, { showPlus: false, decimals: 0, thousandsSeparator: true })}</Text>
                </View>
              )}
              <View style={s.rowBetween}>
                <Text numberOfLines={2} style={s.subMuted}>{t('accountTypeLabel2')}</Text>
                <Text style={[s.boldWhite, { color: theme.colors.primaryLight }]}>
                  {selectedAccount?.type?.toUpperCase() || 'CHALLENGE'}
                  {/* @ts-ignore - type is a valid account type */}
                </Text>
              </View>
            </Card>
          </Animated.View>

          {/* Challenge Countdown */}
          {challengeCountdown && (
            <Animated.View entering={FadeIn.delay(400).duration(350)}>
              <Card title={t('challengeCountdown')}>
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <View style={{
                    width: 90, height: 90, borderRadius: 45,
                    borderWidth: 3,
                    borderColor: challengeCountdown.isExpired ? theme.colors.red : challengeCountdown.daysLeft <= 7 ? theme.colors.goldLight : theme.colors.green,
                    alignItems: 'center', justifyContent: 'center',
                    backgroundColor: challengeCountdown.isExpired ? withAlpha(theme.colors.red, 0.15) : withAlpha(theme.colors.green, 0.1),
                  }}>
                    <Text style={{
                      fontSize: 28, fontFamily: theme.fonts.monoBold,
                      color: challengeCountdown.isExpired ? theme.colors.red : challengeCountdown.daysLeft <= 7 ? theme.colors.goldLight : theme.colors.green,
                      fontVariant: ['tabular-nums'],
                    }}>
                      {challengeCountdown.isExpired ? '0' : challengeCountdown.daysLeft}
                    </Text>
                  </View>
                  <Text style={{
                    marginTop: 8, fontFamily: theme.fonts.monoBold, fontSize: 12,
                    color: challengeCountdown.isExpired ? theme.colors.redLight : theme.colors.textPrimary,
                    letterSpacing: 0.8,
                  }}>
                    {challengeCountdown.isExpired ? t('challengeExpired') : t('daysRemaining')}
                  </Text>
                  <Text style={{ marginTop: 4, fontSize: 10, color: theme.colors.textMuted, fontFamily: theme.fonts.monoBold }}>
                    {challengeCountdown.endDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </View>
              </Card>
            </Animated.View>
          )}

          {/* Drawdown Projection */}
          <Animated.View entering={FadeIn.delay(450).duration(350)}>
            <Card title={t('drawdownProjection')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('projectionDaysLeft')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, ddProjection.ddLevel === 'safe' ? s.greenText : ddProjection.ddLevel === 'warning' ? { color: theme.colors.goldLight } : s.redText]}>
                    {ddProjection.daysUntilMaxDd >= 999 ? '∞' : `${ddProjection.daysUntilMaxDd}J`}
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('projectionAvgDailyDD')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.cyan }]}>{money(-ddProjection.avgDailyDd, { decimals: 2 })}</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxDrawdownLabel')} restant</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.redText]}>{money(-ddProjection.remainingDd, { decimals: 2 })}</Text>
                </View>
                <View style={[s.kpiBox, { backgroundColor: ddProjection.ddLevel === 'safe' ? withAlpha(theme.colors.green, 0.1) : ddProjection.ddLevel === 'warning' ? withAlpha(theme.colors.gold, 0.1) : withAlpha(theme.colors.red, 0.1) }]}>
                  <Text style={s.kpiLabel}>STATUS</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, ddProjection.ddLevel === 'safe' ? s.greenText : ddProjection.ddLevel === 'warning' ? { color: theme.colors.goldLight } : s.redText, { fontSize: 11 }]}>
                    {ddProjection.ddLevel === 'safe' ? t('projectionSafe') : ddProjection.ddLevel === 'warning' ? t('projectionWarning') : t('projectionDanger')}
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* Consistency Tracker */}
          <Animated.View entering={FadeIn.delay(500).duration(350)}>
            <Card title={t('consistencyTracker')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('consistencyRule')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.goldLight }]}>{consistencyData.consistencyRule}%</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('consistencyMaxDay')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, consistencyData.isCompliant ? s.greenText : s.redText]}>{consistencyData.maxDayContrib.toFixed(1)}%</Text>
                </View>
              </View>
              <View style={{
                marginTop: 8, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8,
                backgroundColor: consistencyData.isCompliant ? withAlpha(theme.colors.green, 0.12) : withAlpha(theme.colors.red, 0.12),
                borderWidth: 1, borderColor: consistencyData.isCompliant ? withAlpha(theme.colors.green, 0.3) : withAlpha(theme.colors.red, 0.3),
                alignItems: 'center',
              }}>
                <Text style={{ color: consistencyData.isCompliant ? theme.colors.greenLight : theme.colors.redLight, fontSize: 12, fontFamily: theme.fonts.monoBold }}>
                  {consistencyData.isCompliant ? t('consistencyCompliant') : t('consistencyViolation')}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 9, marginTop: 2 }}>
                  {t('dailyPnlContrib')}: {consistencyData.maxDayContrib.toFixed(1)}% / {consistencyData.consistencyRule}%
                </Text>
              </View>
              {/* Mini bar chart of daily contributions */}
              {consistencyData.dailyContributions.length > 0 && (
                <BicolorBarChart
                  /* Each bar is a share of total P&L, not an amount. */
                  yAxisSuffix="%"
                  data={consistencyData.dailyContributions.map(d => ({ label: d.date, value: d.pct }))}
                  height={140}
                />
              )}
            </Card>
          </Animated.View>

          {/* Drawdown Chart */}
          <Animated.View entering={FadeIn.delay(550).duration(350)}>
            <Card title={t('drawdownCurve')}>
              {drawdownData.length > 0 ? (
                <GlowingEquityAreaChart
                  symbol={sym}
                  data={drawdownData.map(d => ({ date: d.label, value: d.value }))}
                  height={160}
                  tone="negative"
                />
              ) : (
                <Text style={s.emptyText}>{t('noDrawdownData')}</Text>
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      <View style={{ height: 40 }} />
      </>
      )}

      {/* Share P&L Card Modal */}
      <ShareCardModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        trades={trades}
        accountName={selectedAccount?.name || 'Tous les comptes'}
      />
    </ScrollView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  screenTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontFamily: theme.fonts.sansSemiBold,
    marginTop: 2,
  },
  tabsScroll: {
    marginBottom: theme.spacing.md,
  },
  tabsContent: {
    // Room past the last tab so it never sits flush with the screen edge,
    // which reads as "the list ends here".
    paddingRight: theme.spacing.lg,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    /**
     * Tightened from spacing.md/6 to fit six tabs.
     *
     * At the old widths the row measured ~656px against a ~360dp screen, so
     * the last two tabs -- MIND and PROP FIRM -- sat entirely off-screen with
     * nothing on the strip to suggest they existed. Splitting the overloaded
     * behaviour tab into six was the right call; paying for it by hiding two
     * of them was not.
     */
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    marginRight: 5,
  },
  tabItemActive: {
    backgroundColor: withAlpha(theme.colors.primary, 0.2),
    borderColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: theme.colors.textPrimary,
  },
  tabContent: {
    paddingBottom: theme.spacing.xxl,
  },
  scopeNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  scopeTitle: {
    color: theme.colors.gold,
    fontSize: theme.type.label,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  scopeText: {
    color: theme.colors.textSecondary,
    fontSize: theme.type.label,
    fontFamily: theme.fonts.sans,
    lineHeight: 18,
  },
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
  grid2: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  kpiLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kpiVal: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  greenText: {
    color: theme.colors.greenLight,
  },
  redText: {
    color: theme.colors.redLight,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  boldWhite: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.sansBold,
  },
  boldVal: {
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  subMuted: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.mono,
    marginTop: 2,
  },
  dateRangeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
  },
  dateRangeBtnActive: {
    backgroundColor: withAlpha(theme.colors.primary, 0.2),
    borderColor: theme.colors.primary,
  },
  dateRangeText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  shareBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },

  dateRangeTextActive: {
    color: theme.colors.primaryLight,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
    fontFamily: theme.fonts.mono,
  },
});
