import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTrades } from '../features/trades/useTrades';
import { useAccounts } from '../features/accounts/useAccounts';
import { useDailyLock } from '../features/guard/useDailyLock';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Play, Square, AlertTriangle, ShieldCheck, ShieldAlert, TrendingUp, CheckSquare, Square as UncheckedBox } from 'lucide-react-native';
import type { Trade } from '../types/domain';

export const DashboardScreen: React.FC = () => {
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { isLocked, lock } = useDailyLock();

  // Session Timer State
  const [timerRunning, setTimerRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // Pre-session checklist items
  const [checklist, setChecklist] = useState([
    { id: 'bias', label: 'Biais HTF vérifié (D1/H4)', done: false },
    { id: 'news', label: 'Calendrier économique (News) vérifié', done: false },
    { id: 'risk', label: 'Risque max par trade défini (1% ou montant fixe)', done: false },
    { id: 'mental', label: 'État mental calme (Pas de FOMO / Revenge)', done: false },
  ]);

  const toggleChecklistItem = (id: string) => {
    setChecklist(prev => prev.map(item => item.id === id ? { ...item, done: !item.done } : item));
  };

  useEffect(() => {
    let interval: any = null;
    if (timerRunning) {
      interval = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [timerRunning]);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // KPI Calculations
  const closedTrades = trades.filter((t: Trade) => t.pnl !== null);
  const totalPnl = closedTrades.reduce((acc: number, t: Trade) => acc + (t.pnl || 0), 0);
  const winningTrades = closedTrades.filter((t: Trade) => (t.pnl || 0) > 0);
  const winRate = closedTrades.length > 0 ? ((winningTrades.length / closedTrades.length) * 100).toFixed(1) : '0.0';
  const totalAccountsBalance = accounts.reduce((acc: number, a) => acc + (a.balance || 0), 0);

  if (tradesLoading || accountsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HEADER FINTECH */}
      <View style={styles.header}>
        <View>
          <Text style={styles.brandTitle}>SEVEN TERMINAL</Text>
          <Text style={styles.brandSubtitle}>DASHBOARD DE PERFORMANCE</Text>
        </View>
        <Badge
          label={isLocked ? "LOCK GUARD ACTIF" : "SESSION LIBRE"}
          variant={isLocked ? "red" : "green"}
        />
      </View>

      {/* LOCK GUARD BANNER SI VERROUILLÉ */}
      {isLocked ? (
        <View style={styles.lockBanner}>
          <ShieldAlert color={theme.colors.redLight} size={20} />
          <View style={styles.lockContent}>
            <Text style={styles.lockTitle}>SESSION QUOTIDIENNE VERROUILLÉE</Text>
            <Text style={styles.lockDesc}>
              {lock?.lock_reason || 'Seuil de perte journalière atteint. Aucun trade autorisé jusqu\'à demain.'}
            </Text>
          </View>
        </View>
      ) : null}

      {/* SESSION TIMER & FOCUS WIDGET */}
      <Card title="SESSION TIMER & FOCUS">
        <View style={styles.timerContainer}>
          <Text style={styles.timerDisplay}>{formatTimer(seconds)}</Text>
          {seconds >= 14400 ? (
            <View style={styles.overSessionBadge}>
              <AlertTriangle color={theme.colors.goldLight} size={14} />
              <Text style={styles.overSessionText}>Over-session (+4h) : Fatigue détectée</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={[styles.timerButton, timerRunning ? styles.stopBtn : styles.startBtn]}
            onPress={() => setTimerRunning(!timerRunning)}
          >
            {timerRunning ? <Square color="#ffffff" size={16} /> : <Play color="#ffffff" size={16} />}
            <Text style={styles.timerBtnText}>
              {timerRunning ? "ARRÊTER LA SESSION" : "DÉMARRER LA SESSION"}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* KPI METRICS GRID */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>SOLDE GLOBAL</Text>
          <Text style={styles.kpiValue}>${totalAccountsBalance.toLocaleString()}</Text>
          <Text style={styles.kpiSub}>{accounts.length} COMPTE(S) ACTIF(S)</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>P&L TOTAL NET</Text>
          <Text style={[styles.kpiValue, totalPnl >= 0 ? styles.greenText : styles.redText]}>
            {totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}
          </Text>
          <Text style={styles.kpiSub}>{closedTrades.length} POSITIONS CLOSES</Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>WIN RATE GLOBAL</Text>
          <Text style={styles.kpiValue}>{winRate}%</Text>
          <Text style={styles.kpiSub}>{winningTrades.length} WINS / {closedTrades.length - winningTrades.length} LOSSES</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>LOCK STATUS</Text>
          <Text style={[styles.kpiValue, isLocked ? styles.redText : styles.greenText]}>
            {isLocked ? "LOCKED" : "ACTIVE"}
          </Text>
          <Text style={styles.kpiSub}>Garde-fou automatique</Text>
        </View>
      </View>

      {/* PRE-SESSION DISCIPLINE CHECKLIST */}
      <Card title="CHECKLIST DE DISCIPLINE PRÉ-SESSION">
        <View style={styles.checklistContainer}>
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
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  lockContent: {
    flex: 1,
  },
  lockTitle: {
    color: theme.colors.redLight,
    fontSize: 12,
    fontWeight: '800',
  },
  lockDesc: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  timerContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
  },
  timerDisplay: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    marginBottom: theme.spacing.md,
  },
  overSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.md,
  },
  overSessionText: {
    color: theme.colors.goldLight,
    fontSize: 11,
    fontWeight: '700',
  },
  timerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    height: 44,
    borderRadius: theme.borderRadius.md,
  },
  startBtn: {
    backgroundColor: theme.colors.primary,
  },
  stopBtn: {
    backgroundColor: theme.colors.red,
  },
  timerBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kpiValue: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  kpiSub: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 4,
  },
  greenText: {
    color: theme.colors.greenLight,
  },
  redText: {
    color: theme.colors.redLight,
  },
  checklistContainer: {
    gap: theme.spacing.sm,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: 6,
  },
  checkLabel: {
    color: theme.colors.textPrimary,
    fontSize: 12,
  },
  checkDone: {
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
});
