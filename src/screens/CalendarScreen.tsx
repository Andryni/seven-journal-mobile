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
import { LinearGradient } from 'expo-linear-gradient';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { formatCurrency } from '../utils/formatCurrency';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { localeFor, useT } from '../i18n';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;
const CALENDAR_PADDING = 16; // horizontal padding inside the calendar frame
const CELL_GAP = 3;
const COLS = 7;
const CALENDAR_SCREEN_PADDING = 16; // theme.spacing.lg
const calendarInnerWidth = screenWidth - (CALENDAR_SCREEN_PADDING * 2) - (CALENDAR_PADDING * 2);
const CELL_SIZE = Math.floor((calendarInnerWidth - CELL_GAP * (COLS - 1)) / COLS);

export const CalendarScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
          if (t.result === 'TP' || (t.result !== 'SL' && t.result !== 'BE' && (t.pnl || 0) > 0)) map[dateStr].wins += 1;
          map[dateStr].trades.push(t);
        }
      }
    });
    return map;
  }, [trades]);

  const totalDays = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  const adjustedStartDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const monthName = currentDate.toLocaleDateString(localeFor(lang), { month: 'long', year: 'numeric' });

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

  // Calculate total weeks for grid rows
  const totalCells = adjustedStartDay + totalDays;
  const totalRows = Math.ceil(totalCells / 7);

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
        <Text style={styles.screenTitle}>{t('screenTitleCalendar')}</Text>
        <Text style={styles.screenSubtitle}>{t('screenSubtitleCalendar')}</Text>
      </View>

      {/* ── MONTHLY HERO METRICS ── */}
      <View style={styles.heroMonthCard}>
        <LinearGradient
          colors={[theme.colors.surface, theme.colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroMonthGrad}
        >
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroMonthLabel}>{monthName.toUpperCase()}</Text>
              <Text style={[styles.heroMonthPnl, monthlyStats.monthPnl >= 0 ? styles.greenText : styles.redText]}>
                {formatCurrency(monthlyStats.monthPnl)}
              </Text>
            </View>

            <View style={styles.daysBreakdown}>
              <View style={styles.dayStatBox}>
                <Text style={styles.greenDayText}>+{monthlyStats.greenDays}{t('calDaySuffix')}</Text>
                <Text style={styles.statSubText}>{t('gains')}</Text>
              </View>
              <View style={styles.dayStatBox}>
                <Text style={styles.redDayText}>-{monthlyStats.redDays}{t('calDaySuffix')}</Text>
                <Text style={styles.statSubText}>{t('losses')}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* ── FRAMED CALENDAR SECTION ── */}
      <View style={styles.calendarFrame}>
        {/* Month Navigation (inside frame) */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            onPress={prevMonth}
            style={styles.navBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('a11yPrevMonth')}
          >
            <ChevronLeft color={theme.colors.textPrimary} size={16} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthName.toUpperCase()}</Text>
          <TouchableOpacity
            onPress={nextMonth}
            style={styles.navBtn}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('a11yNextMonth')}
          >
            <ChevronRight color={theme.colors.textPrimary} size={16} />
          </TouchableOpacity>
        </View>

        {/* Separator */}
        <View style={styles.separator} />

        {/* Days Header */}
        <View style={styles.daysHeader}>
          {[t('calWeekdayMon'), t('calWeekdayTue'), t('calWeekdayWed'), t('calWeekdayThu'), t('calWeekdayFri'), t('calWeekdaySat'), t('calWeekdaySun')].map(d => (
            <View key={d} style={[styles.dayColHeaderBox, { width: CELL_SIZE }]}>
              <Text style={styles.dayColHeaderText}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Heatmap Grid — Row by Row for perfect alignment */}
        {Array.from({ length: totalRows }).map((_, rowIdx) => (
          <View key={rowIdx} style={styles.gridRow}>
            {Array.from({ length: 7 }).map((__, colIdx) => {
              const cellIndex = rowIdx * 7 + colIdx;
              const dayNum = cellIndex - adjustedStartDay + 1;

              // Empty cell (before month start or after month end)
              if (dayNum < 1 || dayNum > totalDays) {
                return <View key={colIdx} style={[styles.emptyCell, { width: CELL_SIZE, height: CELL_SIZE }]} />;
              }

              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const ds = tradesByDate[dateStr];
              const isSelected = selectedDateStr === dateStr;
              const isWin = ds && ds.pnl > 0;
              const isLoss = ds && ds.pnl < 0;
              const isToday =
                dayNum === new Date().getDate() &&
                month === new Date().getMonth() &&
                year === new Date().getFullYear();

              return (
                <TouchableOpacity
                  key={colIdx}
                  style={[
                    styles.dayCell,
                    { width: CELL_SIZE, height: CELL_SIZE },
                    isWin && styles.dayCellWin,
                    isLoss && styles.dayCellLoss,
                    isToday && !isSelected && styles.dayCellToday,
                    isSelected && styles.dayCellSelected,
                  ]}
                  onPress={() => setSelectedDateStr(dateStr)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayNum,
                      isToday && styles.dayNumToday,
                      isSelected && styles.dayNumSelected,
                    ]}
                  >
                    {dayNum}
                  </Text>
                  {ds && (
                    <Text
                      style={[
                        styles.dayPnl,
                        isWin && styles.greenText,
                        isLoss && styles.redText,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.7}
                    >
                      {formatCurrency(ds.pnl, { compact: true, decimals: 0 })}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Monthly Summary Footer */}
        <View style={styles.separator} />
        <View style={styles.calendarFooter}>
          <Text style={styles.footerLabel}>
            {t('calFooterSummary', monthlyStats.totalTradesMonth, monthlyStats.greenDays + monthlyStats.redDays)}
          </Text>
          <Text style={[styles.footerPnl, monthlyStats.monthPnl >= 0 ? styles.greenText : styles.redText]}>
            {formatCurrency(monthlyStats.monthPnl)}
          </Text>
        </View>
      </View>

      {/* ── SELECTED DATE DETAILS ── */}
      {selectedDateStr && (
        <Card
          title={`${t('tradesOfDay')} ${new Date(selectedDateStr).toLocaleDateString(localeFor(lang), { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase()}`}
          badge={tradesByDate[selectedDateStr] ? `${tradesByDate[selectedDateStr].trades.length} ${t('positions')}` : t('noPositions')}
          badgeVariant={tradesByDate[selectedDateStr]?.pnl! >= 0 ? 'green' : 'red'}
        >
          {selectedTrades.length === 0 ? (
            <Text style={styles.emptyText}>{t('noTradeThatDay')}</Text>
          ) : (
            selectedTrades.map((t: Trade) => (
              <View key={t.id} style={styles.tradeRow}>
                <View>
                  <View style={styles.flexRow}>
                    <Text style={styles.tradePair}>{t.pair}</Text>
                    <Badge label={t.direction} variant={t.direction === 'BUY' ? 'green' : 'blue'} size="sm" />
                  </View>
                  <Text style={styles.tradeTime}>
                    {new Date(t.entry_time).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.tradePnl, (t.pnl || 0) >= 0 ? styles.greenText : styles.redText]}>
                    {t.pnl !== null ? formatCurrency(t.pnl) : 'OPEN'}
                  </Text>
                  <Badge label={t.result} variant={t.result === 'TP' ? 'green' : t.result === 'SL' ? 'red' : 'neutral'} size="sm" />
                </View>
              </View>
            ))
          )}
        </Card>
      )}

      <View style={{ height: 32 }} />
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
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1.2,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 2,
  },

  // ── Hero Card ──
  heroMonthCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
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
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 1,
  },
  heroMonthPnl: {
    fontSize: 22,
    fontFamily: theme.fonts.monoExtraBold,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  daysBreakdown: {
    flexDirection: 'row',
    gap: 8,
  },
  dayStatBox: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  greenDayText: {
    color: theme.colors.greenLight,
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
  },
  redDayText: {
    color: theme.colors.redLight,
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
  },
  statSubText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 2,
  },

  // ── Framed Calendar ──
  calendarFrame: {
    backgroundColor: theme.colors.backgroundElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    padding: CALENDAR_PADDING,
    marginBottom: theme.spacing.lg,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 10,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1.5,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.surface,
    marginBottom: 10,
  },
  daysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  dayColHeaderBox: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayColHeaderText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },

  // ── Grid ──
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: CELL_GAP,
  },
  emptyCell: {
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  dayCell: {
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCellWin: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  dayCellLoss: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  dayCellToday: {
    borderColor: 'rgba(99, 102, 241, 0.5)',
    borderWidth: 1.5,
  },
  dayCellSelected: {
    borderColor: theme.colors.textPrimary,
    borderWidth: 2,
    backgroundColor: theme.colors.surface,
  },
  dayNum: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
  },
  dayNumToday: {
    color: theme.colors.primaryLight,
    fontWeight: '900',
  },
  dayNumSelected: {
    color: theme.colors.textPrimary,
    fontWeight: '900',
  },
  dayPnl: {
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    marginTop: 1,
    fontVariant: ['tabular-nums'],
  },

  // ── Calendar Footer ──
  calendarFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 2,
  },
  footerLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
  },
  footerPnl: {
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },

  // ── Trade Details ──
  tradeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tradePair: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.sansBold,
  },
  tradeTime: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 2,
  },
  tradePnl: {
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
    paddingVertical: 12,
  },
  greenText: { color: theme.colors.greenLight },
  redText: { color: theme.colors.redLight },
});
