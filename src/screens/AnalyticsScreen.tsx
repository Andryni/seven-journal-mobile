import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MotiView } from 'moti';
import { useTrades } from '../features/trades/useTrades';
import { useAccounts } from '../features/accounts/useAccounts';
import { usePlaybookSetups } from '../features/playbook/usePlaybook';
import { useUIStore } from '../store/uiStore';
import type { Trade } from '../types/domain';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
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
  CheckCircle,
  XCircle,
  AlertTriangle,
  Flame,
  Shield,
  Zap,
  TrendingDown,
} from 'lucide-react-native';
import Svg, { Rect, Line, Circle, G, Defs, LinearGradient, Stop, Path, Text as SvgText } from 'react-native-svg';

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

const TABS: { id: TabType; label: string; icon: React.FC<{ color?: string; size?: number }> }[] = [
  { id: 'overview', label: "VUE D'ENSEMBLE", icon: Activity },
  { id: 'equity', label: 'EQUITY & DRAWDOWN', icon: TrendingUp },
  { id: 'distribution', label: 'DISTRIBUTION', icon: BarChart3 },
  { id: 'breakdown', label: 'PAR SETUP/PAIRE', icon: Target },
  { id: 'timing', label: 'TIMING (H/J)', icon: Clock },
  { id: 'psychology', label: 'PSYCHOLOGIE', icon: Brain },
  { id: 'propfirm', label: 'PROP FIRM', icon: Award },
];

// ─── Animated wrapper for staggered list items ───
const FadeInView: React.FC<{
  children: React.ReactNode;
  delay?: number;
  theme: AppTheme;
}> = ({ children, delay = 0, theme: t }) => (
  <MotiView
    from={{ opacity: 0, translateY: 18 }}
    animate={{ opacity: 1, translateY: 0 }}
    transition={{ type: 'timing', duration: 420, delay }}
  >
    {children}
  </MotiView>
);

