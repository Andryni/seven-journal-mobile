import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Dimensions,
} from 'react-native';
import { useTrades } from '../features/trades/useTrades';
import { useAccounts } from '../features/accounts/useAccounts';
import { useDailyLock } from '../features/guard/useDailyLock';
import { usePerformanceMetrics } from '../features/dashboard/usePerformanceMetrics';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { LineChart } from 'react-native-chart-kit';
import { BicolorBarChart } from '../components/ui/BicolorBarChart';

const chartConfig = {
  backgroundColor: '#14161f',
  backgroundGradientFrom: '#181920',
  backgroundGradientTo: '#101217',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(148, 163, 184, ${opacity})`,
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
import {
  Sparkles,
  Globe,
  Flame,
  Target,
  Zap,
  TrendingDown,
  Activity,
  Brain,
  Calendar,
  History,
  ShieldAlert,
  Play,
  Square,
  CheckSquare,
  Square as UncheckedBox,
} from 'lucide-react-native';

function getMarketSessions(date: Date) {
  const utcHour = date.getUTCHours();
  return [
    { name: 'Tokyo', open: utcHour >= 0 && utcHour < 9 },
    { name: 'Londres', open: utcHour >= 7 && utcHour < 16 },
    { name: 'New York', open: utcHour >= 12 && utcHour < 21 },
    { name: 'Sydney', open: utcHour >= 21 || utcHour < 6 },
  ];
}

export const DashboardScreen: React.FC = () => {
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { isLocked, lock } = useDailyLock();
  const m = usePerformanceMetrics(trades);

  const [now, setNow] = useState(new Date());

  // Session timer state
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);

  // Pre-session checklist
  const [activeTabWidget, setActiveTabWidget] = useState<'checklist' | 'ratio'>('checklist');
  const [checklist, setChecklist] = useState([
    { id: '1', text: 'Vérifier le calendrier économique (News high impact)', done: false },
    { id: '2', text: 'Valider le biais H4/H1 & Key Levels', done: false },
    { id: '3', text: 'Respecter le Stop Loss & Max 1% de risque', done: false },
    { id: '4', text: 'Pas de revenge trading après 1 perte', done: false },
  ]);

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(i => (i.id === id ? { ...i, done: !i.done } : i)));
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      if (sessionActive && sessionStart) {
        setSessionElapsed(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionActive, sessionStart]);

  const toggleSession = () => {
    if (sessionActive) {
      setSessionActive(false);
      setSessionStart(null);
      setSessionElapsed(0);
    } else {
      setSessionActive(true);
      setSessionStart(new Date());
    }
  };

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const sessionOverLimit = sessionElapsed >= 4 * 3600;
  const marketSessions = useMemo(() => getMarketSessions(now), [now]);

  // Account Health
  const healthStatus = useMemo(() => {
    if (m.maxDrawdown > 12 || m.consistency.alert) {
      return { label: 'CRITIQUE', color: theme.colors.redLight, bg: 'rgba(239, 68, 68, 0.15)' };
    }
    if (m.maxDrawdown > 6 || m.winRate < 40) {
      return { label: 'PRUDENCE', color: theme.colors.goldLight, bg: 'rgba(245, 158, 11, 0.15)' };
    }
    return { label: 'EXCELLENT', color: theme.colors.greenLight, bg: 'rgba(16, 185, 129, 0.15)' };
  }, [m]);

  // Today trades count
  const todayTradesCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    return trades.filter(t => t.entry_time && t.entry_time.startsWith(todayStr)).length;
  }, [trades]);

  // Long vs Short distribution
  const longVsShort = useMemo(() => {
    const longs = trades.filter(t => t.direction === 'BUY').length;
    const shorts = trades.filter(t => t.direction === 'SELL').length;
    const total = longs + shorts || 1;
    return {
      longs,
      shorts,
      longPct: Math.round((longs / total) * 100),
      shortPct: Math.round((shorts / total) * 100),
    };
  }, [trades]);

  const isPositive = m.netPnL >= 0;

  if (tradesLoading || accountsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── 1. TICKER BANNER (LIVE RECENT TRADES FEED) ── */}
      {trades.length > 0 && (
        <View style={styles.tickerContainer}>
          <Text style={styles.tickerLabel}>LIVE TRADES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tickerScroll}>
            {trades.slice(0, 8).map((t: Trade) => (
              <View key={t.id} style={styles.tickerItem}>
                <Text style={styles.tickerPair}>{t.pair}</Text>
                <Text style={t.direction === 'BUY' ? styles.tickerBuy : styles.tickerSell}>
                  {t.direction}
                </Text>
                <Text style={(t.pnl || 0) >= 0 ? styles.greenText : styles.redText}>
                  {t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(0)}` : 'OPEN'}
                </Text>
                {t.r_multiple !== null && (
                  <Text style={styles.tickerR}>{t.r_multiple >= 0 ? '+' : ''}{t.r_multiple}R</Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── 2. HERO BANNER & SESSIONS OVERVIEW ── */}
      <View style={styles.heroBanner}>
        <View style={styles.heroHeader}>
          <View>
            <View style={styles.flexRow}>
              <Text style={styles.greetingTitle}>Bons trades, Trader</Text>
              <Sparkles color={theme.colors.goldLight} size={16} />
            </View>
            <Text style={styles.greetingSub}>
              {todayTradesCount === 0
                ? "Aucun trade pris aujourd'hui."
                : `${todayTradesCount} trade(s) exécuté(s) aujourd'hui.`}
            </Text>
          </View>

          <View style={[styles.healthBadge, { backgroundColor: healthStatus.bg }]}>
            <Text style={[styles.healthText, { color: healthStatus.color }]}>
              {healthStatus.label}
            </Text>
          </View>
        </View>

        {/* Market Sessions Pills & Clock */}
        <View style={styles.sessionsRow}>
          <View style={styles.sessionsWrapper}>
            <Globe color={theme.colors.textMuted} size={14} style={{ marginRight: 4 }} />
            {marketSessions.map(s => (
              <View
                key={s.name}
                style={[
                  styles.sessionPill,
                  s.open ? styles.sessionOpen : styles.sessionClosed,
                ]}
              >
                <Text
                  style={[
                    styles.sessionText,
                    s.open ? styles.sessionTextOpen : styles.sessionTextClosed,
                  ]}
                >
                  {s.name}
                </Text>
              </View>
            ))}
          </View>

          {/* Session Timer Widget */}
          <TouchableOpacity
            style={[
              styles.sessionTimerBtn,
              sessionActive ? (sessionOverLimit ? styles.timerRed : styles.timerGreen) : styles.timerNeutral,
            ]}
            onPress={toggleSession}
          >
            {sessionActive ? <Square color="#ffffff" size={12} /> : <Play color="#ffffff" size={12} />}
            <Text style={styles.sessionTimerText}>
              {sessionActive ? formatElapsed(sessionElapsed) : 'Session'}
            </Text>
            {sessionOverLimit && <Text style={styles.alertMini}>⚠️ 4H+</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 3. LOCK GUARD ALERT (SI VERROUILLÉ) ── */}
      {isLocked && (
        <View style={styles.lockBanner}>
          <ShieldAlert color={theme.colors.redLight} size={20} />
          <View style={styles.lockContent}>
            <Text style={styles.lockTitle}>SESSION QUOTIDIENNE VERROUILLÉE</Text>
            <Text style={styles.lockDesc}>
              {lock?.lock_reason || 'Seuil de perte journalière atteint. Aucun trade autorisé jusqu\'à demain.'}
            </Text>
          </View>
        </View>
      )}

      {/* ── 4. KPI SUMMARY CARDS GRID ── */}
      <View style={styles.kpiGrid}>
        {/* Net P&L */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>NET P&L TOTAL</Text>
          <Text style={[styles.kpiValueLarge, isPositive ? styles.greenText : styles.redText]}>
            {m.netPnL >= 0 ? '+' : ''}${m.netPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </Text>
          <Text style={styles.kpiSub}>{m.totalTrades} positions</Text>
        </View>

        {/* Win Rate */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>WIN RATE GLOBAL</Text>
          <Text style={styles.kpiValueLarge}>{m.winRate.toFixed(1)}%</Text>
          <Text style={styles.kpiSub}>
            <Text style={styles.greenText}>{m.winCount}W</Text> · <Text style={styles.redText}>{m.lossCount}L</Text>
          </Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        {/* Profit Factor */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>PROFIT FACTOR</Text>
          <Text style={[styles.kpiValue, { color: theme.colors.primaryLight }]}>
            {m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)}
          </Text>
          <Text style={styles.kpiSub}>G: ${m.grossProfit.toFixed(0)} · P: ${m.grossLoss.toFixed(0)}</Text>
        </View>

        {/* Ratio Gain/Perte */}
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>RATIO GAIN/PERTE</Text>
          <Text style={[styles.kpiValue, { color: theme.colors.cyan }]}>
            {m.avgLoss !== 0 ? (m.avgWin / m.avgLoss).toFixed(2) : '1.00'}x
          </Text>
          <Text style={styles.kpiSub}>+${m.avgWin.toFixed(0)} / -${m.avgLoss.toFixed(0)}</Text>
        </View>
      </View>

      {/* ── 5. COURBE D'ÉQUITÉ LIVE & P&L QUOTIDIEN BARS BICOLORE ── */}
      <Card title="COURBE D'ÉQUITÉ LIVE">
        <LineChart
          data={{
            labels: m.equityCurve.length > 0 ? m.equityCurve.slice(-6).map(e => e.date) : ['0'],
            datasets: [
              {
                data: m.equityCurve.length > 0 ? m.equityCurve.slice(-6).map(e => e.pnl) : [0],
                color: (opacity = 1) => isPositive ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`,
                strokeWidth: 3,
              },
            ],
          }}
          width={Dimensions.get('window').width - 64}
          height={180}
          chartConfig={{
            ...chartConfig,
            color: (opacity = 1) => isPositive ? `rgba(16, 185, 129, ${opacity})` : `rgba(239, 68, 68, ${opacity})`,
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: isPositive ? '#10b981' : '#ef4444',
            },
          }}
          bezier
          style={{ borderRadius: 12 }}
        />
      </Card>

      {m.dailyPnL.length > 0 && (
        <Card title="P&L QUOTIDIEN — GAINS (VERT) / PERTES (ROUGE)">
          <BicolorBarChart
            data={m.dailyPnL.slice(-7).map(d => ({
              label: d.date.slice(5),
              value: d.pnl,
            }))}
            height={160}
          />
        </Card>
      )}

      {/* ── 6. STREAK TRACKER BANNER ── */}
      {m.streak.current > 0 && (
        <View
          style={[
            styles.streakBanner,
            m.streak.type === 'win' ? styles.streakWin : styles.streakLoss,
          ]}
        >
          <Text style={styles.streakEmoji}>{m.streak.type === 'win' ? '🔥' : '❄️'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakTitle}>
              {m.streak.type === 'win' ? 'WIN STREAK' : 'LOSS STREAK'}
            </Text>
            <Text style={[styles.streakCount, m.streak.type === 'win' ? styles.goldText : styles.redText]}>
              {m.streak.current} <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>jours consécutifs</Text>
            </Text>
          </View>
          {m.streak.best > 0 && (
            <Badge label={`RECORD: ${m.streak.best}J`} variant="gold" />
          )}
        </View>
      )}

      {/* ── 6. MULTI-TAB WIDGET (CHECKLIST & LONG VS SHORT) ── */}
      <Card title="DISCIPLINE & RATIO DE SESSION">
        <View style={styles.tabHeaders}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTabWidget === 'checklist' && styles.tabBtnActive]}
            onPress={() => setActiveTabWidget('checklist')}
          >
            <Text style={[styles.tabBtnText, activeTabWidget === 'checklist' && styles.tabBtnTextActive]}>
              Checklist Pré-Session
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTabWidget === 'ratio' && styles.tabBtnActive]}
            onPress={() => setActiveTabWidget('ratio')}
          >
            <Text style={[styles.tabBtnText, activeTabWidget === 'ratio' && styles.tabBtnTextActive]}>
              Long vs Short
            </Text>
          </TouchableOpacity>
        </View>

        {activeTabWidget === 'checklist' ? (
          <View style={styles.checklistGroup}>
            {checklist.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.checkItem}
                onPress={() => toggleChecklistItem(item.id)}
              >
                {item.done ? (
                  <CheckSquare color={theme.colors.primaryLight} size={18} />
                ) : (
                  <UncheckedBox color={theme.colors.textMuted} size={18} />
                )}
                <Text style={[styles.checkLabel, item.done && styles.checkDone]}>
                  {item.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={styles.ratioContainer}>
            <View style={styles.ratioHeader}>
              <Text style={styles.greenText}>BUY / LONG ({longVsShort.longs})</Text>
              <Text style={{ color: theme.colors.primaryLight }}>SELL / SHORT ({longVsShort.shorts})</Text>
            </View>
            <View style={styles.ratioTrack}>
              <View style={[styles.ratioBarLong, { width: `${longVsShort.longPct}%` }]} />
              <View style={[styles.ratioBarShort, { width: `${longVsShort.shortPct}%` }]} />
            </View>
            <View style={styles.ratioHeader}>
              <Text style={styles.ratioSub}>{longVsShort.longPct}% Longs</Text>
              <Text style={styles.ratioSub}>{longVsShort.shortPct}% Shorts</Text>
            </View>
          </View>
        )}
      </Card>

      {/* ── 7. DETAILED METRICS BREAKDOWN ── */}
      <Card title="DÉTAIL DES MÉTRIQUES FINANCIÈRES">
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Meilleur Trade</Text>
          <Text style={[styles.breakdownVal, styles.greenText]}>
            {m.bestTrade?.pnl ? `+$${m.bestTrade.pnl.toFixed(2)}` : '—'}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Pire Trade</Text>
          <Text style={[styles.breakdownVal, styles.redText]}>
            {m.worstTrade?.pnl ? `$${m.worstTrade.pnl.toFixed(2)}` : '—'}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>R-Multiple Moyen</Text>
          <Text style={[styles.breakdownVal, m.avgRMultiple >= 0 ? styles.greenText : styles.redText]}>
            {m.avgRMultiple >= 0 ? '+' : ''}{m.avgRMultiple.toFixed(2)} R
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Consistency Score</Text>
          <Text style={[styles.breakdownVal, m.consistency.alert ? styles.redText : styles.greenText]}>
            {m.consistency.score.toFixed(1)}% {m.consistency.alert ? '⚠️ >15%' : '✓ Conforme'}
          </Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Max Drawdown</Text>
          <Text style={[styles.breakdownVal, styles.redText]}>
            -${m.maxDrawdown.toFixed(2)}
          </Text>
        </View>
      </Card>

      {/* ── 8. RECENT TRADES SECTION ── */}
      <Card title="DERNIERS TRADES EXÉCUTÉS">
        {m.recentTrades.length === 0 ? (
          <Text style={styles.emptyText}>Aucun trade récent enregistré.</Text>
        ) : (
          m.recentTrades.map((t: Trade) => (
            <View key={t.id} style={styles.recentRow}>
              <View>
                <View style={styles.flexRow}>
                  <Text style={styles.recentPair}>{t.pair}</Text>
                  <Badge label={t.direction} variant={t.direction === 'BUY' ? 'blue' : 'gold'} />
                </View>
                <Text style={styles.recentDate}>
                  {new Date(t.entry_time).toLocaleDateString('fr-FR')} {new Date(t.entry_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <View style={styles.alignRight}>
                <Text style={[styles.recentPnl, (t.pnl || 0) >= 0 ? styles.greenText : styles.redText]}>
                  {t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : 'OPEN'}
                </Text>
                <Badge label={t.result} variant={t.result === 'TP' ? 'green' : t.result === 'SL' ? 'red' : 'neutral'} />
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 22, 31, 0.95)',
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    marginBottom: theme.spacing.md,
  },
  tickerLabel: {
    color: theme.colors.primaryLight,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginRight: theme.spacing.sm,
  },
  tickerScroll: {
    flex: 1,
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    borderRightColor: theme.colors.cardBorder,
    borderRightWidth: 1,
  },
  tickerPair: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  tickerBuy: {
    color: theme.colors.primaryLight,
    fontSize: 9,
    fontWeight: '800',
  },
  tickerSell: {
    color: theme.colors.goldLight,
    fontSize: 9,
    fontWeight: '800',
  },
  tickerR: {
    color: theme.colors.goldLight,
    fontSize: 10,
    fontWeight: '800',
  },
  heroBanner: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  greetingTitle: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '900',
    marginRight: 6,
  },
  greetingSub: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  healthBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  healthText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  sessionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sessionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  sessionPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  sessionOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  sessionClosed: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  sessionText: {
    fontSize: 9,
    fontWeight: '800',
  },
  sessionTextOpen: {
    color: theme.colors.greenLight,
  },
  sessionTextClosed: {
    color: theme.colors.textMuted,
  },
  sessionTimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
  },
  timerGreen: {
    backgroundColor: theme.colors.primary,
  },
  timerRed: {
    backgroundColor: theme.colors.red,
  },
  timerNeutral: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
  },
  sessionTimerText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  alertMini: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '900',
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  lockContent: {
    flex: 1,
  },
  lockTitle: {
    color: theme.colors.redLight,
    fontSize: 12,
    fontWeight: '900',
  },
  lockDesc: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  kpiLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kpiValueLarge: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  kpiValue: {
    fontSize: 17,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  kpiSub: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 4,
  },
  greenText: {
    color: theme.colors.greenLight,
  },
  redText: {
    color: theme.colors.redLight,
  },
  goldText: {
    color: theme.colors.goldLight,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  streakWin: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  streakLoss: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  streakEmoji: {
    fontSize: 24,
  },
  streakTitle: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  streakCount: {
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  tabHeaders: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tabBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  tabBtnText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tabBtnTextActive: {
    color: theme.colors.primaryLight,
  },
  checklistGroup: {
    gap: theme.spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 4,
  },
  checkLabel: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    flex: 1,
  },
  checkDone: {
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  ratioContainer: {
    paddingVertical: theme.spacing.xs,
  },
  ratioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ratioTrack: {
    height: 10,
    backgroundColor: theme.colors.surface,
    borderRadius: 5,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 6,
  },
  ratioBarLong: {
    backgroundColor: theme.colors.green,
    height: '100%',
  },
  ratioBarShort: {
    backgroundColor: theme.colors.primary,
    height: '100%',
  },
  ratioSub: {
    color: theme.colors.textMuted,
    fontSize: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  breakdownLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
  },
  breakdownVal: {
    fontSize: 13,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  recentPair: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginRight: theme.spacing.sm,
  },
  recentDate: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  recentPnl: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alignRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
});
