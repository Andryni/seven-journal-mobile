import { useState, useMemo, useEffect, useCallback } from 'react';
import { useHaptic } from '../hooks/useHaptic';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInLeft,
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withSpring,
  withDelay,
  interpolate,
} from 'react-native-reanimated';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT, type TFunction, mistakeLabel } from '../i18n';
import { formatCurrency } from '../utils/formatCurrency';
import { Card } from '../components/ui/Card';
import { DonutChart } from '../components/charts/DonutChart';
import { GlowingEquityAreaChart } from '../components/ui/GlowingEquityAreaChart';
import { BicolorBarChart } from '../components/ui/BicolorBarChart';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { ExportPdfModal } from '../components/export/ExportPdfModal';
import { SessionHeatmapCard } from '../components/analytics/SessionHeatmapCard';
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
  FileText,
  CheckCircle2,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { useAnalyticsComputations, type DateRange } from '../features/analytics/useAnalyticsComputations';
import { useStreakData } from '../features/analytics/useStreakData';
import { useRRDistribution } from '../features/analytics/useRRDistribution';
import { useTradingGoals } from '../features/analytics/useTradingGoals';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../store/uiStore';
import { createAnalyticsStyles } from './AnalyticsStyles';

type TabType = 'overview' | 'equity' | 'distribution' | 'breakdown' | 'timing' | 'psychology' | 'propfirm' | 'goals';

const TABS: { id: TabType; labelKey: string; icon: React.FC<{ color?: string; size?: number }> }[] = [
  { id: 'overview', labelKey: 'tabOverview', icon: Activity },
  { id: 'equity', labelKey: 'tabEquity', icon: TrendingUp },
  { id: 'distribution', labelKey: 'tabDistribution', icon: BarChart3 },
  { id: 'breakdown', labelKey: 'tabBreakdown', icon: Target },
  { id: 'timing', labelKey: 'tabTiming', icon: Clock },
  { id: 'psychology', labelKey: 'tabPsychology', icon: Brain },
  { id: 'propfirm', labelKey: 'tabPropFirm', icon: Award },
];

