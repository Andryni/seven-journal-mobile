import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import type { Trade } from '../../types/domain';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Card } from '../ui/Card';
import { formatCurrency } from '../../utils/formatCurrency';
import { useHaptic } from '../../hooks/useHaptic';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SCREEN_WIDTH = Dimensions.get('window').width;
const CELL_SIZE = Math.floor((SCREEN_WIDTH - 80) / 24);

interface SessionHeatmapCardProps {
  trades: Trade[];
}

export const SessionHeatmapCard: React.FC<SessionHeatmapCardProps> = ({ trades }) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const { light: hapticLight } = useHaptic();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const DAYS = lang === 'en' ? DAYS_EN : DAYS_FR;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const heatData = useMemo(() => {
    const grid: Record<string, { totalPnL: number; count: number }> = {};
    trades.forEach((t) => {
      if (!t.exit_time || t.pnl === null) return;
      const d = new Date(t.exit_time);
      const rawDay = d.getDay();
      const dayIdx = rawDay === 0 ? 6 : rawDay - 1;
      const hour = d.getHours();
      const key = `${dayIdx}-${hour}`;
      if (!grid[key]) grid[key] = { totalPnL: 0, count: 0 };
      grid[key].totalPnL += t.pnl;
      grid[key].count += 1;
    });
    return grid;
  }, [trades]);

  const maxAbsAvg = useMemo(() => {
    let max = 0;
    Object.values(heatData).forEach((v) => {
      const avg = Math.abs(v.totalPnL / v.count);
      if (avg > max) max = avg;
    });
    return max || 1;
  }, [heatData]);

  const getCellColor = (dayIdx: number, hour: number): string => {
    const key = `${dayIdx}-${hour}`;
    const v = heatData[key];
    if (!v || v.count === 0) return theme.colors.surface;
    const avg = v.totalPnL / v.count;
    const intensity = Math.min(Math.abs(avg) / maxAbsAvg, 1);
    if (avg > 0) {
      const alpha = 0.15 + intensity * 0.7;
      return `rgba(16,185,129,${alpha})`;
    } else {
      const alpha = 0.15 + intensity * 0.7;
      return `rgba(239,68,68,${alpha})`;
    }
  };

  const totalTrades = trades.filter((t) => t.exit_time && t.pnl !== null).length;

  if (totalTrades < 3) {
    return (
      <Card title={t('sessionHeatmapTitle')}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>{t('sessionHeatmapEmptyTitle')}</Text>
          <Text style={styles.emptySubtext}>{t('sessionHeatmapEmptySub')}</Text>
        </View>
      </Card>
    );
  }

  const selectedStats = selectedKey ? heatData[selectedKey] : null;
  const [selectedDayIdx, selectedHour] = selectedKey ? selectedKey.split('-').map(Number) : [-1, -1];

  return (
    <Card title={t('sessionHeatmapTitle')}>
      {/* Selected Cell Tooltip Banner */}
      {selectedStats && selectedStats.count > 0 ? (
        <View style={styles.activeCellBanner}>
          <Text style={styles.activeCellLabel}>
            📍 {DAYS[selectedDayIdx]} {selectedHour}h00 :{' '}
            <Text style={{ fontWeight: '800', color: selectedStats.totalPnL >= 0 ? theme.colors.greenLight : theme.colors.redLight }}>
              {formatCurrency(selectedStats.totalPnL)}
            </Text>{' '}
            ({selectedStats.count} trade{selectedStats.count > 1 ? 's' : ''})
          </Text>
        </View>
      ) : (
        <Text style={styles.subtitle}>{t('sessionHeatmapSubtitle')}</Text>
      )}

      {/* Hour labels */}
      <View style={styles.hourRow}>
        <View style={styles.dayLabel} />
        {HOURS.map((h) => (
          <View key={h} style={[styles.hourCell, { width: CELL_SIZE }]}>
            <Text style={styles.hourText}>{h % 6 === 0 ? `${h}h` : ''}</Text>
          </View>
        ))}
      </View>

      {/* Grid */}
      {DAYS.map((day, dayIdx) => (
        <View key={day} style={styles.dayRow}>
          <View style={styles.dayLabel}>
            <Text style={styles.dayText}>{day}</Text>
          </View>
          {HOURS.map((hour) => {
            const key = `${dayIdx}-${hour}`;
            const v = heatData[key];
            const isSelected = selectedKey === key;
            return (
              <TouchableOpacity
                key={hour}
                activeOpacity={0.7}
                onPress={() => {
                  if (v && v.count > 0) {
                    hapticLight();
                    setSelectedKey(isSelected ? null : key);
                  }
                }}
              >
                <Animated.View
                  entering={FadeIn.delay((dayIdx * 24 + hour) * 1).duration(150)}
                  style={[
                    styles.cell,
                    {
                      width: CELL_SIZE,
                      backgroundColor: getCellColor(dayIdx, hour),
                      borderColor: isSelected ? theme.colors.primaryLight : 'transparent',
                      borderWidth: isSelected ? 1 : 0,
                    },
                  ]}
                >
                  {v && v.count > 0 && (
                    <Text style={styles.cellCount}>{v.count}</Text>
                  )}
                </Animated.View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>{t('sessionHeatmapIntensity')}</Text>
        <View style={styles.legendGroup}>
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((v, i) => (
            <View key={i} style={[styles.legendDot, { backgroundColor: `rgba(16,185,129,${v})` }]} />
          ))}
          <Text style={styles.legendText}>{t('sessionHeatmapProfit')}</Text>
        </View>
        <View style={styles.legendGroup}>
          {[0.15, 0.35, 0.55, 0.75, 0.95].map((v, i) => (
            <View key={i} style={[styles.legendDot, { backgroundColor: `rgba(239,68,68,${v})` }]} />
          ))}
          <Text style={styles.legendText}>{t('sessionHeatmapLoss')}</Text>
        </View>
        <Text style={styles.legendCount}>{t('sessionHeatmapTradesCount', totalTrades)}</Text>
      </View>
    </Card>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      textAlign: 'right',
      marginBottom: 8,
    },
    hourRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 2,
    },
    dayLabel: {
      width: 32,
      alignItems: 'flex-end',
      paddingRight: 4,
    },
    dayText: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
    },
    hourCell: {
      alignItems: 'center',
    },
    hourText: {
      color: theme.colors.textMuted,
      fontSize: 7,
      fontFamily: theme.fonts.monoBold,
    },
    cell: {
      height: CELL_SIZE,
      marginHorizontal: 0.5,
      borderRadius: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellCount: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: 7,
      fontWeight: '800',
    },
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
      gap: 8,
    },
    legendLabel: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
    },
    legendGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 2,
    },
    legendText: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      marginLeft: 4,
    },
    legendCount: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      marginLeft: 'auto',
    },
    activeCellBanner: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primaryLight,
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 5,
      marginBottom: 8,
      alignSelf: 'center',
    },
    activeCellLabel: {
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
    },
    emptyContainer: {
      height: 150,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 11,
    },
    emptySubtext: {
      color: theme.colors.textMuted,
      fontSize: 9,
      opacity: 0.5,
    },
  });
