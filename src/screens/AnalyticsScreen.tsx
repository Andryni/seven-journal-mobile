import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
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
import { useAccounts } from '../features/accounts/useAccounts';
import { usePlaybookSetups } from '../features/playbook/usePlaybook';
import { useUIStore } from '../store/uiStore';
import type { Trade } from '../types/domain';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT } from '../i18n';
import { formatShortDate } from '../utils/formatDate';
import { Card } from '../components/ui/Card';
import { PieChart } from 'react-native-chart-kit';
import { GlowingEquityAreaChart } from '../components/ui/GlowingEquityAreaChart';
import { BicolorBarChart } from '../components/ui/BicolorBarChart';
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
} from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundColor: '#14161f',
  backgroundGradientFrom: '#181920',
  backgroundGradientTo: '#101217',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
  style: { borderRadius: 16 },
  propsForDots: { r: '4', strokeWidth: '2', stroke: '#818cf8' },
  propsForBackgroundLines: { strokeDasharray: '', stroke: 'rgba(255, 255, 255, 0.05)' },
};

type TabType = 'overview' | 'equity' | 'distribution' | 'breakdown' | 'timing' | 'psychology' | 'propfirm';

const TABS: { id: TabType; labelKey: string; icon: React.FC<{ color?: string; size?: number }> }[] = [
  { id: 'overview', labelKey: 'tabOverview', icon: Activity },
  { id: 'equity', labelKey: 'tabEquity', icon: TrendingUp },
  { id: 'distribution', labelKey: 'tabDistribution', icon: BarChart3 },
  { id: 'breakdown', labelKey: 'tabBreakdown', icon: Target },
  { id: 'timing', labelKey: 'tabTiming', icon: Clock },
  { id: 'psychology', labelKey: 'tabPsychology', icon: Brain },
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
      <Text style={{ color: t.colors.textMuted, fontSize: 9, fontWeight: '800', marginTop: 6, letterSpacing: 0.5, textAlign: 'center' }}>
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
        <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Text style={{ color: isDanger ? theme.colors.redLight : isWarning ? theme.colors.goldLight : theme.colors.textPrimary, fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
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
        <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontWeight: '700' }}>
          {invert ? (pct > 0.9 ? t('progressAlert') : pct > 0.7 ? t('progressWarning') : t('progressSafe')) : (pct > 0.95 ? t('progressAlmost') : pct > 0.85 ? t('progressOngoing') : t('progressAdvancing'))}
        </Text>
        <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
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
    <Text style={{ color: t.colors.textMuted, fontSize: 8, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</Text>
    <Text style={{ color, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{value}</Text>
  </Animated.View>
);

export const AnalyticsScreen: React.FC = () => {
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
  const { t } = useT();
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { setups: playbookSetups, isLoading: setupsLoading } = usePlaybookSetups();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);

  const [activeTab, setActiveTab] = useState<TabType>('overview');

  const selectedAccount = useMemo(() => {
    if (activeAccountId) return accounts.find(a => a.id === activeAccountId);
    return accounts[0];
  }, [accounts, activeAccountId]);

  const initialBalance = selectedAccount?.initial_balance || 100000;
  const profitTarget = selectedAccount?.profit_target || 10000;
  const maxDrawdownLimit = selectedAccount?.max_drawdown_limit || 10000;

  const closed = useMemo(
    () => trades.filter((t: Trade) => t.pnl !== null && (!activeAccountId || t.account_id === activeAccountId)),
    [trades, activeAccountId]
  );

  // 1. OVERVIEW & KPI
  const wins = closed.filter(t => (t.pnl || 0) > 0);
  const losses = closed.filter(t => (t.pnl || 0) < 0);
  const breakeven = closed.filter(t => (t.pnl || 0) === 0);
  const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossProfit = wins.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  const avgR = closed.length > 0 ? closed.reduce((s, t) => s + (t.r_multiple || 0), 0) / closed.length : 0;
  const expectancy = closed.length > 0 ? totalPnL / closed.length : 0;

  // 2. EQUITY & DRAWDOWN DATA
  const { equityKitData, maxDrawdown, currentDrawdown, drawdownData } = useMemo(() => {
    const sorted = [...closed].sort(
      (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
    );
    let cum = 0;
    let peak = 0;
    let maxDd = 0;

    const values = [0];
    const labels = ['0'];
    const ddValues: { label: string; value: number }[] = [];
    let peakSoFar = 0;

    sorted.forEach((t, i) => {
      cum += (t.pnl || 0);
      if (cum > peakSoFar) peakSoFar = cum;
      const dd = peakSoFar - cum;
      if (dd > maxDd) maxDd = dd;
      values.push(cum);
      ddValues.push({ label: `${i + 1}`, value: -dd });
      if (i % Math.max(1, Math.floor(sorted.length / 5)) === 0 || i === sorted.length - 1) {
        labels.push(`${i + 1}`);
      } else {
        labels.push('');
      }
    });

    const currDd = peakSoFar - cum;
    return {
      equityKitData: {
        labels: labels.slice(0, 7),
        datasets: [
          {
            data: values.slice(0, 7),
            color: (opacity = 1) => totalPnL >= 0 ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`,
            strokeWidth: 3,
          },
        ],
      },
      maxDrawdown: maxDd,
      currentDrawdown: currDd,
      drawdownData: ddValues.slice(-10),
    };
  }, [closed, totalPnL]);

  // Daily PnL for bar chart
  const dailyPnL = useMemo(() => {
    const map: Record<string, number> = {};
    closed.forEach(t => {
      const day = formatShortDate(new Date(t.entry_time));
      map[day] = (map[day] || 0) + (t.pnl || 0);
    });
    return Object.entries(map)
      .slice(-7)
      .map(([label, value]) => ({ label, value }));
  }, [closed]);

  // Win Rate Trend
  const winRateTrend = useMemo(() => {
    const window = 5;
    const result: { label: string; value: number }[] = [];
    for (let i = window; i <= closed.length; i++) {
      const slice = closed.slice(i - window, i);
      const wr = (slice.filter(t => (t.pnl || 0) > 0).length / slice.length) * 100;
      result.push({ label: `${i}`, value: wr });
    }
    return result.slice(-8);
  }, [closed]);

  // 3. PIE DATA
  const pieData = useMemo(() => [
    { name: 'Gains', population: wins.length || 1, color: '#10b981', legendFontColor: '#94a3b8', legendFontSize: 11 },
    { name: 'Pertes', population: losses.length || 1, color: '#ef4444', legendFontColor: '#94a3b8', legendFontSize: 11 },
    { name: 'BE', population: breakeven.length || 1, color: '#6366f1', legendFontColor: '#94a3b8', legendFontSize: 11 },
  ], [wins, losses, breakeven]);

  // 4. PAR SETUP
  const setupBreakdown = useMemo(() => {
    if (playbookSetups.length > 0) {
      return playbookSetups.map(s => {
        const titleLower = s.title.toLowerCase().trim();
        const sub = closed.filter(t => {
          if (t.setup_structures && t.setup_structures.some(st => st.toLowerCase().trim() === titleLower)) return true;
          const notesLower = (t.notes || '').toLowerCase();
          if (notesLower.includes(titleLower)) return true;
          if (titleLower.includes('bos') && t.setup_structures && t.setup_structures.includes('BOS')) return true;
          if ((titleLower.includes('ob') || titleLower.includes('order block')) && t.setup_ob) return true;
          if ((titleLower.includes('fvg') || titleLower.includes('gap')) && t.setup_fvg) return true;
          if ((titleLower.includes('sweep') || titleLower.includes('liquidity')) && t.setup_liquidity_sweep) return true;
          if (playbookSetups.length === 1) return true;
          return false;
        });
        const w = sub.filter(t => (t.pnl || 0) > 0).length;
        const pnl = sub.reduce((acc, t) => acc + (t.pnl || 0), 0);
        const wr = sub.length > 0 ? (w / sub.length) * 100 : 0;
        return { name: s.title, count: sub.length, winRate: wr, pnl };
      });
    }

    const defs = [
      { name: 'BOS (Break of Structure)', check: (t: Trade) => t.setup_structures.includes('BOS') },
      { name: 'Order Block (OB)', check: (t: Trade) => t.setup_ob },
      { name: 'Fair Value Gap (FVG)', check: (t: Trade) => t.setup_fvg },
      { name: 'Liquidity Sweep', check: (t: Trade) => t.setup_liquidity_sweep },
    ];
    return defs.map(({ name, check }) => {
      const sub = closed.filter(check);
      const w = sub.filter(t => (t.pnl || 0) > 0).length;
      const pnl = sub.reduce((s, t) => s + (t.pnl || 0), 0);
      const wr = sub.length > 0 ? (w / sub.length) * 100 : 0;
      return { name, count: sub.length, winRate: wr, pnl };
    });
  }, [playbookSetups, closed]);

  const pairBreakdown = useMemo(() => {
    const map: Record<string, { pnl: number; wins: number; total: number }> = {};
    closed.forEach(t => {
      if (!map[t.pair]) map[t.pair] = { pnl: 0, wins: 0, total: 0 };
      map[t.pair].pnl += (t.pnl || 0);
      map[t.pair].total++;
      if ((t.pnl || 0) > 0) map[t.pair].wins++;
    });
    return Object.entries(map).map(([pair, d]) => ({
      name: pair,
      pnl: d.pnl,
      winRate: d.total > 0 ? (d.wins / d.total) * 100 : 0,
      total: d.total,
    }));
  }, [closed]);

  const tfBreakdown = useMemo(() => {
    const map: Record<string, { pnl: number; wins: number; total: number }> = {};
    closed.forEach(t => {
      if (!map[t.timeframe]) map[t.timeframe] = { pnl: 0, wins: 0, total: 0 };
      map[t.timeframe].pnl += (t.pnl || 0);
      map[t.timeframe].total++;
      if ((t.pnl || 0) > 0) map[t.timeframe].wins++;
    });
    return Object.entries(map).map(([tf, d]) => ({
      name: tf,
      pnl: d.pnl,
      winRate: d.total > 0 ? (d.wins / d.total) * 100 : 0,
      total: d.total,
    }));
  }, [closed]);

  // 5. TIMING
  const timingBreakdown = useMemo(() => {
    const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20];
    return hours.map(h => {
      const match = closed.filter(t => new Date(t.entry_time).getHours() === h);
      const pnl = match.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return { label: `${h}h`, value: pnl };
    }).filter(h => h.value !== 0);
  }, [closed]);

  // 6. PSYCHOLOGY
  const mentalBreakdown = useMemo(() => {
    const states = ['focused', 'anxious', 'greedy', 'revenge', 'fomo', 'tired'];
    return states.map(st => {
      const match = closed.filter(t => t.mental_state === st);
      const w = match.filter(t => (t.pnl || 0) > 0).length;
      const wr = match.length > 0 ? (w / match.length) * 100 : 0;
      const pnl = match.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return { state: st.toUpperCase(), count: match.length, winRate: wr, pnl };
    });
  }, [closed]);

  // 7. PROP FIRM SPECIFIC
  const propFirmData = useMemo(() => {
    const profitPct = profitTarget > 0 ? Math.min(totalPnL / profitTarget, 1) : 0;
    const drawdownPct = maxDrawdownLimit > 0 ? Math.min(maxDrawdown / maxDrawdownLimit, 1) : 0;
    const wrPct = winRate / 100;
    const dailyLossLimit = selectedAccount?.max_daily_loss_limit || 0;

    const dayMap: Record<string, number> = {};
    closed.forEach(t => {
      const day = new Date(t.entry_time).toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + (t.pnl || 0);
    });
    const dayPnls = Object.values(dayMap);
    const bestDay = dayPnls.length > 0 ? Math.max(...dayPnls) : 0;
    const worstDay = dayPnls.length > 0 ? Math.min(...dayPnls) : 0;

    let maxConsecWins = 0;
    let maxConsecLosses = 0;
    let curWins = 0;
    let curLosses = 0;
    closed.forEach(t => {
      if ((t.pnl || 0) > 0) { curWins++; curLosses = 0; maxConsecWins = Math.max(maxConsecWins, curWins); }
      else if ((t.pnl || 0) < 0) { curLosses++; curWins = 0; maxConsecLosses = Math.max(maxConsecLosses, curLosses); }
      else { curWins = 0; curLosses = 0; }
    });

    const uniqueDays = Object.keys(dayMap).length;
    const maxDayPnl = dayPnls.length > 0 ? Math.max(...dayPnls) : 0;
    const consistencyPct = totalPnL > 0 ? (maxDayPnl / totalPnL) * 100 : 0;

    return {
      profitPct, drawdownPct, wrPct,
      dailyLossLimit, bestDay, worstDay,
      maxConsecWins, maxConsecLosses,
      uniqueDays, consistencyPct,
    };
  }, [closed, totalPnL, profitTarget, maxDrawdownLimit, winRate, selectedAccount]);

  if (tradesLoading || accountsLoading || setupsLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <Animated.View entering={FadeInDown.duration(350)} style={s.header}>
        <Text style={s.screenTitle}>{t('tabAnalytics')}</Text>
        <Text style={s.screenSubtitle}>{t('screenSubtitleAnalytics')}</Text>
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
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{t(tab.labelKey as any)}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── TAB 1 : VUE D'ENSEMBLE ── */}
      {activeTab === 'overview' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('kpiGlobal')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('netPnlTotal')}</Text>
                  <Text style={[s.kpiVal, totalPnL >= 0 ? s.greenText : s.redText]}>
                    {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('winRate')}</Text>
                  <Text style={[s.kpiVal, { color: theme.colors.cyan }]}>{winRate.toFixed(1)}%</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('profitFactor')}</Text>
                  <Text style={[s.kpiVal, { color: theme.colors.primaryLight }]}>
                    {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('profitLossRatio')}</Text>
                  <Text style={[s.kpiVal, { color: theme.colors.goldLight }]}>
                    {avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '1.0'}x
                  </Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('avgRMultiple')}</Text>
                  <Text style={[s.kpiVal, avgR >= 0 ? s.greenText : s.redText]}>
                    {avgR >= 0 ? '+' : ''}{avgR.toFixed(2)}R
                  </Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('expectancy')}</Text>
                  <Text style={[s.kpiVal, expectancy >= 0 ? s.greenText : s.redText]}>
                    {expectancy >= 0 ? '+' : ''}${expectancy.toFixed(2)}
                  </Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('equityGlowing')}>
              <GlowingEquityAreaChart
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
                <BicolorBarChart data={dailyPnL} height={170} />
              ) : (
                <Text style={s.emptyText}>{t('noTradesYet')}</Text>
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 2 : EQUITY & DRAWDOWN ── */}
      {activeTab === 'equity' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('equityDrawdown')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxDrawdown')}</Text>
                  <Text style={[s.kpiVal, s.redText]}>-${maxDrawdown.toFixed(2)}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('currentDrawdown')}</Text>
                  <Text style={[s.kpiVal, currentDrawdown > 0 ? s.redText : s.greenText]}>
                    -${currentDrawdown.toFixed(2)}
                  </Text>
                </View>
              </View>
              <GlowingEquityAreaChart
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
                  data={drawdownData.map(d => ({ date: d.label, value: d.value }))}
                  height={160}
                />
              ) : (
                <Text style={s.emptyText}>{t('noDrawdownData')}</Text>
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 3 : DISTRIBUTION ── */}
      {activeTab === 'distribution' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('gainLossSplit')}>
              <PieChart
                data={pieData}
                width={screenWidth - 64}
                height={160}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </Card>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(100).duration(350)}>
            <Card title={t('rollingWinRate')}>
              {winRateTrend.length > 0 ? (
                <BicolorBarChart
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
                data={closed.slice(-7).map((t, idx) => ({
                  label: `${t.pair.slice(0, 3)}#${idx + 1}`,
                  value: t.pnl || 0,
                }))}
                height={170}
              />
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 4 : PAR SETUP / PAIRE / TF ── */}
      {activeTab === 'breakdown' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('winRateBySetup')}>
              {setupBreakdown.map((st, i) => (
                <Animated.View key={st.name} entering={FadeIn.delay(i * 60).duration(300)}>
                  <View style={s.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.boldWhite}>🎯 {st.name}</Text>
                      <Text style={s.subMuted}>{st.count} trades exécutés</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.boldVal, st.winRate >= 50 ? s.greenText : st.count > 0 ? s.redText : { color: theme.colors.textMuted }]}>
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
                      <Text style={s.boldWhite}>{p.name}</Text>
                      <Text style={s.subMuted}>{p.total} trades</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.boldVal, p.winRate >= 50 ? s.greenText : s.redText]}>
                        {p.winRate.toFixed(1)}% WR
                      </Text>
                      <Text style={[s.subMuted, p.pnl >= 0 ? s.greenText : s.redText]}>
                        {p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)}
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
                      <Text style={s.boldWhite}>{tf.name}</Text>
                      <Text style={s.subMuted}>{tf.total} trades</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.boldVal, tf.winRate >= 50 ? s.greenText : s.redText]}>
                        {tf.winRate.toFixed(1)}% WR
                      </Text>
                      <Text style={[s.subMuted, tf.pnl >= 0 ? s.greenText : s.redText]}>
                        {tf.pnl >= 0 ? '+' : ''}$${tf.pnl.toFixed(2)}
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
      {activeTab === 'timing' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('hourlyPnlAmplitude')}>
              {timingBreakdown.length > 0 ? (
                <BicolorBarChart data={timingBreakdown} height={170} />
              ) : (
                <Text style={s.emptyText}>{t('noHourlyData')}</Text>
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      {/* ── TAB 6 : PSYCHOLOGIE ── */}
      {activeTab === 'psychology' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          <Animated.View entering={FadeIn.delay(0).duration(350)}>
            <Card title={t('mentalImpact')}>
              {mentalBreakdown.map((mb, i) => (
                <Animated.View key={mb.state} entering={FadeIn.delay(i * 60).duration(300)}>
                  <View style={s.rowBetween}>
                    <View>
                      <Text style={s.boldWhite}>{mb.state}</Text>
                      <Text style={s.subMuted}>{mb.count} sessions</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={[s.boldVal, mb.winRate >= 50 ? s.greenText : s.redText]}>
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

      {/* ── TAB 7 : PROP FIRM TRACKER ── */}
      {activeTab === 'propfirm' && (
        <Animated.View entering={FadeInLeft.duration(280)} style={s.tabContent}>
          {/* Status Chips */}
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, marginBottom: 12 }}>
            <StatusChip
              icon={propFirmData.profitPct >= 1 ?
                <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(16, 185, 129, 0.2)', alignItems: 'center', justifyContent: 'center' }}>
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
              <AnimatedProgressBar label={'📈 ' + t('target')} current={totalPnL} limit={profitTarget} color={theme.colors.green} theme={theme} />
              <AnimatedProgressBar label={'📉 ' + t('maxDrawdownLabel')} current={maxDrawdown} limit={maxDrawdownLimit} color={theme.colors.red} invert theme={theme} />
              {propFirmData.dailyLossLimit > 0 && (
                <AnimatedProgressBar label={'⚡ ' + t('maxLossPerDay')} current={propFirmData.worstDay < 0 ? Math.abs(propFirmData.worstDay) : 0} limit={propFirmData.dailyLossLimit} color={theme.colors.gold} invert theme={theme} />
              )}
            </Card>
          </Animated.View>

          {/* Stats Grid */}
          <Animated.View entering={FadeIn.delay(240).duration(350)}>
            <Card title={t('challengeStats')}>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('bestDay')}</Text>
                  <Text style={[s.kpiVal, s.greenText]}>+${propFirmData.bestDay.toFixed(2)}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('worstDay')}</Text>
                  <Text style={[s.kpiVal, s.redText]}>${propFirmData.worstDay.toFixed(2)}</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxWinStreak')}</Text>
                  <Text style={[s.kpiVal, s.greenText]}>🔥 {propFirmData.maxConsecWins}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('maxLossStreak')}</Text>
                  <Text style={[s.kpiVal, s.redText]}>💀 {propFirmData.maxConsecLosses}</Text>
                </View>
              </View>
              <View style={s.grid2}>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('tradingDays')}</Text>
                  <Text style={[s.kpiVal, { color: theme.colors.cyan }]}>{propFirmData.uniqueDays}</Text>
                </View>
                <View style={s.kpiBox}>
                  <Text style={s.kpiLabel}>{t('consistencyScore')}</Text>
                  <Text style={[s.kpiVal, { color: theme.colors.goldLight }]}>{propFirmData.consistencyPct.toFixed(0)}%</Text>
                </View>
              </View>
            </Card>
          </Animated.View>

          {/* Challenge Parameters */}
          <Animated.View entering={FadeIn.delay(320).duration(350)}>
            <Card title={t('challengeParams')}>
              <View style={s.rowBetween}>
                <Text style={s.subMuted}>{t('profitTargetLabelStat')}</Text>
                <Text style={s.boldWhite}>${profitTarget.toLocaleString()}</Text>
              </View>
              <View style={s.rowBetween}>
                <Text style={s.subMuted}>{t('maxDrawdownLimitStat')}</Text>
                <Text style={s.boldWhite}>${maxDrawdownLimit.toLocaleString()}</Text>
              </View>
              <View style={s.rowBetween}>
                <Text style={s.subMuted}>{t('initialBalanceLabel2')}</Text>
                <Text style={s.boldWhite}>${initialBalance.toLocaleString()}</Text>
              </View>
              {selectedAccount?.max_daily_loss_limit && (
                <View style={s.rowBetween}>
                  <Text style={s.subMuted}>{t('maxDailyLossLabel2')}</Text>
                  <Text style={s.boldWhite}>${selectedAccount.max_daily_loss_limit.toLocaleString()}</Text>
                </View>
              )}
              <View style={s.rowBetween}>
                <Text style={s.subMuted}>{t('accountTypeLabel2')}</Text>
                <Text style={[s.boldWhite, { color: theme.colors.primaryLight }]}>
                  {selectedAccount?.type?.toUpperCase() || 'CHALLENGE'}
                  {/* @ts-ignore - type is a valid account type */}
                </Text>
              </View>
            </Card>
          </Animated.View>

          {/* Drawdown Chart */}
          <Animated.View entering={FadeIn.delay(400).duration(350)}>
            <Card title={t('drawdownCurve')}>
              {drawdownData.length > 0 ? (
                <GlowingEquityAreaChart
                  data={drawdownData.map(d => ({ date: d.label, value: d.value }))}
                  height={160}
                />
              ) : (
                <Text style={s.emptyText}>{t('noDrawdownData')}</Text>
              )}
            </Card>
          </Animated.View>
        </Animated.View>
      )}

      <View style={{ height: 40 }} />
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
    marginBottom: theme.spacing.md,
  },
  screenTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
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
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#ffffff',
  },
  tabContent: {
    paddingBottom: theme.spacing.xxl,
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
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  kpiVal: {
    color: '#ffffff',
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
    color: '#ffffff',
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
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
    fontStyle: 'italic',
  },
});
