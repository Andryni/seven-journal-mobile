import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useTrades } from '../features/trades/useTrades';
import { useAccounts } from '../features/accounts/useAccounts';
import { useUIStore } from '../store/uiStore';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { LineChart, BarChart, PieChart } from 'react-native-gifted-charts';
import Svg, { Circle } from 'react-native-svg';
import {
  Activity,
  TrendingUp,
  BarChart3,
  Target,
  Clock,
  Brain,
  Award,
  AlertCircle,
  TrendingDown,
  CheckCircle,
} from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;

// ─── Circular Gauge Component ────────────────────────────────────────────────
function CircularGaugeRN({
  percent,
  label,
  color = theme.colors.green,
  size = 100,
}: {
  percent: number;
  label: string;
  color?: string;
  size?: number;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(Math.max(percent, 0), 100);
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <View style={{ alignItems: 'center', marginHorizontal: 8 }}>
      <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#1e2028"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
              {pct.toFixed(0)}%
            </Text>
          </View>
        </View>
      </View>
      <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: '700', marginTop: 4, textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

type TabType = 'overview' | 'equity' | 'distribution' | 'breakdown' | 'timing' | 'psychology' | 'propfirm';

const TABS: { id: TabType; label: string; icon: React.FC<{ color?: string; size?: number }> }[] = [
  { id: 'overview', label: "VUE D'ENSEMBLE", icon: Activity },
  { id: 'equity', label: 'EQUITY & DRAWDOWN', icon: TrendingUp },
  { id: 'distribution', label: 'DISTRIBUTION', icon: BarChart3 },
  { id: 'breakdown', label: 'PAR SETUP/PAIRE', icon: Target },
  { id: 'timing', label: 'TIMING (H/J)', icon: Clock },
  { id: 'psychology', label: 'PSYCHOLOGIE & ERREURS', icon: Brain },
  { id: 'propfirm', label: 'PROP FIRM TRACKER', icon: Award },
];

export const AnalyticsScreen: React.FC = () => {
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();
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

  // 1. OVERVIEW & KPI METRICS
  const wins = closed.filter(t => (t.pnl || 0) > 0);
  const losses = closed.filter(t => (t.pnl || 0) < 0);
  const totalPnL = closed.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossProfit = wins.reduce((s, t) => s + (t.pnl || 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnl || 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99.9 : 0;
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;

  // 2. EQUITY & DRAWDOWN DATA
  const { equityChartData, maxDrawdown, currentDrawdown } = useMemo(() => {
    const sorted = [...closed].sort(
      (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
    );
    let cum = initialBalance;
    let peak = initialBalance;
    let maxDd = 0;

    const data = sorted.map((t, i) => {
      cum += (t.pnl || 0);
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDd) maxDd = dd;
      return {
        value: cum,
        label: `${i + 1}`,
      };
    });

    const currDd = peak - cum;
    return {
      equityChartData: data.length > 0 ? [{ value: initialBalance, label: '0' }, ...data] : [{ value: initialBalance, label: '0' }],
      maxDrawdown: maxDd,
      currentDrawdown: currDd,
    };
  }, [closed, initialBalance]);

  // 3. DISTRIBUTION (P&L Bar Chart & Donut)
  const distributionBarData = useMemo(() => {
    return closed.slice(0, 15).map((t, i) => ({
      value: Math.abs(t.pnl || 0),
      frontColor: (t.pnl || 0) >= 0 ? theme.colors.green : theme.colors.red,
      label: `${i + 1}`,
    }));
  }, [closed]);

  const pieData = useMemo(() => [
    { value: wins.length || 1, color: theme.colors.green, text: `${wins.length}W` },
    { value: losses.length || 1, color: theme.colors.red, text: `${losses.length}L` },
    { value: (closed.length - wins.length - losses.length) || 0, color: theme.colors.textMuted, text: 'BE' },
  ], [wins, losses, closed]);

  // 4. BREAKDOWN BY SETUP & PAIR
  const setupBreakdown = useMemo(() => {
    const setups = ['BOS', 'OB', 'FVG', 'Liquidity Sweep'];
    return setups.map(s => {
      let matching: Trade[] = [];
      if (s === 'BOS') matching = closed.filter(t => t.setup_structures.includes('BOS'));
      if (s === 'OB') matching = closed.filter(t => t.setup_ob);
      if (s === 'FVG') matching = closed.filter(t => t.setup_fvg);
      if (s === 'Liquidity Sweep') matching = closed.filter(t => t.setup_liquidity_sweep);

      const w = matching.filter(t => (t.pnl || 0) > 0).length;
      const wr = matching.length > 0 ? (w / matching.length) * 100 : 0;
      const pnl = matching.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return { name: s, count: matching.length, winRate: wr, pnl };
    });
  }, [closed]);

  // 5. TIMING BY HOUR
  const hourData = useMemo(() => {
    const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20];
    return hours.map(h => {
      const matching = closed.filter(t => {
        const d = new Date(t.entry_time);
        return d.getHours() === h;
      });
      const pnl = matching.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return {
        value: Math.abs(pnl),
        frontColor: pnl >= 0 ? theme.colors.green : theme.colors.red,
        label: `${h}h`,
      };
    });
  }, [closed]);

  // 6. PSYCHOLOGY & COMMON MISTAKES
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

  if (tradesLoading || accountsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>ANALYTICS & PROP FIRM</Text>
        <Text style={styles.screenSubtitle}>Diagnostic quantitatif & métriques de performance</Text>
      </View>

      {/* HORIZONTAL TABS SELECTOR (7 TABS FULL PARITY) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabItem, isActive && styles.tabItemActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Icon color={isActive ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── TAB 1 : VUE D'ENSEMBLE ── */}
      {activeTab === 'overview' && (
        <View style={styles.tabContent}>
          <Card title="KPI GLOBAUX">
            <View style={styles.grid2}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>NET P&L TOTAL</Text>
                <Text style={[styles.kpiVal, totalPnL >= 0 ? styles.greenText : styles.redText]}>
                  {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>WIN RATE</Text>
                <Text style={styles.kpiVal}>{winRate.toFixed(1)}%</Text>
              </View>
            </View>

            <View style={styles.grid2}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>PROFIT FACTOR</Text>
                <Text style={[styles.kpiVal, { color: theme.colors.primaryLight }]}>
                  {profitFactor === Infinity ? '∞' : profitFactor.toFixed(2)}
                </Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>RATIO GAIN/PERTE</Text>
                <Text style={[styles.kpiVal, { color: theme.colors.cyan }]}>
                  {avgLoss > 0 ? (avgWin / avgLoss).toFixed(2) : '1.0'}x
                </Text>
              </View>
            </View>
          </Card>

          <Card title="COURBE D'ÉQUITÉ (LIVE CHART)">
            <LineChart
              data={equityChartData}
              color={totalPnL >= 0 ? theme.colors.green : theme.colors.red}
              thickness={3}
              startFillColor={totalPnL >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}
              endFillColor="rgba(0,0,0,0.01)"
              startOpacity={0.9}
              endOpacity={0.1}
              areaChart
              height={180}
              width={screenWidth - 80}
              noOfSections={4}
              yAxisColor={theme.colors.cardBorder}
              xAxisColor={theme.colors.cardBorder}
              yAxisTextStyle={{ color: theme.colors.textMuted, fontSize: 9 }}
              xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 8 }}
            />
          </Card>
        </View>
      )}

      {/* ── TAB 2 : EQUITY & DRAWDOWN ── */}
      {activeTab === 'equity' && (
        <View style={styles.tabContent}>
          <Card title="ÉQUITÉ & RECUL DU CAPITAL">
            <View style={styles.grid2}>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>MAX DRAWDOWN</Text>
                <Text style={[styles.kpiVal, styles.redText]}>-${maxDrawdown.toFixed(2)}</Text>
              </View>
              <View style={styles.kpiBox}>
                <Text style={styles.kpiLabel}>DRAWDOWN ACTUEL</Text>
                <Text style={[styles.kpiVal, styles.redText]}>-${currentDrawdown.toFixed(2)}</Text>
              </View>
            </View>
            <View style={{ marginTop: 16 }}>
              <LineChart
                data={equityChartData}
                color={theme.colors.primaryLight}
                thickness={3}
                areaChart
                startFillColor="rgba(99, 102, 241, 0.3)"
                endFillColor="rgba(0,0,0,0.01)"
                height={180}
                width={screenWidth - 80}
                noOfSections={4}
                yAxisColor={theme.colors.cardBorder}
                xAxisColor={theme.colors.cardBorder}
                yAxisTextStyle={{ color: theme.colors.textMuted, fontSize: 9 }}
              />
            </View>
          </Card>
        </View>
      )}

      {/* ── TAB 3 : DISTRIBUTION ── */}
      {activeTab === 'distribution' && (
        <View style={styles.tabContent}>
          <Card title="RÉPARTITION WINS / LOSSES (DONUT)">
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <PieChart
                data={pieData}
                donut
                radius={70}
                innerRadius={45}
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '900' }}>{winRate.toFixed(0)}%</Text>
                    <Text style={{ color: theme.colors.textMuted, fontSize: 8 }}>WINRATE</Text>
                  </View>
                )}
              />
            </View>
          </Card>

          <Card title="DISTRIBUTION P&L PAR POSITION ($)">
            <BarChart
              data={distributionBarData}
              barWidth={12}
              noOfSections={3}
              height={140}
              width={screenWidth - 80}
              yAxisColor={theme.colors.cardBorder}
              xAxisColor={theme.colors.cardBorder}
              yAxisTextStyle={{ color: theme.colors.textMuted, fontSize: 8 }}
              xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 7 }}
            />
          </Card>
        </View>
      )}

      {/* ── TAB 4 : PAR SETUP / PAIRE / TF ── */}
      {activeTab === 'breakdown' && (
        <View style={styles.tabContent}>
          <Card title="WIN RATE & P&L PAR SETUP SMC">
            {setupBreakdown.map(s => (
              <View key={s.name} style={styles.rowBetween}>
                <View>
                  <Text style={styles.boldWhite}>{s.name}</Text>
                  <Text style={styles.subMuted}>{s.count} trades</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.boldVal, s.winRate >= 50 ? styles.greenText : styles.redText]}>
                    {s.winRate.toFixed(0)}% WR
                  </Text>
                  <Text style={[styles.subMuted, s.pnl >= 0 ? styles.greenText : styles.redText]}>
                    {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ── TAB 5 : TIMING (H/J) ── */}
      {activeTab === 'timing' && (
        <View style={styles.tabContent}>
          <Card title="PERFORMANCE PAR HEURE D'ENTRÉE (UTC)">
            <BarChart
              data={hourData}
              barWidth={14}
              noOfSections={3}
              height={150}
              width={screenWidth - 80}
              yAxisColor={theme.colors.cardBorder}
              xAxisColor={theme.colors.cardBorder}
              yAxisTextStyle={{ color: theme.colors.textMuted, fontSize: 8 }}
              xAxisLabelTextStyle={{ color: theme.colors.textMuted, fontSize: 8 }}
            />
          </Card>
        </View>
      )}

      {/* ── TAB 6 : PSYCHOLOGIE & ERREURS ── */}
      {activeTab === 'psychology' && (
        <View style={styles.tabContent}>
          <Card title="IMPACT DU MENTAL SUR LE P&L">
            {mentalBreakdown.map(mb => (
              <View key={mb.state} style={styles.rowBetween}>
                <View>
                  <Text style={styles.boldWhite}>{mb.state}</Text>
                  <Text style={styles.subMuted}>{mb.count} sessions</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.boldVal, mb.winRate >= 50 ? styles.greenText : styles.redText]}>
                    {mb.winRate.toFixed(0)}% WR
                  </Text>
                  <Text style={[styles.subMuted, mb.pnl >= 0 ? styles.greenText : styles.redText]}>
                    {mb.pnl >= 0 ? '+' : ''}${mb.pnl.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </View>
      )}

      {/* ── TAB 7 : PROP FIRM TRACKER ── */}
      {activeTab === 'propfirm' && (
        <View style={styles.tabContent}>
          <Card title="JAUGES CIRCULAIRES PROP FIRM (FTMO / FUNDEDNEXT)">
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 }}>
              <CircularGaugeRN
                percent={profitTarget > 0 ? (totalPnL / profitTarget) * 100 : 0}
                label="PROFIT TARGET"
                color={theme.colors.green}
              />
              <CircularGaugeRN
                percent={maxDrawdownLimit > 0 ? (maxDrawdown / maxDrawdownLimit) * 100 : 0}
                label="MAX DRAWDOWN"
                color={theme.colors.red}
              />
              <CircularGaugeRN
                percent={winRate}
                label="WIN RATE"
                color={theme.colors.primaryLight}
              />
            </View>
          </Card>

          <Card title="PARAMÈTRES DU CHALLENGE PROP">
            <View style={styles.rowBetween}>
              <Text style={styles.subMuted}>Objectif de Profit :</Text>
              <Text style={styles.boldWhite}>${profitTarget.toLocaleString()}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.subMuted}>Max Drawdown Limite :</Text>
              <Text style={styles.boldWhite}>${maxDrawdownLimit.toLocaleString()}</Text>
            </View>
            <View style={styles.rowBetween}>
              <Text style={styles.subMuted}>Consistency Rule :</Text>
              <Text style={styles.boldWhite}>15% Max / Jour</Text>
            </View>
          </Card>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
    fontWeight: '900',
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
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
    fontWeight: '900',
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
    fontWeight: '800',
  },
  boldVal: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  subMuted: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
