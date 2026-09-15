import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Panel } from '../ui/Panel';
import { duration } from '../../theme/motion';
import { summarizeExcursions } from '../../utils/excursions';
import type { Trade } from '../../types/domain';

/**
 * Aggregate MAE/MFE behaviour: the two habits that P&L statistics cannot see.
 *
 * Renders nothing without excursion data — an empty shell promising insight it
 * cannot deliver is worse than no card at all.
 */
export const ExcursionCard: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const s = useMemo(() => summarizeExcursions(trades), [trades]);

  if (s.tradesWithData === 0) return null;

  const capturePct = s.avgCapture === null ? null : Math.round(s.avgCapture * 100);

  return (
    <Animated.View entering={FadeInDown.duration(duration.base)}>
      <Panel>
        <View style={styles.header}>
          <Text style={styles.title}>{t('excTitle')}</Text>
          <Text style={styles.coverage}>
            {t('excCoverage')
              .replace('{n}', String(s.tradesWithData))
              .replace('{total}', String(s.trades))}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t('excAvgMae')}</Text>
            <Text style={[styles.cellValue, styles.red]}>
              {s.avgMae === null ? '—' : `${s.avgMae.toFixed(2)}R`}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t('excAvgMfe')}</Text>
            <Text style={[styles.cellValue, styles.green]}>
              {s.avgMfe === null ? '—' : `${s.avgMfe.toFixed(2)}R`}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t('excCapture')}</Text>
            <Text style={styles.cellValue}>
              {capturePct === null ? '—' : `${capturePct}%`}
            </Text>
          </View>
        </View>

        {capturePct !== null && (
          <View style={styles.barBlock}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${capturePct}%` }]} />
            </View>
            <Text style={styles.barText}>
              {t('excCaptureHint').replace('{pct}', String(capturePct))}
            </Text>
          </View>
        )}

        <View style={styles.footRow}>
          <Text style={styles.footLabel}>{t('excMaeWinners')}</Text>
          <Text style={styles.footValue}>
            {s.avgMaeWinners === null ? '—' : `${s.avgMaeWinners.toFixed(2)}R`}
          </Text>
        </View>
        <View style={styles.footRow}>
          <Text style={styles.footLabel}>{t('excNearMisses')}</Text>
          <Text style={styles.footValue}>{s.nearMisses}</Text>
        </View>
        <View style={styles.footRow}>
          <Text style={styles.footLabel}>{t('excGiveBacks')}</Text>
          <Text style={styles.footValue}>{s.giveBacks}</Text>
        </View>

        {s.suggestedStopR !== null && (
          <Text style={styles.advice}>
            {t('excAdviceStop').replace('{r}', s.suggestedStopR.toFixed(1))}
          </Text>
        )}
        {s.targetsTooTight && (
          <Text style={styles.advice}>{t('excAdviceTarget')}</Text>
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
      marginBottom: 12,
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
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    cell: { flex: 1 },
    cellLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.5,
      marginBottom: 4,
    },
    cellValue: {
      fontSize: 13,
      fontFamily: theme.fonts.monoBold,
      color: theme.colors.textPrimary,
    },
    green: { color: theme.colors.green },
    red: { color: theme.colors.red },
    barBlock: { marginTop: 14 },
    barTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceLight,
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.green },
    barText: {
      marginTop: 6,
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
      lineHeight: 13,
    },
    footRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    footLabel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
    },
    footValue: {
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
    },
    advice: {
      marginTop: 12,
      color: theme.colors.gold,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      lineHeight: 14,
    },
  });
