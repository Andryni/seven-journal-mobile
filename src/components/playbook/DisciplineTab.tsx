import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import type { TFunction } from '../../i18n';
import type {
  MistakeCost,
  DisciplineDayCell,
  MentalVsPnl,
} from '../../features/playbook/debriefInsights';

/**
 * The Discipline tab, lifted out of PlaybookScreen.
 *
 * That screen had grown past two thousand lines holding three unrelated tabs,
 * a debrief form, a setup editor and a modal. At that size a change in one
 * tab silently breaks another -- which is how the discipline checkboxes once
 * ended up on a tab with no save button.
 *
 * This part extracts cleanly because it is pure presentation: every figure it
 * shows is already derived by debriefInsights, so it takes them as props and
 * owns no state. Its styles come with it rather than being imported from the
 * screen, which is what makes the move an actual separation instead of a file
 * split with the coupling intact.
 */

export interface DisciplineTabProps {
  /** Consecutive clean debriefed days. */
  streak: number;
  /** Mistake frequency, for the matrix. */
  mistakesAnalytics: { id: string; label: string; count: number; pct: number }[];
  /** What each mistake has cost across the days naming it. */
  costs: MistakeCost[];
  /** Eight weeks of behaviour, Monday first. */
  grid: DisciplineDayCell[][];
  /** Declared mental score against real day P&L. */
  mentalMirror: MentalVsPnl;
  money: (value: number, opts?: { decimals?: number }) => string;
  mistakeLabel: (t: TFunction, id: string) => string;
}

