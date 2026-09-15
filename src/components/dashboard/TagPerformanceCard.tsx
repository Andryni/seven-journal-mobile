import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Panel } from '../ui/Panel';
import { duration } from '../../theme/motion';
import { tagPerformance } from '../../utils/tradeTags';
import { useMoney } from '../../features/accounts/useMoney';
import type { Trade } from '../../types/domain';

/**
 * What your tags actually cost or earn.
 *
 * A tag on its own is just a label. Attaching expectancy to it turns "I
 * sometimes trade tired" into "trading tired costs me $38 a trade", which is
 * the version that changes behaviour.
 *
 * Sorted worst first, and silent below a real sample: ranking a tag on two
 * trades would dress noise up as an insight.
 */
export const TagPerformanceCard: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rows = useMemo(() => tagPerformance(trades, 3), [trades]);
  if (rows.length === 0) return null;

  // Worst and best are the only two that drive a decision; the middle is noise
  // on a dashboard. The full list stays available through tag filtering.
  const shown = rows.length > 6 ? [...rows.slice(0, 3), ...rows.slice(-3)] : rows;
  const worst = rows[0];

  return (
    <Animated.View entering={FadeInDown.duration(duration.base)}>
      <Panel>
        <View style={styles.header}>
          <Text style={styles.title}>{t('tagPerfTitle')}</Text>
          <Text style={styles.coverage}>
            {t('tagPerfCoverage').replace('{n}', String(rows.length))}
          </Text>
        </View>

        {shown.map(row => {
          const positive = row.expectancy >= 0;
          return (
            <View key={row.tag} style={styles.row}>
              <View style={styles.tagCell}>
                <Text style={styles.tagName} numberOfLines={1}>
                  {row.tag}
                </Text>
                <Text style={styles.tagMeta}>
                  {row.trades} · {row.winRate.toFixed(0)}%
                </Text>
              </View>
              <Text style={[styles.expectancy, positive ? styles.green : styles.red]}>
                {money(row.expectancy)}
              </Text>
            </View>
          );
        })}

        {worst.expectancy < 0 && (
          <Text style={styles.advice}>
            {t('tagPerfWorst')
              .replace('{tag}', worst.tag)
              .replace('{amount}', money(Math.abs(worst.expectancy)))
              .replace('{n}', String(worst.trades))}
          </Text>
        )}
      </Panel>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    coverage: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 5,
    },
    tagCell: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
    tagName: {
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.mono,
      flexShrink: 1,
    },
    tagMeta: {
      color: theme.colors.textMuted,
      fontSize: 8.5,
      fontFamily: theme.fonts.mono,
    },
    expectancy: { fontSize: 11, fontFamily: theme.fonts.monoBold },
    green: { color: theme.colors.green },
    red: { color: theme.colors.red },
    advice: {
      marginTop: 12,
      color: theme.colors.gold,
      fontSize: 9.5,
      fontFamily: theme.fonts.mono,
      lineHeight: 14,
    },
  });
