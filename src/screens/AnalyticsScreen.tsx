import { useState, useMemo, useEffect } from 'react';
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
import { useAccounts } from '../features/accounts/useAccounts';
import { usePlaybookSetups } from '../features/playbook/usePlaybook';
import { useAnalytics } from '../features/analytics/useAnalytics';
import { formatCurrency, currencySymbol } from '../utils/formatCurrency';
import type { FormatCurrencyOptions } from '../utils/formatCurrency';
import { useUIStore } from '../store/uiStore';
import type { Trade } from '../types/domain';
import { SkeletonCard } from '../components/ui/Skeleton';
import { CostImpactCard } from '../components/dashboard/CostImpactCard';
import { ExcursionCard } from '../components/dashboard/ExcursionCard';
import { TagPerformanceCard } from '../components/dashboard/TagPerformanceCard';
import { DisciplineCard } from '../components/dashboard/DisciplineCard';
import { scopeTrades } from '../features/accounts/accountScope';
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
import { RDistributionChart } from '../components/ui/RDistributionChart';
import { HourlyPerformanceChart } from '../components/ui/HourlyPerformanceChart';
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
import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;


/**
 * Analytics was split across 7 tabs, several of which held two cards each.
 * That is a lot of tapping to compare related numbers. They are now grouped
 * into 4 views that answer 4 distinct questions:
 *   PERF     — how am I doing?          (overview + equity)
 *   EDGE     — where does my edge come from? (distribution + breakdown)
 *   BEHAVIOR — when and in what state do I trade well? (timing + psychology)
 *   PROP     — am I passing?            (prop firm)
 */
type TabType = 'perf' | 'edge' | 'behavior' | 'propfirm';

const TABS: { id: TabType; labelKey: string; icon: React.FC<{ color?: string; size?: number }> }[] = [
  { id: 'perf', labelKey: 'tabPerf', icon: TrendingUp },
  { id: 'edge', labelKey: 'tabEdge', icon: Target },
  { id: 'behavior', labelKey: 'tabBehavior', icon: Brain },
  { id: 'propfirm', labelKey: 'tabPropFirm', icon: Award },
];

// ─── Animated Progress Ring (SVG) for Prop Firm ───
const ProgressRing: React.FC<{
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  value: string;
  theme: AppTheme;
  delay?: number;
}> = ({ progress, size = 80, strokeWidth = 8, color, label, value, theme: t, delay = 200 }) => {
  const animProgress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);

  useEffect(() => {
    animProgress.value = withDelay(delay, withSpring(clampedProgress, { damping: 18, stiffness: 60 }));
  }, [clampedProgress, delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    // We use the animated value in the SVG below
  }));

  const strokeDashoffset = circumference * (1 - animProgress.value);

  return (
    <View style={{ alignItems: 'center', width: 100 }}>
      <Animated.View entering={FadeIn.delay(delay).duration(400)}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={`ringGrad-${label}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="1" />
              <Stop offset="1" stopColor={color} stopOpacity="0.5" />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={t.colors.cardBorder}
            strokeWidth={strokeWidth}
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#ringGrad-${label})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <SvgText
            x={size / 2}
            y={size / 2 + 4}
            textAnchor="middle"
            fill={t.colors.textPrimary}
            fontSize={14}
            fontWeight="900"
          >
            {value}
          </SvgText>
        </Svg>
      </Animated.View>
      <Text style={{ color: t.colors.textMuted, fontSize: 9, fontFamily: t.fonts.monoBold, marginTop: 6, letterSpacing: 0.5, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
};

// ─── Animated Progress Bar for Prop Firm ───
const AnimatedProgressBar: React.FC<{
  label: string;
  current: number;
  limit: number;
  color: string;
  invert?: boolean;
  theme: AppTheme;
}> = ({ label, current, limit, color, invert = false, theme }) => {
  const { t } = useT();
  const lang = useI18nStore(s => s.lang);
  const pct = limit > 0 ? Math.min(Math.abs(current) / Math.abs(limit), 1) : 0;
  const isWarning = invert ? pct > 0.7 : pct > 0.85;
  const isDanger = invert ? pct > 0.9 : pct > 0.95;
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(pct, { duration: 800 });
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(barWidth.value, [0, 1], [0, 100])}%` as any,
  }));

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontFamily: theme.fonts.monoBold, letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Text style={{ color: isDanger ? theme.colors.redLight : isWarning ? theme.colors.goldLight : theme.colors.textPrimary, fontSize: 11, fontFamily: theme.fonts.monoBold, fontVariant: ['tabular-nums'] }}>
          ${Math.abs(current).toLocaleString()} / ${Math.abs(limit).toLocaleString()}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: theme.colors.surface, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.cardBorder }}>
        <Animated.View
          style={[
            {
              height: '100%',
              borderRadius: 4,
              backgroundColor: isDanger ? theme.colors.red : isWarning ? theme.colors.gold : color,
            },
            barStyle,
          ]}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontFamily: theme.fonts.mono }}>
          {invert ? (pct > 0.9 ? t('progressAlert') : pct > 0.7 ? t('progressWarning') : t('progressSafe')) : (pct > 0.95 ? t('progressAlmost') : pct > 0.85 ? t('progressOngoing') : t('progressAdvancing'))}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] }}>
          {(pct * 100).toFixed(1)}%
        </Text>
      </View>
    </View>
  );
};