export const DisciplineTab: React.FC<DisciplineTabProps> = ({
  streak,
  mistakesAnalytics,
  costs,
  grid,
  mentalMirror,
  money,
  mistakeLabel,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
      <View style={styles.tabContent}>
        {/* The streak first: it is the number that makes writing tonight's
            debrief feel like protecting something. */}
        <Card title={t('disciplineStreakTitle')}>
          <View style={styles.streakRow}>
            <Flame
              size={22}
              color={streak > 0 ? theme.colors.primary : theme.colors.textMuted}
            />
            <Text style={styles.streakVal}>{streak}</Text>
            <Text style={styles.streakLabel}>
              {streak === 1 ? t('disciplineStreakOne') : t('disciplineStreakMany')}
            </Text>
          </View>
        </Card>

        {/* Frequency of each mistake, unchanged. */}
        <Card title={t('disciplineMatrix')}>
          {mistakesAnalytics.map(item => (
            <View key={item.id} style={styles.analyticsRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.analyticsLabel}>{item.label}</Text>
                <View style={styles.progressBarBg}>
                  <View style={[styles.progressBarFill, { width: (item.pct + '%' as any), backgroundColor: theme.colors.red }]} />
                </View>
              </View>
              <View style={styles.analyticsStats}>
                <Text style={styles.analyticsCount}>{item.count}</Text>
                <Text style={styles.analyticsPct}>{item.pct}%</Text>
              </View>
            </View>
          ))}
        </Card>

        {/* What each mistake costs: the day PnL of the debriefs naming it.
            Context, not proof — but context a trader acts on. */}
        {costs.length > 0 ? (
          <Card title={t('mistakeCostTitle')}>
            {costs.map(c => {
              const negative = c.totalPnl < 0;
              return (
                <View key={c.id} style={styles.costRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.costLabel}>{mistakeLabel(t, c.id)}</Text>
                    <Text style={styles.costDays}>
                      {c.days === 1 ? t('mistakeCostDayOne') : t('mistakeCostDays', c.days)}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.costVal,
                      { color: negative ? theme.colors.red : theme.colors.green },
                    ]}
                  >
                    {money(c.totalPnl, { decimals: 0 })}
                  </Text>
                </View>
              );
            })}
            <Text style={styles.costHint}>{t('mistakeCostHint')}</Text>
          </Card>
        ) : null}

        {/* 8 weeks at a glance, Monday-first. Colour = the debrief (was I
            clean?), not PnL: this grid is about behaviour. */}
        <Card title={t('disciplineGridTitle')}>
          <View style={styles.gridWrap}>
            {grid.map((week, wi) => (
              <View key={wi} style={styles.gridCol}>
                {week.map(cell => {
                  const bg = cell.isFuture
                    ? 'transparent'
                    : !cell.hasDebrief
                      ? theme.colors.surface
                      : cell.mistakes > 0
                        ? withAlpha(theme.colors.red, cell.mistakes >= 2 ? 0.55 : 0.3)
                        : withAlpha(theme.colors.green, 0.45);
                  return (
                    <View
                      key={cell.dateKey ?? `${wi}-${cell.dateKey}`}
                      style={[
                        styles.gridCell,
                        { backgroundColor: bg },
                        cell.isToday && styles.gridCellToday,
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>
          <View style={styles.gridLegend}>
            <View style={styles.gridLegendItem}>
              <View style={[styles.gridLegendDot, { backgroundColor: withAlpha(theme.colors.green, 0.45) }]} />
              <Text style={styles.gridLegendText}>{t('gridClean')}</Text>
            </View>
            <View style={styles.gridLegendItem}>
              <View style={[styles.gridLegendDot, { backgroundColor: withAlpha(theme.colors.red, 0.45) }]} />
              <Text style={styles.gridLegendText}>{t('gridMistake')}</Text>
            </View>
            <View style={styles.gridLegendItem}>
              <View style={[styles.gridLegendDot, { backgroundColor: theme.colors.surface }]} />
              <Text style={styles.gridLegendText}>{t('gridNoDebrief')}</Text>
            </View>
          </View>
        </Card>

        {/* The mirror: declared mental state vs the money those days made.
            When the correlation is absent, that fact is shown too — it is
            the honest result, not a failure of the feature. */}
        <Card title={t('mentalMirrorTitle')}>
          {mentalMirror.strong.days === 0 && mentalMirror.weak.days === 0 ? (
            <Text style={styles.dayStatsEmpty}>{t('mentalMirrorEmpty')}</Text>
          ) : (
            <>
              {[
                { key: 'strong' as const, label: t('mentalStrong'), bucket: mentalMirror.strong, color: theme.colors.green },
                { key: 'weak' as const, label: t('mentalWeak'), bucket: mentalMirror.weak, color: theme.colors.red },
                ...(mentalMirror.middle.days > 0
                  ? [{ key: 'middle' as const, label: t('mentalMiddle'), bucket: mentalMirror.middle, color: theme.colors.gold }]
                  : []),
              ].map(row => (
                <View key={row.key} style={styles.costRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.costLabel}>{row.label}</Text>
                    <Text style={styles.costDays}>
                      {row.bucket.days === 1 ? t('mentalMirrorDayOne') : t('mentalMirrorDays', row.bucket.days)}
                    </Text>
                  </View>
                  <Text style={[styles.costVal, { color: row.color }]}>
                    {money(row.bucket.totalPnl, { decimals: 0 })}
                  </Text>
                </View>
              ))}
              <Text style={styles.costHint}>{t('mentalMirrorHint')}</Text>
            </>
          )}
        </Card>
      </View>  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
  tabContent: {
    paddingBottom: theme.spacing.xxl,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  streakVal: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.metric,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
  },
  streakLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.type.label,
    fontFamily: theme.fonts.mono,
  },
  analyticsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: theme.colors.cardBorder },
  analyticsLabel: { color: theme.colors.textSecondary, fontSize: 10, fontFamily: theme.fonts.sansMedium, marginBottom: 4 },
  progressBarBg: { height: 5, backgroundColor: theme.colors.surface, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  analyticsStats: { alignItems: 'flex-end', minWidth: 40 },
  analyticsCount: { color: theme.colors.red, fontSize: 14, fontFamily: theme.fonts.monoBold },
  analyticsPct: { color: theme.colors.textMuted, fontSize: 9, fontFamily: theme.fonts.monoMedium },
  costRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.hairline,
  },
  costLabel: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.label,
    fontFamily: theme.fonts.monoMedium,
  },
  costVal: {
    fontSize: theme.type.body,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  costDays: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.mono,
    marginTop: 1,
  },
  costHint: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.sans,
    lineHeight: 15,
    marginTop: 8,
  },
  dayStatsEmpty: {
    color: theme.colors.textMuted,
    fontSize: theme.type.label,
    fontFamily: theme.fonts.sans,
  },
  gridWrap: {
    flexDirection: 'row',
    gap: 3,
  },
  gridCol: {
    flex: 1,
    gap: 3,
  },
  gridCell: {
    aspectRatio: 1,
    borderRadius: 3,
  },
  gridCellToday: {
    borderWidth: 1,
    borderColor: theme.colors.primaryLight,
  },
  gridLegend: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  gridLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gridLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  gridLegendText: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.mono,
  },
  });