// ─── Animated Progress Ring (SVG) for Prop Firm ───
const ProgressRing: React.FC<{
  progress: number; // 0-1
  size?: number;
  strokeWidth?: number;
  color: string;
  label: string;
  value: string;
  theme: AppTheme;
}> = ({ progress, size = 80, strokeWidth = 8, color, label, value, theme: t }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.min(Math.max(progress, 0), 1);
  const strokeDashoffset = circumference * (1 - clampedProgress);

  return (
    <View style={{ alignItems: 'center', width: 100 }}>
      <MotiView
        from={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', damping: 14, delay: 200 }}
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={`ringGrad-${label}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity="1" />
              <Stop offset="1" stopColor={color} stopOpacity="0.5" />
            </LinearGradient>
          </Defs>
          {/* Background track */}
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={t.colors.cardBorder}
            strokeWidth={strokeWidth}
          />
          {/* Animated arc */}
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
          {/* Center value */}
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
      </MotiView>
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
  invert?: boolean; // true = lower is better (drawdown)
  theme: AppTheme;
}> = ({ label, current, limit, color, invert = false, theme: t }) => {
  const pct = limit > 0 ? Math.min(Math.abs(current) / Math.abs(limit), 1) : 0;
  const isWarning = invert ? pct > 0.7 : pct > 0.85;
  const isDanger = invert ? pct > 0.9 : pct > 0.95;

  return (
    <View style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: t.colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>
          {label}
        </Text>
        <Text style={{ color: isDanger ? t.colors.redLight : isWarning ? t.colors.goldLight : t.colors.textPrimary, fontSize: 11, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
          ${Math.abs(current).toLocaleString()} / ${Math.abs(limit).toLocaleString()}
        </Text>
      </View>
      {/* Bar background */}
      <View style={{ height: 8, backgroundColor: t.colors.surface, borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.cardBorder }}>
        <MotiView
          from={{ width: '0%' }}
          animate={{ width: `${pct * 100}%` }}
          transition={{ type: 'spring', damping: 18, delay: 300 }}
          style={{
            height: '100%',
            borderRadius: 4,
            backgroundColor: isDanger ? t.colors.red : isWarning ? t.colors.gold : color,
          }}
        />
      </View>
      {/* Percentage */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 }}>
        <Text style={{ color: t.colors.textMuted, fontSize: 8, fontWeight: '700' }}>
          {invert ? (pct > 0.9 ? '⚠️ ALERTE' : pct > 0.7 ? 'ATTENTION' : 'SAFE') : (pct > 0.95 ? '🔥 PRESQUE' : pct > 0.85 ? 'EN COURS' : 'EN PROGRESSION')}
        </Text>
        <Text style={{ color: t.colors.textMuted, fontSize: 8, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
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
}> = ({ icon, label, value, color, theme: t }) => (
  <MotiView
    from={{ opacity: 0, scale: 0.85 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ type: 'spring', damping: 14, delay: 400 }}
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
  </MotiView>
);

export const AnalyticsScreen: React.FC = () => {
  const { theme } = useTheme();
  const s = useMemo(() => createStyles(theme), [theme]);
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
      const day = new Date(t.entry_time).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
      map[day] = (map[day] || 0) + (t.pnl || 0);
    });
    return Object.entries(map)
      .slice(-7)
      .map(([label, value]) => ({ label: label.slice(0, 6), value }));
  }, [closed]);

  // Win Rate Trend (last N trades rolling)
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
    {
      name: 'Gains',
      population: wins.length || 1,
      color: '#10b981',
      legendFontColor: '#94a3b8',
      legendFontSize: 11,
    },
    {
      name: 'Pertes',
      population: losses.length || 1,
      color: '#ef4444',
      legendFontColor: '#94a3b8',
      legendFontSize: 11,
    },
    {
      name: 'BE',
      population: breakeven.length || 1,
      color: '#6366f1',
      legendFontColor: '#94a3b8',
      legendFontSize: 11,
    },
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

  // 4b. PAR PAIRE
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

  // 4c. PAR TIMEFRAME
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

    // Best & worst day
    const dayMap: Record<string, number> = {};
    closed.forEach(t => {
      const day = new Date(t.entry_time).toISOString().split('T')[0];
      dayMap[day] = (dayMap[day] || 0) + (t.pnl || 0);
    });
    const dayPnls = Object.values(dayMap);
    const bestDay = dayPnls.length > 0 ? Math.max(...dayPnls) : 0;
    const worstDay = dayPnls.length > 0 ? Math.min(...dayPnls) : 0;

    // Consecutive wins/losses
    let maxConsecWins = 0;
    let maxConsecLosses = 0;
    let curWins = 0;
    let curLosses = 0;
    closed.forEach(t => {
      if ((t.pnl || 0) > 0) {
        curWins++;
        curLosses = 0;
        maxConsecWins = Math.max(maxConsecWins, curWins);
      } else if ((t.pnl || 0) < 0) {
        curLosses++;
        curWins = 0;
        maxConsecLosses = Math.max(maxConsecLosses, curLosses);
      } else {
        curWins = 0;
        curLosses = 0;
      }
    });

    // Trading days
    const uniqueDays = Object.keys(dayMap).length;

    // Consistency: largest single-day contribution as % of total profit
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
      <MotiView
        from={{ opacity: 0, translateY: -12 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 350 }}
        style={s.header}
      >
        <Text style={s.screenTitle}>ANALYTICS</Text>
        <Text style={s.screenSubtitle}>Diagnostic quantitatif · Moteur React Native Chart Kit</Text>
      </MotiView>

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
              <Text style={[s.tabText, isActive && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── TAB 1 : VUE D'ENSEMBLE ── */}
      {activeTab === 'overview' && (
          <MotiView
            key="overview"
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 20 }}
            transition={{ type: 'timing', duration: 250 }}
            style={s.tabContent}
          >
            <FadeInView theme={theme}>
              <Card title="KPI GLOBAUX">
                <View style={s.grid2}>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>NET P&L TOTAL</Text>
                    <Text style={[s.kpiVal, totalPnL >= 0 ? s.greenText : s.redText]}>
                      {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>WIN RATE</Text>
                    <Text style={[s.kpiVal, { color: theme.colors.cyan }]}>{winRate.toFixed(1)}%</Text>
                  </View>
                </View>
                <View style={s.grid2}>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>PROFIT FACTOR</Text>
                    <Text style={[s.kpiVal, { color: theme.colors.primaryLight }]}>
                      {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>RATIO GAIN/PERTE</Text>
                    <Text style={[s.kpiVal, { color: theme.colors.goldLight }]}>
                      {avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '1.0'}x
                    </Text>
                  </View>
                </View>
                <View style={s.grid2}>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>AVG R-MULTIPLE</Text>
                    <Text style={[s.kpiVal, avgR >= 0 ? s.greenText : s.redText]}>
                      {avgR >= 0 ? '+' : ''}{avgR.toFixed(2)}R
                    </Text>
                  </View>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>EXPECTANCY</Text>
                    <Text style={[s.kpiVal, expectancy >= 0 ? s.greenText : s.redText]}>
                      {expectancy >= 0 ? '+' : ''}${expectancy.toFixed(2)}
                    </Text>
                  </View>
                </View>
              </Card>
            </FadeInView>

            <FadeInView delay={100} theme={theme}>
              <Card title="COURBE D'ÉQUITÉ">
                <GlowingEquityAreaChart
                  data={equityKitData.labels.map((l, i) => ({
                    date: l || `#${i + 1}`,
                    value: equityKitData.datasets[0].data[i] || 0,
                  }))}
                  height={190}
                />
              </Card>
            </FadeInView>

            <FadeInView delay={200} theme={theme}>
              <Card title="P&L JOURNALIER (7 DERNIERS JOURS)">
                {dailyPnL.length > 0 ? (
                  <BicolorBarChart data={dailyPnL} height={170} />
                ) : (
                  <Text style={s.emptyText}>Pas encore de trades enregistrés.</Text>
                )}
              </Card>
            </FadeInView>
          </MotiView>
        )}

        {/* ── TAB 2 : EQUITY & DRAWDOWN ── */}
        {activeTab === 'equity' && (
          <MotiView
            key="equity"
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 20 }}
            transition={{ type: 'timing', duration: 250 }}
            style={s.tabContent}
          >
            <FadeInView theme={theme}>
              <Card title="ÉQUITÉ & DRAWDOWN">
                <View style={s.grid2}>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>MAX DRAWDOWN</Text>
                    <Text style={[s.kpiVal, styles.redText]}>-${maxDrawdown.toFixed(2)}</Text>
                  </View>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>DRAWDOWN ACTUEL</Text>
                    <Text style={[s.kpiVal, currentDrawdown > 0 ? styles.redText : s.greenText]}>
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
            </FadeInView>

            <FadeInView delay={100} theme={theme}>
              <Card title="COURBE DE DRAWDOWN">
                {drawdownData.length > 0 ? (
                  <GlowingEquityAreaChart
                    data={drawdownData.map(d => ({
                      date: d.label,
                      value: d.value,
                    }))}
                    height={160}
                  />
                ) : (
                  <Text style={s.emptyText}>Aucune donnée de drawdown.</Text>
                )}
              </Card>
            </FadeInView>
          </MotiView>
        )}

        {/* ── TAB 3 : DISTRIBUTION ── */}
        {activeTab === 'distribution' && (
          <MotiView
            key="distribution"
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 20 }}
            transition={{ type: 'timing', duration: 250 }}
            style={s.tabContent}
          >
            <FadeInView theme={theme}>
              <Card title="RÉPARTITION GAINS / PERTES">
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
            </FadeInView>

            <FadeInView delay={100} theme={theme}>
              <Card title="WIN RATE ROLLING (5 TRADES)">
                {winRateTrend.length > 0 ? (
                  <BicolorBarChart
                    data={winRateTrend.map(wr => ({ label: wr.label, value: wr.value - 50 }))}
                    height={170}
                  />
                ) : (
                  <Text style={s.emptyText}>Pas assez de trades pour un trend.</Text>
                )}
              </Card>
            </FadeInView>

            <FadeInView delay={200} theme={theme}>
              <Card title="P&L DES DERNIÈRES POSITIONS">
                <BicolorBarChart
                  data={closed.slice(-7).map((t, idx) => ({
                    label: `${t.pair.slice(0, 3)}#${idx + 1}`,
                    value: t.pnl || 0,
                  }))}
                  height={170}
                />
              </Card>
            </FadeInView>
          </MotiView>
        )}

        {/* ── TAB 4 : PAR SETUP / PAIRE / TF ── */}
        {activeTab === 'breakdown' && (
          <MotiView
            key="breakdown"
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 20 }}
            transition={{ type: 'timing', duration: 250 }}
            style={s.tabContent}
          >
            <FadeInView theme={theme}>
              <Card title="WIN RATE PAR STRATÉGIE">
                {setupBreakdown.map((st, i) => (
                  <FadeInView key={st.name} delay={i * 60} theme={theme}>
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
                  </FadeInView>
                ))}
              </Card>
            </FadeInView>

            <FadeInView delay={100} theme={theme}>
              <Card title="PERFORMANCE PAR INSTRUMENT">
                {pairBreakdown.map((p, i) => (
                  <FadeInView key={p.name} delay={i * 60} theme={theme}>
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
                  </FadeInView>
                ))}
              </Card>
            </FadeInView>

            <FadeInView delay={200} theme={theme}>
              <Card title="PERFORMANCE PAR TIMEFRAME">
                {tfBreakdown.map((tf, i) => (
                  <FadeInView key={tf.name} delay={i * 60} theme={theme}>
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
                  </FadeInView>
                ))}
              </Card>
            </FadeInView>
          </MotiView>
        )}

        {/* ── TAB 5 : TIMING ── */}
        {activeTab === 'timing' && (
          <MotiView
            key="timing"
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 20 }}
            transition={{ type: 'timing', duration: 250 }}
            style={s.tabContent}
          >
            <FadeInView theme={theme}>
              <Card title="AMPLITUDE P&L PAR HORAIRE">
                {timingBreakdown.length > 0 ? (
                  <BicolorBarChart data={timingBreakdown} height={170} />
                ) : (
                  <Text style={s.emptyText}>Aucune donnée horaire disponible.</Text>
                )}
              </Card>
            </FadeInView>
          </MotiView>
        )}

        {/* ── TAB 6 : PSYCHOLOGIE ── */}
        {activeTab === 'psychology' && (
          <MotiView
            key="psychology"
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 20 }}
            transition={{ type: 'timing', duration: 250 }}
            style={s.tabContent}
          >
            <FadeInView theme={theme}>
              <Card title="IMPACT DU MENTAL SUR LE P&L">
                {mentalBreakdown.map((mb, i) => (
                  <FadeInView key={mb.state} delay={i * 60} theme={theme}>
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
                  </FadeInView>
                ))}
              </Card>
            </FadeInView>
          </MotiView>
        )}

        {/* ── TAB 7 : PROP FIRM TRACKER ── */}
        {activeTab === 'propfirm' && (
          <MotiView
            key="propfirm"
            from={{ opacity: 0, translateX: -20 }}
            animate={{ opacity: 1, translateX: 0 }}
            exit={{ opacity: 0, translateX: 20 }}
            transition={{ type: 'timing', duration: 250 }}
            style={s.tabContent}
          >
            {/* ── Status Chips Row ── */}
            <FadeInView theme={theme}>
              <View style={[s.grid3, { marginBottom: 12 }]}>
                <StatusChip
                  icon={propFirmData.profitPct >= 1 ?
                    <CheckCircle color={theme.colors.green} size={18} /> :
                    <Flame color={theme.colors.gold} size={18} />
                  }
                  label="STATUS"
                  value={propFirmData.profitPct >= 1 ? 'PASSÉ' : 'EN COURS'}
                  color={propFirmData.profitPct >= 1 ? theme.colors.greenLight : theme.colors.goldLight}
                  theme={theme}
                />
                <StatusChip
                  icon={<Target color={theme.colors.primaryLight} size={18} />}
                  label="TRADES"
                  value={`${closed.length}`}
                  color={theme.colors.primaryLight}
                  theme={theme}
                />
                <StatusChip
                  icon={<Shield color={propFirmData.drawdownPct > 0.9 ? theme.colors.red : theme.colors.cyan} size={18} />}
                  label="DRAWDOWN"
                  value={`${(propFirmData.drawdownPct * 100).toFixed(0)}%`}
                  color={propFirmData.drawdownPct > 0.9 ? theme.colors.redLight : theme.colors.cyanLight}
                  theme={theme}
                />
              </View>
            </FadeInView>

            {/* ── Progress Rings ── */}
            <FadeInView delay={80} theme={theme}>
              <Card title="PROGRESSION DES OBJECTIFS">
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 }}>
                  <ProgressRing
                    progress={propFirmData.profitPct}
                    color={theme.colors.green}
                    label="PROFIT TARGET"
                    value={`$${totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(0)}`}
                    theme={theme}
                  />
                  <ProgressRing
                    progress={1 - propFirmData.drawdownPct}
                    color={propFirmData.drawdownPct > 0.9 ? theme.colors.red : theme.colors.cyan}
                    label="DRAWDOWN LIMIT"
                    value={`${(propFirmData.drawdownPct * 100).toFixed(0)}%`}
                    theme={theme}
                  />
                  <ProgressRing
                    progress={propFirmData.wrPct}
                    color={theme.colors.primaryLight}
                    label="WIN RATE"
                    value={`${winRate.toFixed(0)}%`}
                    theme={theme}
                  />
                </View>
              </Card>
            </FadeInView>

            {/* ── Progress Bars ── */}
            <FadeInView delay={160} theme={theme}>
              <Card title="MÈTRES DE LIMITES">
                <AnimatedProgressBar
                  label="📈 PROFIT TARGET"
                  current={totalPnL}
                  limit={profitTarget}
                  color={theme.colors.green}
                  theme={theme}
                />
                <AnimatedProgressBar
                  label="📉 MAX DRAWDOWN"
                  current={maxDrawdown}
                  limit={maxDrawdownLimit}
                  color={theme.colors.red}
                  invert
                  theme={theme}
                />
                {propFirmData.dailyLossLimit > 0 && (
                  <AnimatedProgressBar
                    label="⚡ DAILY LOSS LIMIT"
                    current={propFirmData.worstDay < 0 ? Math.abs(propFirmData.worstDay) : 0}
                    limit={propFirmData.dailyLossLimit}
                    color={theme.colors.gold}
                    invert
                    theme={theme}
                  />
                )}
              </Card>
            </FadeInView>

            {/* ── Stats Grid ── */}
            <FadeInView delay={240} theme={theme}>
              <Card title="STATISTIQUES DU CHALLENGE">
                <View style={s.grid2}>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>MEILLEURE JOURNÉE</Text>
                    <Text style={[s.kpiVal, s.greenText]}>
                      +${propFirmData.bestDay.toFixed(2)}
                    </Text>
                  </View>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>PIRE JOURNÉE</Text>
                    <Text style={[s.kpiVal, s.redText]}>
                      ${propFirmData.worstDay.toFixed(2)}
                    </Text>
                  </View>
                </View>
                <View style={s.grid2}>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>MAX WIN STREAK</Text>
                    <Text style={[s.kpiVal, s.greenText]}>
                      🔥 {propFirmData.maxConsecWins}
                    </Text>
                  </View>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>MAX LOSS STREAK</Text>
                    <Text style={[s.kpiVal, s.redText]}>
                      💀 {propFirmData.maxConsecLosses}
                    </Text>
                  </View>
                </View>
                <View style={s.grid2}>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>JOURS DE TRADING</Text>
                    <Text style={[s.kpiVal, { color: theme.colors.cyan }]}>
                      {propFirmData.uniqueDays}
                    </Text>
                  </View>
                  <View style={s.kpiBox}>
                    <Text style={s.kpiLabel}>CONSISTENCY</Text>
                    <Text style={[s.kpiVal, { color: theme.colors.goldLight }]}>
                      {propFirmData.consistencyPct.toFixed(0)}%
                    </Text>
                  </View>
                </View>
              </Card>
            </FadeInView>

            {/* ── Challenge Parameters ── */}
            <FadeInView delay={320} theme={theme}>
              <Card title="PARAMÈTRES DU CHALLENGE">
                <View style={s.rowBetween}>
                  <Text style={s.subMuted}>Objectif de Profit :</Text>
                  <Text style={s.boldWhite}>${profitTarget.toLocaleString()}</Text>
                </View>
                <View style={s.rowBetween}>
                  <Text style={s.subMuted}>Max Drawdown Limite :</Text>
                  <Text style={s.boldWhite}>${maxDrawdownLimit.toLocaleString()}</Text>
                </View>
                <View style={s.rowBetween}>
                  <Text style={s.subMuted}>Balance Initiale :</Text>
                  <Text style={s.boldWhite}>${initialBalance.toLocaleString()}</Text>
                </View>
                {selectedAccount?.max_daily_loss_limit && (
                  <View style={s.rowBetween}>
                    <Text style={s.subMuted}>Max Daily Loss :</Text>
                    <Text style={s.boldWhite}>${selectedAccount.max_daily_loss_limit.toLocaleString()}</Text>
                  </View>
                )}
                <View style={s.rowBetween}>
                  <Text style={s.subMuted}>Type :</Text>
                  <Text style={[s.boldWhite, { color: theme.colors.primaryLight }]}>
                    {selectedAccount?.type?.toUpperCase() || 'CHALLENGE'}
                  </Text>
                </View>
              </Card>
            </FadeInView>

            {/* ── Drawdown Chart ── */}
            <FadeInView delay={400} theme={theme}>
              <Card title="COURBE DE DRAWDOWN">
                {drawdownData.length > 0 ? (
                  <GlowingEquityAreaChart
                    data={drawdownData.map(d => ({ date: d.label, value: d.value }))}
                    height={160}
                  />
                ) : (
                  <Text style={s.emptyText}>Aucune donnée de drawdown.</Text>
                )}
              </Card>
            </FadeInView>
          </MotiView>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  redText: { color: '#f87171' },
});

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
  grid3: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
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
