import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, TrendingUp, TrendingDown } from 'lucide-react-native';

export const CalendarScreen: React.FC = () => {
  const { trades, isLoading } = useTrades();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  // Build calendar map (Local Date keys YYYY-MM-DD)
  const tradesByDate = useMemo(() => {
    const map: Record<string, { pnl: number; count: number; wins: number; trades: Trade[] }> = {};
    trades.forEach((t: Trade) => {
      const timeStr = t.entry_time || t.exit_time;
      if (timeStr) {
        const d = new Date(timeStr);
        if (!isNaN(d.getTime())) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!map[dateStr]) map[dateStr] = { pnl: 0, count: 0, wins: 0, trades: [] };
          map[dateStr].pnl += t.pnl || 0;
          map[dateStr].count += 1;
          if ((t.pnl || 0) > 0) map[dateStr].wins += 1;
          map[dateStr].trades.push(t);
        }
      }
    });
    return map;
  }, [trades]);

  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const adjustedStartDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const monthName = currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  // Monthly stats
  const monthlyStats = useMemo(() => {
    let monthPnl = 0;
    let greenDays = 0;
    let redDays = 0;
    let totalTradesMonth = 0;

    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const d = tradesByDate[dateStr];
      if (d) {
        monthPnl += d.pnl;
        totalTradesMonth += d.count;
        if (d.pnl > 0) greenDays++;
        if (d.pnl < 0) redDays++;
      }
    }
    return { monthPnl, greenDays, redDays, totalTradesMonth };
  }, [tradesByDate, year, month, totalDays]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  const selectedTrades = selectedDateStr ? (tradesByDate[selectedDateStr]?.trades || []) : [];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── HEADER ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>CALENDRIER QUANTITATIF</Text>
          <Text style={styles.screenSubtitle}>Heatmap journalier & amplitude P&L</Text>
        </View>
      </View>

      {/* ── MONTHLY HERO METRICS ── */}
      <View style={styles.heroMonthCard}>
        <LinearGradient
          colors={['#141724', '#0f111a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroMonthGrad}
        >
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroMonthLabel}>{monthName.toUpperCase()}</Text>
              <Text style={[styles.heroMonthPnl, monthlyStats.monthPnl >= 0 ? styles.greenText : styles.redText]}>
                {monthlyStats.monthPnl >= 0 ? '+' : ''}${monthlyStats.monthPnl.toFixed(2)}
              </Text>
            </View>

            <View style={styles.daysBreakdown}>
              <View style={styles.dayStatBox}>
                <Text style={styles.greenDayText}>+{monthlyStats.greenDays}J</Text>
                <Text style={styles.statSubText}>GAINS</Text>
              </View>
              <View style={styles.dayStatBox}>
                <Text style={styles.redDayText}>-{monthlyStats.redDays}J</Text>
                <Text style={styles.statSubText}>PERTES</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── MONTH SELECTOR NAVIGATION ── */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
          <ChevronLeft color="#ffffff" size={18} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthName.toUpperCase()}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.7}>
          <ChevronRight color="#ffffff" size={18} />
        </TouchableOpacity>
      </View>

      {/* ── DAYS HEADER ── */}
      <View style={styles.daysHeader}>
        {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(d => (
          <Text key={d} style={styles.dayColHeader}>{d}</Text>
        ))}
      </View>

      {/* ── HEATMAP GRID ── */}
      <View style={styles.grid}>
        {Array.from({ length: adjustedStartDay }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.emptyCell} />
        ))}

        {Array.from({ length: totalDays }).map((_, i) => {
          const day = i + 1;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const ds = tradesByDate[dateStr];
          const isSelected = selectedDateStr === dateStr;

          const isWin = ds && ds.pnl > 0;
          const isLoss = ds && ds.pnl < 0;

          return (
            <TouchableOpacity
              key={day}
              style={[
                styles.dayCell,
                isWin && styles.dayCellWin,
                isLoss && styles.dayCellLoss,
                isSelected && styles.dayCellSelected,
              ]}
              onPress={() => setSelectedDateStr(dateStr)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dayNum, isSelected && styles.dayNumSelected]}>
                {day}
              </Text>
              {ds && (
                <Text
                  style={[
                    styles.dayPnl,
                    isWin && styles.greenText,
                    isLoss && styles.redText,
                  ]}
                  numberOfLines={1}
                >
                  {isWin ? '+' : ''}${Math.abs(ds.pnl) >= 1000 ? `${(ds.pnl / 1000).toFixed(1)}k` : ds.pnl.toFixed(0)}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── SELECTED DATE DETAILS ── */}
      {selectedDateStr && (
        <Card
          title={`TRADES DU ${new Date(selectedDateStr).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}`}
          badge={tradesByDate[selectedDateStr] ? `${tradesByDate[selectedDateStr].trades.length} POSITIONS` : 'AUCUN TRADE'}
          badgeVariant={tradesByDate[selectedDateStr]?.pnl! >= 0 ? 'green' : 'red'}
        >
          {selectedTrades.length === 0 ? (
            <Text style={styles.emptyText}>Aucun trade exécuté ce jour-là.</Text>
          ) : (
            selectedTrades.map((t: Trade) => (
              <View key={t.id} style={styles.tradeRow}>
                <View>
                  <View style={styles.flexRow}>
                    <Text style={styles.tradePair}>{t.pair}</Text>
                    <Badge label={t.direction} variant={t.direction === 'BUY' ? 'green' : 'blue'} size="sm" />
                  </View>
                  <Text style={styles.tradeTime}>
                    {new Date(t.entry_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.tradePnl, (t.pnl || 0) >= 0 ? styles.greenText : styles.redText]}>
                    {t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : 'OPEN'}
                  </Text>
                  <Badge label={t.result} variant={t.result === 'TP' ? 'green' : t.result === 'SL' ? 'red' : 'neutral'} size="sm" />
                </View>
              </View>
            ))
          )}
        </Card>
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
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  heroMonthCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: theme.spacing.md,
  },
  heroMonthGrad: {
    padding: theme.spacing.lg,
  },
  heroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroMonthLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heroMonthPnl: {
    fontSize: 22,
    fontWeight: '900',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  daysBreakdown: {
    flexDirection: 'row',
    gap: 8,
  },
  dayStatBox: {
    backgroundColor: '#181b26',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  greenDayText: {
    color: theme.colors.greenLight,
    fontSize: 12,
    fontWeight: '900',
  },
  redDayText: {
    color: theme.colors.redLight,
    fontSize: 12,
    fontWeight: '900',
  },
  statSubText: {
    color: theme.colors.textMuted,
    fontSize: 8,
    fontWeight: '700',
    marginTop: 2,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#12141c',
    borderRadius: theme.borderRadius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  navBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  monthTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  dayColHeader: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: 9,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: theme.spacing.lg,
    gap: 4,
  },
  emptyCell: {
    width: '13.5%',
    aspectRatio: 1,
  },
  dayCell: {
    width: '13.5%',
    aspectRatio: 1,
    backgroundColor: '#12141c',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCellWin: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  dayCellLoss: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  dayCellSelected: {
    borderColor: '#ffffff',
    borderWidth: 1.5,
  },
  dayNum: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
  },
  dayNumSelected: {
    color: '#ffffff',
  },
  dayPnl: {
    fontSize: 8,
    fontWeight: '900',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tradePair: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  tradeTime: {
    color: theme.colors.textMuted,
    fontSize: 9,
    marginTop: 2,
  },
  tradePnl: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 12,
  },
  greenText: { color: theme.colors.greenLight },
  redText: { color: theme.colors.redLight },
});