// ─── Mini Status Chip ───
const StatusChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  theme: AppTheme;
  delay?: number;
}> = ({ icon, label, value, color, theme: t, delay = 0 }) => (
  <Animated.View
    entering={FadeIn.delay(delay).duration(350)}
    style={{
      backgroundColor: t.colors.surface,
      borderColor: t.colors.cardBorder,
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      flex: 1,
      alignItems: 'center',
      gap: 4,
    }}
  >
    {icon}
    <Text style={{ color: t.colors.textMuted, fontSize: 8, fontFamily: t.fonts.monoBold, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
    <Text style={{ color, fontSize: 14, fontFamily: t.fonts.monoBold, fontVariant: ['tabular-nums'] }}>{value}</Text>
  </Animated.View>
);

export const AnalyticsScreen: React.FC = () => {
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { t } = useT();
  const lang = useI18nStore(s => s.lang);
  const { trades, isLoading: tradesLoading } = useTrades();
  const { refreshing, onRefresh } = useRefresh();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { setups: playbookSetups, isLoading: setupsLoading } = usePlaybookSetups();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);

  const [activeTab, setActiveTab] = useState<TabType>('perf');
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
    breakeven,
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

  /** Chart palette lives in the view, not in the analytics hook. */
  const pieData = useMemo(
    () => [
      { label: t('gainsLabel'), value: wins.length, color: theme.colors.green },
      { label: t('lossesLabel'), value: losses.length, color: theme.colors.red },
      { label: 'BE', value: breakeven.length, color: theme.colors.primary },
    ],
    [wins, losses, breakeven, t, theme]
  );

  if (tradesLoading || accountsLoading || setupsLoading) {
    return (
      <View style={s.container} accessibilityLabel={t('loading')}>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
        <SkeletonCard lines={2} />
      </View>
    );
  }

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
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll}>
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
          {closed.length} {t('tradesInPeriod')}
        </Text>
      </View>

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
                    {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
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
                    {expectancy >= 0 ? '+' : ''}${expectancy.toFixed(2)}
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
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.redText]}>-${maxDrawdown.toFixed(2)}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('currentDrawdown')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, currentDrawdown > 0 ? s.redText : s.greenText]}>
                    -${currentDrawdown.toFixed(2)}
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
            <Card title={t('gainLossSplit')}>
              <DonutChart
                data={pieData}
                size={150}
                centerLabel={String(closed.length)}
                centerSub="TRADES"
              />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('rollingWinRate')}>
              {winRateTrend.length > 0 ? (
                <BicolorBarChart
                yAxisPrefix={sym}
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
                holdingTimeData.filter(h => h.count > 0).map((ht, i) => (
                  <Animated.View key={ht.label} entering={FadeIn.delay(i * 60).duration(300)}>
                    <View style={s.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={s.boldWhite}>{ht.label}</Text>
                        <Text numberOfLines={2} style={s.subMuted}>{ht.count} trades</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, ht.winRate >= 50 ? s.greenText : ht.count > 0 ? s.redText : { color: theme.colors.textMuted }]}>
                          {ht.count > 0 ? `${ht.winRate.toFixed(1)}% WR` : '—'}
                        </Text>
                        <Text style={[s.subMuted, ht.pnl >= 0 ? s.greenText : s.redText]}>
                          {ht.count > 0 ? `${ht.pnl >= 0 ? '+' : ''}$${ht.pnl.toFixed(2)}` : '$0.00'}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                ))
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 4 : PAR SETUP / PAIRE / TF ── */}
      {activeTab === 'edge' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* What the edge actually costs, and what it leaves on the table. */}
          <CostImpactCard trades={scopedTrades} />
          <ExcursionCard trades={scopedTrades} />
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('winRateBySetup')}>
              {setupBreakdown.map((st, i) => (
                <Animated.View key={st.name} entering={FadeIn.delay(i * 60).duration(300)}>
                  <View style={s.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text numberOfLines={1} style={s.boldWhite}>{st.name}</Text>
                      <Text numberOfLines={2} style={s.subMuted}>{st.count} trades</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, st.winRate >= 50 ? s.greenText : st.count > 0 ? s.redText : { color: theme.colors.textMuted }]}>
                        {st.count > 0 ? `${st.winRate.toFixed(1)}% WR` : '—'}
                      </Text>
                      <Text style={[s.subMuted, st.pnl >= 0 ? s.greenText : s.redText]}>
                        {st.count > 0 ? `${st.pnl >= 0 ? '+' : ''}$${st.pnl.toFixed(2)}` : '$0.00'}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('perfByInstrument')}>
              {pairBreakdown.map((p, i) => (
                <Animated.View key={p.name} entering={FadeIn.delay(i * 60).duration(300)}>
                  <View style={s.rowBetween}>
                    <View>
                      <Text numberOfLines={1} style={s.boldWhite}>{p.name}</Text>
                      <Text numberOfLines={2} style={s.subMuted}>{p.total} trades</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, p.winRate >= 50 ? s.greenText : s.redText]}>
                        {p.winRate.toFixed(1)}% WR
                      </Text>
                      <Text style={[s.subMuted, p.pnl >= 0 ? s.greenText : s.redText]}>
                        {p.pnl >= 0 ? '+' : ''}${p.pnl.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200).duration(350)}>
            <Card title={t('perfByTimeframe')}>
              {tfBreakdown.map((tf, i) => (
                <Animated.View key={tf.name} entering={FadeIn.delay(i * 60).duration(300)}>
                  <View style={s.rowBetween}>
                    <View>
                      <Text numberOfLines={1} style={s.boldWhite}>{tf.name}</Text>
                      <Text numberOfLines={2} style={s.subMuted}>{tf.total} trades</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, tf.winRate >= 50 ? s.greenText : s.redText]}>
                        {tf.winRate.toFixed(1)}% WR
                      </Text>
                      <Text style={[s.subMuted, tf.pnl >= 0 ? s.greenText : s.redText]}>
                        {tf.pnl >= 0 ? '+' : ''}${tf.pnl.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 5 : TIMING ── */}
      {activeTab === 'behavior' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* Statistical findings first: they say what to change, whereas the
              charts below only say what happened. */}
          <InsightsCard trades={closed} />

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
                sessionBreakdown.filter(s => s.count > 0).map((sb, i) => (
                  <Animated.View key={sb.name} entering={FadeIn.delay(i * 60).duration(300)}>
                    <View style={s.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={s.boldWhite}>{t(sb.labelKey as any)}</Text>
                        <Text numberOfLines={2} style={s.subMuted}>{sb.count} {t('tradesCount').toLowerCase()} · Avg R: {sb.avgR >= 0 ? '+' : ''}{sb.avgR.toFixed(2)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, sb.winRate >= 50 ? s.greenText : sb.count > 0 ? s.redText : { color: theme.colors.textMuted }]}>
                          {sb.count > 0 ? `${sb.winRate.toFixed(1)}% WR` : '—'}
                        </Text>
                        <Text style={[s.subMuted, sb.pnl >= 0 ? s.greenText : s.redText]}>
                          {sb.count > 0 ? `${sb.pnl >= 0 ? '+' : ''}$${sb.pnl.toFixed(2)}` : '$0.00'}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                ))
              )}
            </Card>
          </Animated.View>

          {/* Day of Week Analysis */}
          <Animated.View entering={FadeIn.delay(200).duration(350)}>
            <Card title={t('dayOfWeekAnalysis')}>
              {dayOfWeekAnalysis.filter(d => d.count > 0).length === 0 ? (
                <Text style={s.emptyText}>{t('noTradesYet')}</Text>
              ) : (
                dayOfWeekAnalysis.filter(d => d.count > 0).map((dw, i) => (
                  <Animated.View key={dw.name} entering={FadeIn.delay(i * 60).duration(300)}>
                    <View style={s.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={s.boldWhite}>{dw.name}</Text>
                        <Text numberOfLines={2} style={s.subMuted}>{dw.count} trades</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, dw.winRate >= 50 ? s.greenText : dw.count > 0 ? s.redText : { color: theme.colors.textMuted }]}>
                          {dw.count > 0 ? `${dw.winRate.toFixed(1)}% WR` : '—'}
                        </Text>
                        <Text style={[s.subMuted, dw.pnl >= 0 ? s.greenText : s.redText]}>
                          {dw.count > 0 ? `${dw.pnl >= 0 ? '+' : ''}$${dw.pnl.toFixed(2)}` : '$0.00'}
                        </Text>
                      </View>
                    </View>
                  </Animated.View>
                ))
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 6 : PSYCHOLOGIE ── */}
      {activeTab === 'behavior' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <DisciplineCard trades={scopedTrades} />
          <TagPerformanceCard trades={scopedTrades} />
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('mentalImpact')}>
              {mentalBreakdown.map((mb, i) => (
                <Animated.View key={mb.state} entering={FadeIn.delay(i * 60).duration(300)}>
                  <View style={s.rowBetween}>
                    <View>
                      <Text numberOfLines={1} style={s.boldWhite}>{mb.state}</Text>
                      <Text numberOfLines={2} style={s.subMuted}>{mb.count} sessions</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[s.boldVal, mb.winRate >= 50 ? s.greenText : s.redText]}>
                        {mb.winRate.toFixed(0)}% WR
                      </Text>
                      <Text style={[s.subMuted, mb.pnl >= 0 ? s.greenText : s.redText]}>
                        {mb.pnl >= 0 ? '+' : ''}${mb.pnl.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </Animated.View>
              ))}
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
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(43, 213, 118, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
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
                  value={`$${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(0)}`}
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
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.greenText]}>+${propFirmData.bestDay.toFixed(2)}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('worstDay')}</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.redText]}>${propFirmData.worstDay.toFixed(2)}</Text>
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
                    backgroundColor: challengeCountdown.isExpired ? 'rgba(255, 77, 77, 0.15)' : 'rgba(43, 213, 118, 0.1)',
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
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, { color: theme.colors.cyan }]}>-${ddProjection.avgDailyDd.toFixed(2)}</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxDrawdownLabel')} restant</Text>
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.kpiVal, s.redText]}>-${ddProjection.remainingDd.toFixed(2)}</Text>
                </View>
                <View style={[s.kpiBox, { backgroundColor: ddProjection.ddLevel === 'safe' ? 'rgba(43, 213, 118, 0.1)' : ddProjection.ddLevel === 'warning' ? 'rgba(212, 162, 76, 0.1)' : 'rgba(255, 77, 77, 0.1)' }]}>
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
                backgroundColor: consistencyData.isCompliant ? 'rgba(43, 213, 118, 0.12)' : 'rgba(255, 77, 77, 0.12)',
                borderWidth: 1, borderColor: consistencyData.isCompliant ? 'rgba(43, 213, 118, 0.3)' : 'rgba(255, 77, 77, 0.3)',
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
                yAxisPrefix={sym}
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
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
  },
  tabItemActive: {
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
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
    backgroundColor: 'rgba(255, 159, 28, 0.2)',
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
    fontStyle: 'italic',
  },
});
