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
import { usePlaybookSetups } from '../features/playbook/usePlaybook';
import { useUIStore } from '../store/uiStore';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { PieChart, ProgressChart } from 'react-native-chart-kit';
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
      population: (closed.length - wins.length - losses.length) || 1,
      color: '#6366f1',
      legendFontColor: '#94a3b8',
      legendFontSize: 11,
    },
  ], [wins, losses, closed]);

  // 4. PAR SETUP DU PLAYBOOK (Fidèle à 100% à la version Web)
  const setupBreakdown = useMemo(() => {
    if (playbookSetups.length > 0) {
      return playbookSetups.map(s => {
        const titleLower = s.title.toLowerCase().trim();
        const sub = closed.filter(t => {
          // 1. Direct match in setup_structures
          if (t.setup_structures && t.setup_structures.some(st => st.toLowerCase().trim() === titleLower)) return true;
          // 2. Direct match in notes
          const notesLower = (t.notes || '').toLowerCase();
          if (notesLower.includes(titleLower)) return true;
          // 3. Technical confirmations check
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
        return {
          name: s.title,
          count: sub.length,
          winRate: wr,
          pnl,
        };
      });
    }

    // Default confirmations if no playbook setups created yet
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

  // 4b. PAR PAIRE / INSTRUMENT
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

  // 5. TIMING PAR HORAIRE
  const timingBreakdown = useMemo(() => {
    const hours = [8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20];
    return hours.map(h => {
      const match = closed.filter(t => new Date(t.entry_time).getHours() === h);
      const pnl = match.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return {
        label: `${h}h`,
        value: pnl,
      };
    }).filter(h => h.value !== 0);
  }, [closed]);

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

  if (tradesLoading || accountsLoading || setupsLoading) {
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

          <Card title="COURBE D'ÉQUITÉ GLOWING">
            <GlowingEquityAreaChart
              data={equityKitData.labels.map((l, i) => ({
                date: l || `#${i + 1}`,
                value: equityKitData.datasets[0].data[i] || 0,
              }))}
              height={190}
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
              <GlowingEquityAreaChart
                data={equityKitData.labels.map((l, i) => ({
                  date: l || `#${i + 1}`,
                  value: Math.min(equityKitData.datasets[0].data[i] || 0, 0),
                }))}
                height={190}
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
          {/* Par Stratégie Playbook */}
          <Card title="WIN RATE PAR STRATÉGIE PLAYBOOK">
            {setupBreakdown.map(s => (
              <View key={s.name} style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.boldWhite}>🎯 {s.name}</Text>
                  <Text style={styles.subMuted}>{s.count} trades exécutés</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.boldVal, s.winRate >= 50 ? styles.greenText : s.count > 0 ? styles.redText : { color: theme.colors.textMuted }]}>
                    {s.count > 0 ? `${s.winRate.toFixed(1)}% WR` : '—'}
                  </Text>
                  <Text style={[styles.subMuted, s.pnl >= 0 ? styles.greenText : styles.redText]}>
                    {s.count > 0 ? `${s.pnl >= 0 ? '+' : ''}$${s.pnl.toFixed(2)}` : '$0.00'}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          {/* Par Instrument / Paire */}
          <Card title="PERFORMANCE PAR INSTRUMENT">
            {pairBreakdown.map(p => (
              <View key={p.name} style={styles.rowBetween}>
                <View>
                  <Text style={styles.boldWhite}>{p.name}</Text>
                  <Text style={styles.subMuted}>{p.total} trades</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.boldVal, p.winRate >= 50 ? styles.greenText : styles.redText]}>
                    {p.winRate.toFixed(1)}% WR
                  </Text>
                  <Text style={[styles.subMuted, p.pnl >= 0 ? styles.greenText : styles.redText]}>
                    {p.pnl >= 0 ? '+' : ''}$${p.pnl.toFixed(2)}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          {/* Par Timeframe */}
          <Card title="PERFORMANCE PAR TIMEFRAME">
            {tfBreakdown.map(tf => (
              <View key={tf.name} style={styles.rowBetween}>
                <View>
                  <Text style={styles.boldWhite}>{tf.name}</Text>
                  <Text style={styles.subMuted}>{tf.total} trades</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.boldVal, tf.winRate >= 50 ? styles.greenText : styles.redText]}>
                    {tf.winRate.toFixed(1)}% WR
                  </Text>
                  <Text style={[styles.subMuted, tf.pnl >= 0 ? styles.greenText : styles.redText]}>
                    {tf.pnl >= 0 ? '+' : ''}$${tf.pnl.toFixed(2)}
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
            {timingBreakdown.length > 0 ? (
              <BicolorBarChart
                data={timingBreakdown}
                height={170}
              />
            ) : (
              <Text style={styles.emptyText}>Aucune donnée horaire disponible.</Text>
            )}
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
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
    fontStyle: 'italic',
  },
});