// ─── Animated Progress Ring (SVG) ───
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const ProgressRing: React.FC<{
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
    animProgress.value = withDelay(delay, withTiming(clampedProgress, { duration: 900 }));
  }, [clampedProgress, delay]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animProgress.value),
  }));

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
          <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={t.colors.cardBorder} strokeWidth={strokeWidth} />
          <AnimatedCircle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={`url(#ringGrad-${label})`}
            strokeWidth={strokeWidth} strokeDasharray={circumference}
            animatedProps={animatedProps} strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <SvgText x={size / 2} y={size / 2 + 4} textAnchor="middle" fill={t.colors.textPrimary} fontSize={14} fontWeight="900">
            {value}
          </SvgText>
        </Svg>
      </Animated.View>
      <Text style={{ color: t.colors.textMuted, fontSize: 9, fontWeight: '800', marginTop: 6, letterSpacing: 0.5, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
};

// ─── Animated Progress Bar ───
const AnimatedProgressBar: React.FC<{
  label: string;
  current: number;
  limit: number;
  color: string;
  invert?: boolean;
  theme: AppTheme;
}> = ({ label, current, limit, color, invert = false, theme }) => {
  const { t } = useT();
  const pct = limit > 0 ? Math.min(Math.abs(current) / Math.abs(limit), 1) : 0;
  const isWarning = invert ? pct > 0.7 : pct > 0.85;
  const isDanger = invert ? pct > 0.9 : pct > 0.95;
  const barWidth = useSharedValue(0);

  useEffect(() => {
    barWidth.value = withTiming(pct, { duration: 800 });
  }, [pct]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${interpolate(barWidth.value, [0, 1], [0, 100])}%` as unknown as number,
  }));

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{label}</Text>
        <Text style={{ color: isDanger ? theme.colors.redLight : isWarning ? theme.colors.goldLight : theme.colors.textPrimary, fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
          ${Math.abs(current).toLocaleString()} / ${Math.abs(limit).toLocaleString()}
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: theme.colors.surface, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.cardBorder }}>
        <Animated.View style={[{ height: '100%', borderRadius: 4, backgroundColor: isDanger ? theme.colors.red : isWarning ? theme.colors.gold : color }, barStyle]} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontWeight: '700' }}>
          {invert ? (pct > 0.9 ? t('progressAlert') : pct > 0.7 ? t('progressWarning') : t('progressSafe')) : (pct > 0.95 ? t('progressAlmost') : pct > 0.85 ? t('progressOngoing') : t('progressAdvancing'))}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] }}>{(pct * 100).toFixed(1)}%</Text>
      </View>
    </View>
  );
};

// ─── Status Chip ───
const StatusChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  theme: AppTheme;
  delay?: number;
}> = ({ icon, label, value, color, theme: t, delay = 0 }) => (
  <Animated.View entering={FadeIn.delay(delay).duration(350)} style={{
    backgroundColor: t.colors.surface, borderColor: t.colors.cardBorder, borderWidth: 1,
    borderRadius: 10, padding: 10, flex: 1, alignItems: 'center', gap: 4,
  }}>
    {icon}
    <Text style={{ color: t.colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
    <Text style={{ color, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{value}</Text>
  </Animated.View>
);

// ─── Streak Tracker ───
const StreakTracker: React.FC<{
  closed: import('../types/domain').Trade[];
  theme: AppTheme;
}> = ({ closed, theme }) => {
  const { t } = useT();
  const { currentStreak, currentType, bestWinStreak, bestLossStreak } = useStreakData(closed);

  const streakColor = currentType === 'win' ? theme.colors.green : currentType === 'loss' ? theme.colors.red : theme.colors.textMuted;
  const streakLabel = currentType === 'win' ? '🔥 WIN' : currentType === 'loss' ? '💀 LOSS' : '—';

  return (
    <View>
      {/* Current Streak */}
      <View style={{ alignItems: 'center', marginBottom: 16 }}>
        <Text style={{ color: theme.colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 0.5, marginBottom: 4 }}>SÉRIE EN COURS</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: streakColor, fontSize: 32, fontFamily: theme.fonts.monoExtraBold }}>{currentStreak}</Text>
          <Text style={{ color: streakColor, fontSize: 12, fontWeight: '800' }}>{streakLabel}</Text>
        </View>
      </View>

      {/* Best Streaks */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1, backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder, borderWidth: 1, borderRadius: theme.borderRadius.md, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }}>🔥 {t('streakBest')}</Text>
          <Text style={{ color: theme.colors.greenLight, fontSize: 20, fontFamily: theme.fonts.monoBold, marginTop: 4 }}>{bestWinStreak}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>{t('streakWinsConsec')}</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: theme.colors.surface, borderColor: theme.colors.cardBorder, borderWidth: 1, borderRadius: theme.borderRadius.md, padding: 12, alignItems: 'center' }}>
          <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5 }}>💀 {t('streakWorst')}</Text>
          <Text style={{ color: theme.colors.redLight, fontSize: 20, fontFamily: theme.fonts.monoBold, marginTop: 4 }}>{bestLossStreak}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 9 }}>{t('streakLossesConsec')}</Text>
        </View>
      </View>
    </View>
  );
};

// ─── R:R Distribution Chart ───
const RRDistributionChart: React.FC<{
  closed: import('../types/domain').Trade[];
  theme: AppTheme;
}> = ({ closed, theme }) => {
  const { t } = useT();
  const buckets = useRRDistribution(closed);
  const maxCount = Math.max(...buckets.map(b => b.count), 1);
  const totalTrades = closed.length;

  if (buckets.length === 0) return <Text style={{ color: theme.colors.textMuted, fontSize: 11, textAlign: 'center', paddingVertical: 16 }}>{t('noTradesYet')}</Text>;

  return (
    <View>
      {buckets.map((b, i) => {
        const pct = totalTrades > 0 ? (b.count / totalTrades) * 100 : 0;
        const barWidth = (b.count / maxCount) * 100;
        const isPositive = b.min >= 0;
        const barColor = isPositive ? theme.colors.green : theme.colors.red;
        return (
          <View key={b.label} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 11, fontFamily: theme.fonts.monoBold }}>{b.label}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>{b.count} trades ({pct.toFixed(0)}%)</Text>
            </View>
            <View style={{ height: 8, backgroundColor: theme.colors.surface, borderRadius: 4, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${barWidth}%`, backgroundColor: barColor, borderRadius: 4 }} />
            </View>
          </View>
        );
      })}
    </View>
  );
};

// ─── Breakdown Row (shared by multiple tabs) ───
const BreakdownRow: React.FC<{
  items: { name: string; count: number; winRate: number; pnl: number }[];
  icon?: string;
  theme: AppTheme;
  nameKey?: (item: { name: string; count: number; winRate: number; pnl: number }) => string;
}> = ({ items, icon = '📊', theme: t, nameKey }) => (
  <>
    {items.map((item, i) => (
      <Animated.View key={item.name} entering={FadeIn.delay(i * 60).duration(300)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: t.spacing.sm, borderBottomColor: t.colors.cardBorder, borderBottomWidth: 1 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.colors.textPrimary, fontSize: 13, fontFamily: t.fonts.sansBold }}>{icon} {nameKey ? nameKey(item) : item.name}</Text>
            <Text style={{ color: t.colors.textMuted, fontSize: 10, marginTop: 2 }}>{item.count} trades</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 13, fontFamily: t.fonts.monoBold, fontVariant: ['tabular-nums'], color: item.winRate >= 50 ? t.colors.greenLight : item.count > 0 ? t.colors.redLight : t.colors.textMuted }}>
              {item.count > 0 ? `${item.winRate.toFixed(1)}% WR` : '—'}
            </Text>
            <Text style={{ color: item.pnl >= 0 ? t.colors.greenLight : t.colors.redLight, fontSize: 10, marginTop: 2 }}>
              {item.count > 0 ? `${item.pnl >= 0 ? '+' : '-'}$${Math.abs(item.pnl).toFixed(2)}` : '$0.00'}
            </Text>
          </View>
        </View>
      </Animated.View>
    ))}
  </>
);

import { TradingGoalsView } from '../components/analytics/TradingGoalsView';

