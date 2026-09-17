import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sunrise, Target, CalendarDays, Brain } from 'lucide-react-native';
import { Panel } from '../ui/Panel';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { mentalStateLabel } from '../../i18n';
import {
  buildMorningBrief,
  isBriefEmpty,
} from '../../features/dashboard/morningBrief';
import type { Trade } from '../../types/domain';
import type { DailyDebrief } from '../../features/playbook/usePlaybook';

/**
 * The morning brief, at the very top of the dashboard — above the hero,
 * because it is the one panel addressed to the trader rather than to their
 * data. Three lines in priority order:
 *
 *   1. The objective written in yesterday's debrief (the discipline loop).
 *   2. What history says about this weekday (the statistical nudge).
 *   3. How yesterday ended — mental score and declared mistakes (the
 *      emotional handoff: a tired, mistake-ridden yesterday is exactly the
 *      thing to see before opening today's chart).
 *
 * The card hides entirely when there is nothing honest to say.
 */
export const MorningBriefCard: React.FC<{ trades: Trade[]; debriefs: DailyDebrief[] }> = ({
  trades,
  debriefs,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const brief = useMemo(() => buildMorningBrief(trades, debriefs), [trades, debriefs]);

  if (isBriefEmpty(brief)) return null;

  const WEEKDAY_KEYS = [
    'daySunShort',
    'dayMonShort',
    'dayTueShort',
    'dayWedShort',
    'dayThuShort',
    'dayFriShort',
    'daySatShort',
  ] as const;

  return (
    <Panel>
      {/* Line 1 — the objective the trader set themselves */}
      {brief.objective ? (
        <View style={styles.objective}>
          <Target size={13} color={theme.colors.primaryLight} />
          <Text style={styles.objectiveText}>{brief.objective}</Text>
        </View>
      ) : null}

      {/* Line 2 — the weekday history */}
      {brief.stats.dayTrades > 0 ? (
        <View style={styles.row}>
          <CalendarDays size={12} color={theme.colors.textMuted} />
          <Text style={styles.rowText}>
            {t('mbWeekdayIntro', t(WEEKDAY_KEYS[brief.weekdayIndex]))}{' '}
            <Text style={styles.rowStrong}>
              {brief.stats.dayTrades} {t('positions').toLowerCase()}
            </Text>
            {brief.stats.dayAvgR !== null ? (
              <>
                {', '}
                <Text
                  style={[styles.rowStrong, { color: brief.stats.dayAvgR >= 0 ? theme.colors.green : theme.colors.red }]}
                >
                  {brief.stats.dayAvgR >= 0 ? '+' : ''}
                  {brief.stats.dayAvgR.toFixed(2)}R
                </Text>{' '}
                {t('mbAverage').toLowerCase()}
              </>
            ) : (
              <>
                {', '}
                <Text style={styles.rowStrong}>{brief.stats.dayWinRate}%</Text>{' '}
                {t('winRate').toLowerCase()}
              </>
            )}
            {brief.stats.favouriteSetup ? (
              <>
                {' '}
                {t('mbOn')} <Text style={styles.rowStrong}>{brief.stats.favouriteSetup}</Text>
              </>
            ) : null}
          </Text>
        </View>
      ) : null}

      {/* Line 3 — the emotional handoff from yesterday */}
      {brief.hasYesterdayDebrief ? (
        <View style={styles.row}>
          <Brain size={12} color={theme.colors.textMuted} />
          <Text style={styles.rowText}>
            {t('mbYesterday')}{' '}
            <Text style={styles.rowStrong}>{t('mbMentalScore', String(brief.yesterdayMentalScore ?? '—'))}</Text>
            {brief.yesterdayMistakes.length > 0 ? (
              <>
                {' '}
                {t('mbMistakesCounted', String(brief.yesterdayMistakes.length))}{' '}
                <Text style={styles.rowStrong}>
                  {brief.yesterdayMistakes.slice(0, 3).join(', ')}
                </Text>
              </>
            ) : (
              <> {t('mbMistakesNone')}</>
            )}
          </Text>
        </View>
      ) : null}

      {/* Header last so flex order stays: lines first, kicker on top via
          absolute — actually placed first in DOM below. */}
      <View style={styles.kickerRow} pointerEvents="none">
        <Sunrise size={12} color={theme.colors.gold} />
        <Text style={styles.kicker}>{t('mbTitle')}</Text>
      </View>
    </Panel>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    kickerRow: {
      position: 'absolute',
      top: -9,
      left: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 8,
      backgroundColor: theme.colors.card,
    },
    kicker: {
      color: theme.colors.gold,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.2,
    },
    objective: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      paddingVertical: 8,
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.primary,
      paddingLeft: 10,
      marginBottom: 6,
    },
    objectiveText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sansSemiBold,
      lineHeight: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 7,
      paddingVertical: 4,
    },
    rowText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
      lineHeight: 17,
    },
    rowStrong: {
      color: theme.colors.textPrimary,
      fontFamily: theme.fonts.monoBold,
    },
  });
