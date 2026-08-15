import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

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
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>CALENDRIER DE PERFORMANCE</Text>
          <Text style={styles.screenSubtitle}>Heatmap journalier & amplitude P&L</Text>
        </View>
      </View>

      {/* MONTH SELECTOR */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <ChevronLeft color="#ffffff" size={18} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthName.toUpperCase()}</Text>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <ChevronRight color="#ffffff" size={18} />
        </TouchableOpacity>
      </View>

      {/* DAYS HEADER */}
      <View style={styles.daysHeader}>
        {['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'].map(d => (
          <Text key={d} style={styles.dayColHeader}>{d}</Text>
        ))}
      </View>

      {/* HEATMAP GRID */}
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
              key={`day-${day}`}
              style={[
                styles.dayCell,
                isWin && styles.winCell,
                isLoss && styles.lossCell,
                isSelected && styles.selectedDayCell,
              ]}
              onPress={() => ds && setSelectedDateStr(isSelected ? null : dateStr)}
            >
              <Text style={[styles.dayNumber, (isWin || isLoss) && styles.whiteText]}>
                {day}
              </Text>
              {ds ? (
                <Text style={[styles.dayPnl, isWin ? styles.winPnlText : styles.lossPnlText]}>
                  {ds.pnl >= 0 ? '+' : ''}${Math.abs(ds.pnl) >= 1000 ? `${(ds.pnl/1000).toFixed(1)}k` : ds.pnl.toFixed(0)}
                </Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* SELECTED DATE TRADES DETAIL */}
      {selectedDateStr && (
        <Card title={`TRADES DU ${selectedDateStr}`} style={styles.detailCard}>
          {selectedTrades.length === 0 ? (
            <Text style={styles.emptyText}>Aucun trade pour ce jour.</Text>
          ) : (
            selectedTrades.map((t: Trade) => (
              <View key={t.id} style={styles.tradeDetailRow}>
                <View>
                  <Text style={styles.detailPair}>{t.pair}</Text>
                  <Text style={styles.detailSub}>{t.direction} · {t.size} Lots</Text>
                </View>
                <View style={styles.alignRight}>
                  <Text style={[styles.detailPnl, (t.pnl || 0) >= 0 ? styles.winPnlText : styles.lossPnlText]}>
                    {(t.pnl || 0) >= 0 ? '+' : ''}${t.pnl?.toFixed(2)}
                  </Text>
                  <Badge label={t.result} variant={t.result === 'TP' ? 'green' : t.result === 'SL' ? 'red' : 'neutral'} />
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
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  navBtn: {
    padding: theme.spacing.xs,
  },
  monthTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
    paddingHorizontal: 2,
  },
  dayColHeader: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    width: '13%',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: theme.spacing.lg,
  },
  emptyCell: {
    width: '13.4%',
    height: 52,
    backgroundColor: 'transparent',
  },
  dayCell: {
    width: '13.4%',
    height: 52,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    padding: 3,
    justifyContent: 'space-between',
  },
  winCell: {
    backgroundColor: 'rgba(16, 185, 129, 0.25)',
    borderColor: 'rgba(16, 185, 129, 0.6)',
  },
  lossCell: {
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
    borderColor: 'rgba(239, 68, 68, 0.6)',
  },
  selectedDayCell: {
    borderColor: theme.colors.primaryLight,
    borderWidth: 2,
  },
  dayNumber: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  whiteText: {
    color: '#ffffff',
  },
  dayPnl: {
    fontSize: 8,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    alignSelf: 'flex-end',
  },
  winPnlText: {
    color: theme.colors.greenLight,
  },
  lossPnlText: {
    color: theme.colors.redLight,
  },
  detailCard: {
    marginBottom: theme.spacing.xxl,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
  tradeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  detailPair: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  detailSub: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  detailPnl: {
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
});