export const AnalyticsScreen: React.FC = () => {
  const { theme } = useTheme();
  const s = useMemo(() => createAnalyticsStyles(theme), [theme]);
  const { t } = useT();

  const { light: hapticLight } = useHaptic();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['trades'] });
    await queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
    setRefreshing(false);
  };

  const data = useAnalyticsComputations(dateRange);
  const { goals, updateGoals, resetGoals } = useTradingGoals();


  // Determine which account types exist
  const activeAccountId = useUIStore((s: { activeAccountId: string | null }) => s.activeAccountId);
  const { hasPropFirm, hasPersonal } = useMemo(() => {
    const list = data.accounts || [];
    return {
      hasPropFirm: list.some((a: { type?: string }) => a.type === 'challenge' || a.type === 'funded'),
      hasPersonal: list.some((a: { type?: string }) => a.type === 'demo' || a.type === 'personal'),
    };
  }, [data.accounts]);

  // Dynamic tabs: show propfirm, goals, or both depending on selection
  const tabs = useMemo(() => {
    const base = TABS.filter(tab => tab.id !== 'propfirm');
    if (activeAccountId) {
      // Specific account selected — show matching tab only
      const acct = data.accounts?.find((a: { id: string; type?: string }) => a.id === activeAccountId);
      const isPF = acct?.type === 'challenge' || acct?.type === 'funded';
      if (isPF) base.push({ id: 'propfirm', labelKey: 'tabPropFirm', icon: Award });
      else base.push({ id: 'goals', labelKey: 'tradingGoals', icon: Target });
    } else {
      // "All accounts" — show both tabs if mixed types, otherwise the relevant one
      if (hasPropFirm) base.push({ id: 'propfirm', labelKey: 'tabPropFirm', icon: Award });
      if (hasPersonal) base.push({ id: 'goals', labelKey: 'tradingGoals', icon: Target });
      if (!hasPropFirm && !hasPersonal) base.push({ id: 'goals', labelKey: 'tradingGoals', icon: Target });
    }
    return base;
  }, [activeAccountId, hasPropFirm, hasPersonal, data.accounts]);

  // Reset active tab when account type changes (e.g. switch from prop firm → demo)
  useEffect(() => {
    if (!tabs.find(tab => tab.id === activeTab)) {
      setActiveTab('overview');
    }
  }, [tabs]);

  const dateRangeOptions = [
    { key: '7d' as const, labelKey: 'dateRange7d' as const },
    { key: '30d' as const, labelKey: 'dateRange30d' as const },
    { key: '90d' as const, labelKey: 'dateRange90d' as const },
    { key: 'all' as const, labelKey: 'dateRangeAll' as const },
  ];

  if (data.tradesLoading || data.accountsLoading || data.setupsLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  const equityChartData = data.equityKitData.labels.map((l, i) => ({
    date: l || `#${i + 1}`,
    value: data.equityKitData.datasets[0].data[i] || 0,
  }));

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}>
      {/* HEADER */}
      <Animated.View entering={FadeInDown.duration(350)} style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.screenTitle}>{t('tabAnalytics')}</Text>
          <Text style={s.screenSubtitle}>{t('screenSubtitleAnalytics')}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity style={s.shareBtn} onPress={() => setPdfModalVisible(true)} activeOpacity={0.7}>
            <FileText size={13} color={theme.colors.primaryLight} />
            <Text style={s.shareBtnText}>PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.shareBtn} onPress={() => setShareModalVisible(true)} activeOpacity={0.7}>
            <Share2 size={13} color={theme.colors.primaryLight} />
            <Text style={s.shareBtnText}>{t('sharePnl')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* TABS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabsScroll}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[s.tabItem, isActive && s.tabItemActive]}
              onPress={() => { hapticLight(); setActiveTab(tab.id); }}
              activeOpacity={0.7}
            >
              <Icon color={isActive ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{t(tab.labelKey as never)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* DATE RANGE */}
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
        {dateRangeOptions.map(opt => (
          <TouchableOpacity key={opt.key} style={[s.dateRangeBtn, dateRange === opt.key && s.dateRangeBtnActive]} onPress={() => setDateRange(opt.key)}>
            <Text style={[s.dateRangeText, dateRange === opt.key && s.dateRangeTextActive]}>{t(opt.labelKey as never)}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        <Text style={{ color: theme.colors.textMuted, fontSize: 9, fontFamily: theme.fonts.monoBold, alignSelf: 'center' }}>
          {data.closed.length} {t('tradesInPeriod')}
        </Text>
      </View>

      {/* ── TAB: OVERVIEW ── */}
      {activeTab === 'overview' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('kpiGlobal')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('netPnlTotal')}</Text>
                  <Text style={[s.kpiVal, data.totalPnL >= 0 ? s.greenText : s.redText]}>{data.totalPnL >= 0 ? '+' : '-'}${Math.abs(data.totalPnL).toFixed(2)}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('winRate')}</Text>
                  <Text style={[s.kpiVal, { color: theme.colors.cyan }]}>{data.winRate.toFixed(1)}%</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('profitFactor')}</Text>
                  <Text style={[s.kpiVal, { color: theme.colors.primaryLight }]}>{data.profitFactor === Infinity ? '∞' : data.profitFactor.toFixed(2)}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('profitLossRatio')}</Text>
                  <Text style={[s.kpiVal, { color: theme.colors.goldLight }]}>{data.avgLoss > 0 ? (data.avgWin / data.avgLoss).toFixed(2) : '1.0'}x</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('avgRMultiple')}</Text>
                  <Text style={[s.kpiVal, data.avgR >= 0 ? s.greenText : s.redText]}>{data.avgR >= 0 ? '+' : ''}{data.avgR.toFixed(2)}R</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('expectancy')}</Text>
                  <Text style={[s.kpiVal, data.expectancy >= 0 ? s.greenText : s.redText]}>{data.expectancy >= 0 ? '+' : '-'}${Math.abs(data.expectancy).toFixed(2)}</Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(60).duration(350)}>
            <Card title={t('expectancyR')} subtitle={t('expectancyDesc')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={[s.kpiBox, { flex: 0, minWidth: 80, alignItems: 'center' }]}>
                  <Text style={[s.kpiVal, data.expectancyR.value >= 0 ? s.greenText : s.redText, { fontSize: 22 }]}>{data.expectancyR.value >= 0 ? '+' : ''}{data.expectancyR.value.toFixed(2)}R</Text>
                  <Text style={[s.kpiLabel, { marginTop: 4 }]}>{t('expectancyR')}</Text>
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={s.rowBetween}>
                    <Text style={s.subMuted}>{t('winRate')} ({t('holdingTimeWins')})</Text>
                    <Text style={[s.boldVal, s.greenText]}>{data.expectancyR.winPct > 0 ? `${(data.expectancyR.winPct * 100).toFixed(0)}%` : '—'}</Text>
                  </View>
                  <View style={s.rowBetween}>
                    <Text style={s.subMuted}>Avg Win R</Text>
                    <Text style={[s.boldVal, s.greenText]}>+{data.expectancyR.avgWinR.toFixed(2)}R</Text>
                  </View>
                  <View style={s.rowBetween}>
                    <Text style={s.subMuted}>Avg Loss R</Text>
                    <Text style={[s.boldVal, s.redText]}>{data.expectancyR.avgLossR.toFixed(2)}R</Text>
                  </View>
                </View>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('equityGlowing')}>
              <GlowingEquityAreaChart data={equityChartData} height={190} />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(200).duration(350)}>
            <Card title={t('dailyPnl')}>
              {data.dailyPnL.length > 0 ? <BicolorBarChart data={data.dailyPnL} height={170} /> : <Text style={s.emptyText}>{t('noTradesYet')}</Text>}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB: EQUITY ── */}
      {activeTab === 'equity' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('equityDrawdown')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxDrawdown')}</Text>
                  <Text style={[s.kpiVal, s.redText]}>-${Math.abs(data.maxDrawdown).toFixed(2)}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('currentDrawdown')}</Text>
                  <Text style={[s.kpiVal, data.currentDrawdown > 0 ? s.redText : s.greenText]}>-${data.currentDrawdown.toFixed(2)}</Text>
                </View>
              </View>
              <GlowingEquityAreaChart data={equityChartData} height={190} />
            </Card>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('drawdownCurve')}>
              {data.drawdownData.length > 0 ? <GlowingEquityAreaChart data={data.drawdownData.map(d => ({ date: d.label, value: d.value }))} height={160} /> : <Text style={s.emptyText}>{t('noDrawdownData')}</Text>}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB: DISTRIBUTION ── */}
      {activeTab === 'distribution' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('gainLossSplit')}>
              {data.closed.length > 0 ? (
                <View style={{ alignItems: 'center' }}>
                  <DonutChart data={data.donutData} size={170} strokeWidth={26} centerValue={data.closed.length.toString()} centerLabel={t('tradesCount').toUpperCase()} />
                </View>
              ) : <Text style={s.emptyText}>{t('notEnoughTrades')}</Text>}
            </Card>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('streakTracker') || 'STREAKS'}>
              <StreakTracker closed={data.closed} theme={theme} />
            </Card>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(200).duration(350)}>
            <Card title={t('rrDistribution') || 'DISTRIBUTION R:R'}>
              <RRDistributionChart closed={data.closed} theme={theme} />
            </Card>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(300).duration(350)}>
            <Card title={t('holdingTimeAnalysis')}>
              {data.holdingTimeData.filter(h => h.count > 0).length === 0 ? <Text style={s.emptyText}>{t('noTradesYet')}</Text> : (
                data.holdingTimeData.filter(h => h.count > 0).map((ht, i) => (
                  <Animated.View key={ht.label} entering={FadeIn.delay(i * 60).duration(300)}>
                    <View style={s.rowBetween}>
                      <View style={{ flex: 1 }}><Text style={s.boldWhite}>⏱️ {ht.label}</Text><Text style={s.subMuted}>{ht.count} trades</Text></View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.boldVal, ht.winRate >= 50 ? s.greenText : ht.count > 0 ? s.redText : { color: theme.colors.textMuted }]}>{ht.count > 0 ? `${ht.winRate.toFixed(1)}% WR` : '—'}</Text>
                        <Text style={[s.subMuted, ht.pnl >= 0 ? s.greenText : s.redText]}>{ht.count > 0 ? `${ht.pnl >= 0 ? '+' : '-'}$${Math.abs(ht.pnl).toFixed(2)}` : `$0.00`}</Text>
                      </View>
                    </View>
                  </Animated.View>
                ))
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB: BREAKDOWN ── */}
      {activeTab === 'breakdown' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* Alerte Dérive M1 > 1h */}
          {data.abnormalM1Trades.length > 0 && (
            <Animated.View entering={FadeIn.delay(0).duration(350)}>
              <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: 'rgba(239, 68, 68, 0.3)', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                <Text style={{ color: theme.colors.redLight, fontSize: 11, fontFamily: theme.fonts.sansBold, marginBottom: 4 }}>
                  {t('m1DriftAlert')}
                </Text>
                <Text style={{ color: theme.colors.textSecondary, fontSize: 10, lineHeight: 14 }}>
                  {t('m1DriftDesc', data.abnormalM1Trades.length, formatCurrency(data.abnormalM1Trades.reduce((acc, tr) => acc + (tr.pnl || 0), 0)))}
                </Text>
              </View>
            </Animated.View>
          )}

          {/* Performance par Style de Trading (Scalp / Intraday / Swing) */}
          <Animated.View entering={FadeIn.delay(40).duration(350)}>
            <Card title={t('perfByTradeStyle')}>
              <View style={{ gap: 8 }}>
                {[
                  { key: 'scalping', label: t('tradeStyleScalping'), icon: '⚡' },
                  { key: 'intraday', label: t('tradeStyleIntraday'), icon: '📈' },
                  { key: 'swing', label: t('tradeStyleSwing'), icon: '🌊' },
                ].map(st => {
                  const item = data.styleMap[st.key];
                  const count = item?.count || 0;
                  const wins = item?.wins || 0;
                  const pnl = item?.pnl || 0;
                  const wr = count > 0 ? (wins / count) * 100 : 0;
                  const isPos = pnl >= 0;

                  return (
                    <View key={st.key} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.boldWhite}>{st.icon} {st.label}</Text>
                        <Text style={s.subMuted}>{count} trade(s) · {count > 0 ? `${wr.toFixed(0)}% WR` : '—'}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.boldVal, count > 0 ? (isPos ? s.greenText : s.redText) : { color: theme.colors.textMuted }]}>
                          {count > 0 ? formatCurrency(pnl) : '$0.00'}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(80).duration(350)}>
            <Card title={t('winRateBySetup')}><BreakdownRow items={data.setupBreakdown} icon="🎯" theme={theme}  /></Card>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(120).duration(350)}>
            <Card title={t('perfByInstrument')}><BreakdownRow items={data.pairBreakdown} theme={theme}  /></Card>
          </Animated.View>
          <Animated.View entering={FadeIn.delay(160).duration(350)}>
            <Card title={t('perfByTimeframe')}><BreakdownRow items={data.tfBreakdown} theme={theme}  /></Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB: TIMING ── */}
      {activeTab === 'timing' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('hourlyPnlAmplitude')}>
              {data.timingBreakdown.length > 0 ? <BicolorBarChart data={data.timingBreakdown} height={170} /> : <Text style={s.emptyText}>{t('noHourlyData')}</Text>}
            </Card>
          </Animated.View>
          <SessionHeatmapCard trades={data.closed} />

          {/* Matrice Croisée Jours x Sessions */}
          <Animated.View entering={FadeIn.delay(80).duration(350)}>
            <Card title={t('sessionDayMatrixTitle')}>
              <View style={{ marginTop: 8 }}>
                <View style={{ flexDirection: 'row', borderBottomColor: theme.colors.cardBorder, borderBottomWidth: 1, paddingBottom: 6, marginBottom: 8 }}>
                  <Text style={{ width: 80, color: theme.colors.textMuted, fontSize: 9, fontFamily: theme.fonts.monoBold }}>SESSION</Text>
                  {data.sessionDayMatrix.days.map(d => (
                    <Text key={d} style={{ flex: 1, textAlign: 'center', color: theme.colors.textMuted, fontSize: 9, fontFamily: theme.fonts.monoBold }}>{d}</Text>
                  ))}
                </View>
                {data.sessionDayMatrix.sessions.map(sess => (
                  <View key={sess} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1 }}>
                    <Text style={{ width: 80, color: theme.colors.textPrimary, fontSize: 10, fontFamily: theme.fonts.sansBold }}>{sess}</Text>
                    {[0, 1, 2, 3, 4].map(dayIdx => {
                      const cell = data.sessionDayMatrix.matrix[`${sess}_${dayIdx}`];
                      const count = cell?.total || 0;
                      const pnl = cell?.pnl || 0;
                      const isPos = pnl > 0;
                      const isNeg = pnl < 0;
                      const bg = count === 0 ? 'transparent' : isPos ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)';
                      const textColor = count === 0 ? theme.colors.textMuted : isPos ? theme.colors.greenLight : theme.colors.redLight;
                      return (
                        <View key={dayIdx} style={{ flex: 1, alignItems: 'center', backgroundColor: bg, borderRadius: 4, paddingVertical: 3, marginHorizontal: 2 }}>
                          <Text style={{ fontSize: 8, fontFamily: theme.fonts.monoBold, color: textColor }}>
                            {count > 0 ? (pnl >= 0 ? `+$${pnl.toFixed(0)}` : `-$${Math.abs(pnl).toFixed(0)}`) : '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                ))}
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(120).duration(350)}>
            <Card title={t('sessionBreakdown')}>
              {data.sessionBreakdown.filter(s => s.count > 0).length === 0 ? <Text style={s.emptyText}>{t('noTradesYet')}</Text> : (
                data.sessionBreakdown.filter(s => s.count > 0).map((sb, i) => (
                  <Animated.View key={sb.name} entering={FadeIn.delay(i * 60).duration(300)}>
                    <View style={s.rowBetween}>
                      <View style={{ flex: 1 }}><Text style={s.boldWhite}>{t(sb.labelKey as never)}</Text><Text style={s.subMuted}>{sb.count} {t('tradesCount').toLowerCase()} · Avg R: {sb.avgR >= 0 ? '+' : ''}{sb.avgR.toFixed(2)}</Text></View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[s.boldVal, sb.winRate >= 50 ? s.greenText : sb.count > 0 ? s.redText : { color: theme.colors.textMuted }]}>{sb.count > 0 ? `${sb.winRate.toFixed(1)}% WR` : '—'}</Text>
                        <Text style={[s.subMuted, sb.pnl >= 0 ? s.greenText : s.redText]}>{sb.count > 0 ? `${sb.pnl >= 0 ? '+' : '-'}$${Math.abs(sb.pnl).toFixed(2)}` : `$0.00`}</Text>
                      </View>
                    </View>
                  </Animated.View>
                ))
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB: PSYCHOLOGY ── */}
      {activeTab === 'psychology' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* SIMULATEUR WHAT-IF */}
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('whatIfTitle')}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <View style={[s.kpiBox, { flex: 1, backgroundColor: data.whatIfSimulation.isBetter ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }]}>
                  <Text style={s.kpiLabel}>{t('whatIfImpactLabel')}</Text>
                  <Text style={[s.kpiVal, data.whatIfSimulation.diff >= 0 ? s.greenText : s.redText]}>
                    {formatCurrency(data.whatIfSimulation.diff)}
                  </Text>
                  <Text style={[s.subMuted, { fontSize: 8, marginTop: 2 }]}>
                    {t('whatIfTradesOverRisk', data.whatIfSimulation.improvedCount)}
                  </Text>
                </View>
              </View>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 10, lineHeight: 14 }}>
                💡 {t('whatIfDescription', formatCurrency(data.whatIfSimulation.simulatedPnL), formatCurrency(data.whatIfSimulation.actualPnL))}
              </Text>
            </Card>
          </Animated.View>

          {/* DIAGNOSTICS & CORRÉLATIONS PSYCHOLOGIQUES */}
          {data.psychInsights.length > 0 && (
            <Animated.View entering={FadeIn.delay(40).duration(350)}>
              <Card title="DIAGNOSTICS & IMPACT MENTAL">
                <View style={{ gap: 8 }}>
                  {data.psychInsights.map((ins, idx) => {
                    const isDanger = ins.type === 'danger';
                    const isWarn = ins.type === 'warning';
                    const bg = isDanger ? 'rgba(239, 68, 68, 0.12)' : isWarn ? 'rgba(245, 158, 11, 0.12)' : 'rgba(16, 185, 129, 0.12)';
                    const border = isDanger ? 'rgba(239, 68, 68, 0.3)' : isWarn ? 'rgba(245, 158, 11, 0.3)' : 'rgba(16, 185, 129, 0.3)';
                    const textColor = isDanger ? theme.colors.redLight : isWarn ? theme.colors.goldLight : theme.colors.greenLight;
                    return (
                      <View key={idx} style={{ backgroundColor: bg, borderColor: border, borderWidth: 1, borderRadius: 8, padding: 10 }}>
                        <Text style={{ color: textColor, fontSize: 10, fontFamily: theme.fonts.sansBold, lineHeight: 14 }}>
                          {data.lang === 'fr' ? ins.textFr : ins.textEn}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </Card>
            </Animated.View>
          )}

          {/* PLAN DISCIPLINE COMPARISON (EDGE CRÉATEUR) */}
          <Animated.View entering={FadeIn.delay(60).duration(350)}>
            <Card title={t('planRespectedCard')}>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                {/* Plan Respecté */}
                <View style={[s.kpiBox, { flex: 1, backgroundColor: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.25)', borderWidth: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <CheckCircle2 size={12} color={theme.colors.greenLight} />
                    <Text style={[s.kpiLabel, { color: theme.colors.greenLight }]}>{t('tfPlanYes')}</Text>
                  </View>
                  <Text style={[s.kpiVal, s.greenText]}>
                    {data.planDiscipline.respectedCount > 0
                      ? `${((data.planDiscipline.respectedWins / data.planDiscipline.respectedCount) * 100).toFixed(0)}% WR`
                      : '—'}
                  </Text>
                  <Text style={[s.subMuted, { fontSize: 9, marginTop: 2, color: theme.colors.greenLight }]}>
                    {formatCurrency(data.planDiscipline.respectedPnL)} ({data.planDiscipline.respectedCount} trades)
                  </Text>
                </View>

                {/* Plan Violé */}
                <View style={[s.kpiBox, { flex: 1, backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)', borderWidth: 1 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <AlertOctagon size={12} color={theme.colors.redLight} />
                    <Text style={[s.kpiLabel, { color: theme.colors.redLight }]}>{t('tfPlanNo')}</Text>
                  </View>
                  <Text style={[s.kpiVal, s.redText]}>
                    {data.planDiscipline.violatedCount > 0
                      ? `${((data.planDiscipline.violatedWins / data.planDiscipline.violatedCount) * 100).toFixed(0)}% WR`
                      : '—'}
                  </Text>
                  <Text style={[s.subMuted, { fontSize: 9, marginTop: 2, color: theme.colors.redLight }]}>
                    {formatCurrency(data.planDiscipline.violatedPnL)} ({data.planDiscipline.violatedCount} trades)
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* LEAK DETECTOR (COÛT FINANCIER DES ERREURS) */}
          <Animated.View entering={FadeIn.delay(80).duration(350)}>
            <Card title={t('leakDetectorCard')}>
              {Object.keys(data.mistakeMap).length === 0 ? (
                <Text style={s.emptyText}>{t('noMistakesRecorded')}</Text>
              ) : (
                <View style={{ gap: 8 }}>
                  {Object.entries(data.mistakeMap)
                    .sort(([, a], [, b]) => a.pnl - b.pnl)
                    .map(([mKey, stats], idx) => {
                      const cost = stats.pnl;
                      const isNeg = cost < 0;
                      return (
                        <View key={mKey} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, borderBottomColor: 'rgba(255,255,255,0.04)', borderBottomWidth: 1 }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.boldWhite}>{mistakeLabel(t, mKey)}</Text>
                            <Text style={s.subMuted}>{stats.count} {t('leakOccurrences')} · {stats.losses} {t('leakLosses')}</Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={[s.boldVal, isNeg ? s.redText : s.greenText]}>
                              {formatCurrency(cost)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                </View>
              )}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('mentalImpact')}>
              <BreakdownRow items={data.mentalBreakdown} icon="🧠" theme={theme} />
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB: PROP FIRM ── */}
      {activeTab === 'propfirm' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: 12 }}>
            <StatusChip icon={data.propFirmData.profitPct >= 1 ? <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.colors.greenLight, fontSize: 10 }}>✓</Text></View> : <Flame color={theme.colors.gold} size={18} />} label={t('propFirmStatus')} value={data.propFirmData.profitPct >= 1 ? t('propFirmPassed') : t('propFirmInProgress')} color={data.propFirmData.profitPct >= 1 ? theme.colors.greenLight : theme.colors.goldLight} theme={theme} delay={0} />
            <StatusChip icon={<Target color={theme.colors.primaryLight} size={18} />} label={t('totalTrades')} value={`${data.closed.length}`} color={theme.colors.primaryLight} theme={theme} delay={80} />
            <StatusChip icon={<Shield color={data.propFirmData.drawdownPct > 0.9 ? theme.colors.red : theme.colors.cyan} size={18} />} label={t('maxDrawdownKpi')} value={`${(data.propFirmData.drawdownPct * 100).toFixed(0)}%`} color={data.propFirmData.drawdownPct > 0.9 ? theme.colors.redLight : theme.colors.cyanLight} theme={theme} delay={160} />
          </View>

          <Animated.View entering={FadeIn.delay(80).duration(350)}>
            <Card title={t('challengeProgress')}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 }}>
                <ProgressRing progress={data.propFirmData.profitPct} color={theme.colors.green} label={t('target')} value={`${data.totalPnL >= 0 ? '+' : '-'}$${Math.abs(data.totalPnL).toFixed(0)}`} theme={theme} delay={200} />
                <ProgressRing progress={1 - data.propFirmData.drawdownPct} color={data.propFirmData.drawdownPct > 0.9 ? theme.colors.red : theme.colors.cyan} label={t('tgDrawdown')} value={`${((1 - data.propFirmData.drawdownPct) * 100).toFixed(0)}%`} theme={theme} delay={300} />
                <ProgressRing progress={data.propFirmData.wrPct} color={theme.colors.primaryLight} label={t('winRate')} value={`${data.winRate.toFixed(0)}%`} theme={theme} delay={400} />
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(160).duration(350)}>
            <Card title={t('meters')}>
              <AnimatedProgressBar label={'📈 ' + t('target')} current={data.totalPnL} limit={data.profitTarget} color={theme.colors.green} theme={theme} />
              <AnimatedProgressBar label={'📉 ' + t('maxDrawdownLabel')} current={data.maxDrawdown} limit={data.maxDrawdownLimit} color={theme.colors.red} invert theme={theme} />
              {data.propFirmData.dailyLossLimit > 0 && <AnimatedProgressBar label={'⚡ ' + t('maxLossPerDay')} current={data.propFirmData.worstDay < 0 ? Math.abs(data.propFirmData.worstDay) : 0} limit={data.propFirmData.dailyLossLimit} color={theme.colors.gold} invert theme={theme} />}
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(240).duration(350)}>
            <Card title={t('challengeStats')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('bestDay')}</Text><Text style={[s.kpiVal, s.greenText]}>+${Math.abs(data.propFirmData.bestDay).toFixed(2)}</Text></View>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('worstDay')}</Text><Text style={[s.kpiVal, s.redText]}>-${Math.abs(data.propFirmData.worstDay).toFixed(2)}</Text></View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('maxWinStreak')}</Text><Text style={[s.kpiVal, s.greenText]}>🔥 {data.propFirmData.maxConsecWins}</Text></View>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('maxLossStreak')}</Text><Text style={[s.kpiVal, s.redText]}>💀 {data.propFirmData.maxConsecLosses}</Text></View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('tradingDays')}</Text><Text style={[s.kpiVal, { color: theme.colors.cyan }]}>{data.propFirmData.uniqueDays}</Text></View>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('consistencyScore')}</Text><Text style={[s.kpiVal, { color: theme.colors.goldLight }]}>{data.propFirmData.consistencyPct.toFixed(0)}%</Text></View>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(320).duration(350)}>
            <Card title={t('challengeParams')}>
              <View style={s.rowBetween}><Text style={s.subMuted}>{t('profitTargetLabelStat')}</Text><Text style={s.boldWhite}>${data.profitTarget.toLocaleString()}</Text></View>
              <View style={s.rowBetween}><Text style={s.subMuted}>{t('maxDrawdownLimitStat')}</Text><Text style={s.boldWhite}>${data.maxDrawdownLimit.toLocaleString()}</Text></View>
              <View style={s.rowBetween}><Text style={s.subMuted}>{t('initialBalanceLabel2')}</Text><Text style={s.boldWhite}>${data.initialBalance.toLocaleString()}</Text></View>
              {data.selectedAccount?.max_daily_loss_limit && <View style={s.rowBetween}><Text style={s.subMuted}>{t('maxDailyLossLabel2')}</Text><Text style={s.boldWhite}>${data.selectedAccount.max_daily_loss_limit.toLocaleString()}</Text></View>}
              <View style={s.rowBetween}><Text style={s.subMuted}>{t('accountTypeLabel2')}</Text><Text style={[s.boldWhite, { color: theme.colors.primaryLight }]}>{data.selectedAccount?.type?.toUpperCase() || 'CHALLENGE'}</Text></View>
            </Card>
          </Animated.View>

          {data.challengeCountdown && (
            <Animated.View entering={FadeIn.delay(400).duration(350)}>
              <Card title={t('challengeCountdown')}>
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <View style={{ width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: data.challengeCountdown.isExpired ? theme.colors.red : data.challengeCountdown.daysLeft <= 7 ? theme.colors.goldLight : theme.colors.green, alignItems: 'center', justifyContent: 'center', backgroundColor: data.challengeCountdown.isExpired ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.1)' }}>
                    <Text style={{ fontSize: 28, fontWeight: '900', color: data.challengeCountdown.isExpired ? theme.colors.red : data.challengeCountdown.daysLeft <= 7 ? theme.colors.goldLight : theme.colors.green, fontVariant: ['tabular-nums'] }}>{data.challengeCountdown.isExpired ? '0' : data.challengeCountdown.daysLeft}</Text>
                  </View>
                  <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '800', color: data.challengeCountdown.isExpired ? theme.colors.redLight : theme.colors.textPrimary, letterSpacing: 0.8 }}>{data.challengeCountdown.isExpired ? t('challengeExpired') : t('daysRemaining')}</Text>
                  <Text style={{ marginTop: 4, fontSize: 10, color: theme.colors.textMuted, fontFamily: theme.fonts.monoBold }}>{data.challengeCountdown.endDate.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}</Text>
                </View>
              </Card>
            </Animated.View>
          )}

          <Animated.View entering={FadeIn.delay(450).duration(350)}>
            <Card title={t('drawdownProjection')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('projectionDaysLeft')}</Text><Text style={[s.kpiVal, data.ddProjection.ddLevel === 'safe' ? s.greenText : data.ddProjection.ddLevel === 'warning' ? { color: theme.colors.goldLight } : s.redText]}>{data.ddProjection.daysUntilMaxDd >= 999 ? '∞' : `${data.ddProjection.daysUntilMaxDd}J`}</Text></View>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('projectionAvgDailyDD')}</Text><Text style={[s.kpiVal, { color: theme.colors.cyan }]}>-${data.ddProjection.avgDailyDd.toFixed(2)}</Text></View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}><Text style={s.kpiLabel}>{t('maxDrawdownLabel')} restant</Text><Text style={[s.kpiVal, s.redText]}>-${data.ddProjection.remainingDd.toFixed(2)}</Text></View>
                <View style={[s.kpiBox, { backgroundColor: data.ddProjection.ddLevel === 'safe' ? 'rgba(16, 185, 129, 0.1)' : data.ddProjection.ddLevel === 'warning' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                  <Text style={s.kpiLabel}>STATUS</Text>
                  <Text style={[s.kpiVal, data.ddProjection.ddLevel === 'safe' ? s.greenText : data.ddProjection.ddLevel === 'warning' ? { color: theme.colors.goldLight } : s.redText, { fontSize: 11 }]}>{data.ddProjection.ddLevel === 'safe' ? t('projectionSafe') : data.ddProjection.ddLevel === 'warning' ? t('projectionWarning') : t('projectionDanger')}</Text>
                </View>
              </View>
            </Card>
          </Animated.View>

        </Animated.View>
      )}

      {/* ── TAB: TRADING GOALS (demo/personal) ── */}
      {activeTab === 'goals' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <TradingGoalsView goals={goals} updateGoals={updateGoals} resetGoals={resetGoals} closed={data.closed} theme={theme} t={t} />
        </Animated.View>
      )}

      <View style={{ height: 40 }} />

      <ShareCardModal visible={shareModalVisible} onClose={() => setShareModalVisible(false)} trades={data.trades} accountName={data.selectedAccount?.name || 'Tous les comptes'} />
      <ExportPdfModal visible={pdfModalVisible} onClose={() => setPdfModalVisible(false)} accounts={data.accounts} trades={data.trades} />
    </ScrollView>
  );
};
