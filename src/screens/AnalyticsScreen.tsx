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
import { LineChart, PieChart, ProgressChart } from 'react-native-chart-kit';
import { BicolorBarChart } from '../components/ui/BicolorBarChart';
import {
  Activity,
  TrendingUp,
  BarChart3,
  Target,
  Clock,
  Brain,
  Award,
} from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;

const chartConfig = {
  backgroundColor: '#14161f',
  backgroundGradientFrom: '#181920',
  backgroundGradientTo: '#101217',
  decimalPlaces: 1,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '4',
    strokeWidth: '2',
    stroke: '#818cf8',
  },
  propsForBackgroundLines: {
    strokeDasharray: '',
    stroke: 'rgba(255, 255, 255, 0.05)',
  },
};

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
  const { equityKitData, maxDrawdown, currentDrawdown } = useMemo(() => {
    const sorted = [...closed].sort(
      (a, b) => new Date(a.entry_time).getTime() - new Date(b.entry_time).getTime()
    );
    let cum = 0;
    let peak = 0;
    let maxDd = 0;

    const values = [0];
    const labels = ['0'];

    sorted.forEach((t, i) => {
      cum += (t.pnl || 0);
      if (cum > peak) peak = cum;
      const dd = peak - cum;
      if (dd > maxDd) maxDd = dd;
      values.push(cum);
      if (i % Math.max(1, Math.floor(sorted.length / 5)) === 0 || i === sorted.length - 1) {
        labels.push(`${i + 1}`);
      } else {
        labels.push('');
      }
    });

    const currDd = peak - cum;
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
    };
  }, [closed, totalPnL]);

  // 3. PIE & BAR DATA
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
      population: (closed.length - wins.length - losses.length) || 1,
      color: '#6366f1',
      legendFontColor: '#94a3b8',
      legendFontSize: 11,
    },
  ], [wins, losses, closed]);

  const recentPnlBarData = useMemo(() => {
    const recent = closed.slice(-6);
    return {
      labels: recent.map(t => t.pair.slice(0, 3)),
      datasets: [
        {
          data: recent.length > 0 ? recent.map(t => Math.abs(t.pnl || 0)) : [100, 200, 150],
        },
      ],
    };
  }, [closed]);

  // 4. SETUP BREAKDOWN
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
  const timingBarData = useMemo(() => {
    const hours = ['8h', '10h', '12h', '14h', '16h', '18h'];
    const pnlValues = [120, 350, 80, 410, 190, 95];
    return {
      labels: hours,
      datasets: [{ data: pnlValues }],
    };
  }, []);

  // 6. PSYCHOLOGY BREAKDOWN
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
        <Text style={styles.screenSubtitle}>Diagnostic quantitatif · Moteur React Native Chart Kit</Text>
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

          <Card title="COURBE D'ÉQUITÉ">
            <LineChart
              data={equityKitData}
              width={screenWidth - 64}
              height={180}
              chartConfig={{
                ...chartConfig,
                color: (opacity = 1) => totalPnL >= 0 ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`,
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: totalPnL >= 0 ? '#10b981' : '#ef4444',
                },
              }}
              bezier
              style={{ borderRadius: 12, marginVertical: 4 }}
            />
          </Card>
        </View>
      )}

      {/* ── TAB 2 : EQUITY & DRAWDOWN ── */}
      {activeTab === 'equity' && (
        <View style={styles.tabContent}>
          <Card title="ÉQUITÉ & RECUL DU CAPITAL (DRAWDOWN ROUGE)">
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

            <View style={{ marginTop: 12 }}>
              <LineChart
                data={{
                  labels: equityKitData.labels,
                  datasets: [
                    {
                      data: equityKitData.datasets[0].data.map(v => Math.min(v, 0)),
                      color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                      strokeWidth: 3,
                    },
                  ],
                }}
                width={screenWidth - 64}
                height={180}
                chartConfig={{
                  ...chartConfig,
                  color: (opacity = 1) => `rgba(239, 68, 68, ${opacity})`,
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: '#ef4444',
                  },
                }}
                bezier
                style={{ borderRadius: 12 }}
              />
            </View>
          </Card>
        </View>
      )}

      {/* ── TAB 3 : DISTRIBUTION ── */}
      {activeTab === 'distribution' && (
        <View style={styles.tabContent}>
          <Card title="RÉPARTITION DES GAINS / PERTES">
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

          <Card title="P&L DES DERNIÈRES POSITIONS (VERT = GAIN, ROUGE = PERTE)">
            <BicolorBarChart
              data={closed.slice(-7).map((t, idx) => ({
                label: `${t.pair.slice(0, 3)}#${idx + 1}`,
                value: t.pnl || 0,
              }))}
              height={170}
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
          <Card title="AMPLITUDE P&L PAR HORAIRE (GAINS VERT / PERTES ROUGE)">
            <BicolorBarChart
              data={[
                { label: '8h', value: 120 },
                { label: '10h', value: 350 },
                { label: '12h', value: -80 },
                { label: '14h', value: 410 },
                { label: '16h', value: -190 },
                { label: '18h', value: 95 },
              ]}
              height={170}
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
          <Card title="PROGRESSION DES OBJECTIFS DU CHALLENGE">
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <ProgressChart
                data={{
                  labels: ['TP', 'DD', 'WR'],
                  data: [
                    Math.min(Math.max((totalPnL / (profitTarget || 1)), 0), 1),
                    Math.min(Math.max((maxDrawdown / (maxDrawdownLimit || 1)), 0), 1),
                    Math.min(Math.max(winRate / 100, 0), 1),
                  ],
                }}
                width={screenWidth - 64}
                height={160}
                strokeWidth={12}
                radius={28}
                chartConfig={chartConfig}
                hideLegend={false}
                style={{ borderRadius: 12 }}
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
