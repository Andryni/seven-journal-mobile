import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useTrades } from '../features/trades/useTrades';
import { useAccounts } from '../features/accounts/useAccounts';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { calculateConsistencyScore } from '../utils/financials';
import { Target, TrendingUp, AlertTriangle, Award } from 'lucide-react-native';

export const AnalyticsScreen: React.FC = () => {
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();

  const closedTrades = trades.filter((t: Trade) => t.pnl !== null);

  // Consistency Score
  const consistency = useMemo(() => {
    return calculateConsistencyScore(
      closedTrades.map((t: Trade) => ({ pnl: t.pnl || 0, exit_time: t.exit_time || t.entry_time }))
    );
  }, [closedTrades]);

  // Win / Loss metrics
  const wins = closedTrades.filter((t: Trade) => (t.pnl || 0) > 0);
  const losses = closedTrades.filter((t: Trade) => (t.pnl || 0) < 0);
  const winRate = closedTrades.length > 0 ? ((wins.length / closedTrades.length) * 100).toFixed(1) : '0';

  const totalWinAmount = wins.reduce((acc: number, t: Trade) => acc + (t.pnl || 0), 0);
  const totalLossAmount = Math.abs(losses.reduce((acc: number, t: Trade) => acc + (t.pnl || 0), 0));
  const profitFactor = totalLossAmount > 0 ? (totalWinAmount / totalLossAmount).toFixed(2) : 'N/A';

  const avgWin = wins.length > 0 ? (totalWinAmount / wins.length).toFixed(2) : '0';
  const avgLoss = losses.length > 0 ? (totalLossAmount / losses.length).toFixed(2) : '0';

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number }> = {};
    closedTrades.forEach((t: Trade) => {
      const timeStr = t.entry_time || t.exit_time;
      if (timeStr) {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          const monthKey = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }).toUpperCase();
          if (!map[monthKey]) map[monthKey] = { pnl: 0, count: 0, wins: 0 };
          map[monthKey].pnl += t.pnl || 0;
          map[monthKey].count += 1;
          if ((t.pnl || 0) > 0) map[monthKey].wins += 1;
        }
      }
    });
    return Object.entries(map).map(([month, data]) => ({ month, ...data }));
  }, [closedTrades]);

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
        <Text style={styles.screenSubtitle}>Mesures quantitatives & règles de consistance</Text>
      </View>

      {/* PROP FIRM CONSISTENCY SCORE WIDGET */}
      <Card title="SCORE DE CONSISTANCE (PROP FIRMS)">
        <View style={styles.scoreRow}>
          <View>
            <Text style={styles.scoreValue}>{consistency.score}%</Text>
            <Text style={styles.scoreDesc}>
              {consistency.alert 
                ? '⚠️ Critique : Un seul jour dépasse 15% du profit total.' 
                : '✅ Conforme aux standards FTMO & FundedNext (<=15%).'}
            </Text>
          </View>
          <Badge
            label={consistency.alert ? "ALERTE > 15%" : "CONFORME"}
            variant={consistency.alert ? "red" : "green"}
          />
        </View>
      </Card>

      {/* FINANCIAL METRICS GRID */}
      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>PROFIT FACTOR</Text>
          <Text style={styles.kpiValue}>{profitFactor}</Text>
          <Text style={styles.kpiSub}>Gains bruts / Pertes brutes</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>WIN RATE GLOBAL</Text>
          <Text style={styles.kpiValue}>{winRate}%</Text>
          <Text style={styles.kpiSub}>{wins.length}W / {losses.length}L</Text>
        </View>
      </View>

      <View style={styles.kpiGrid}>
        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>GAIN MOYEN / WIN</Text>
          <Text style={[styles.kpiValue, styles.greenText]}>+${avgWin}</Text>
          <Text style={styles.kpiSub}>Par position gagnante</Text>
        </View>

        <View style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>PERTE MOYENNE / LOSS</Text>
          <Text style={[styles.kpiValue, styles.redText]}>-${avgLoss}</Text>
          <Text style={styles.kpiSub}>Par position perdante</Text>
        </View>
      </View>

      {/* PERFORMANCE MENSUELLE */}
      <Card title="PERFORMANCE MENSUELLE (P&L)">
        {monthlyData.length === 0 ? (
          <Text style={styles.emptyText}>Aucun historique mensuel.</Text>
        ) : (
          monthlyData.map(m => (
            <View key={m.month} style={styles.monthRow}>
              <View>
                <Text style={styles.monthName}>{m.month}</Text>
                <Text style={styles.monthCount}>{m.count} trades · {((m.wins / m.count) * 100).toFixed(0)}% WR</Text>
              </View>
              <Text style={[styles.monthPnl, m.pnl >= 0 ? styles.greenText : styles.redText]}>
                {m.pnl >= 0 ? '+' : ''}${m.pnl.toFixed(2)}
              </Text>
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
    paddingTop: theme.spacing.xl,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: theme.spacing.lg,
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
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  scoreDesc: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 4,
    maxWidth: 220,
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
  monthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  monthName: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  monthCount: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  monthPnl: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
});
