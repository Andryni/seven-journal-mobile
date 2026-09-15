import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Panel } from '../ui/Panel';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { duration } from '../../theme/motion';
import { summarizeCosts } from '../../utils/tradingCosts';
import { useMoney } from '../../features/accounts/useMoney';
import type { Trade } from '../../types/domain';

/**
 * Cost impact card.
 *
 * The journal used to present a single `pnl` figure with no idea of what it had
 * cost to earn it, so an edge that was positive gross and negative net looked
 * simply like a losing strategy — with no clue that the fees, not the setups,
 * were the problem. This card makes that distinction visible.
 *
 * It renders nothing when no trade carries cost data: showing "0 in fees" for a
 * book imported before the columns existed would be a confident lie.
 */
export const CostImpactCard: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const s = useMemo(() => summarizeCosts(trades), [trades]);

  if (s.tradesWithCost === 0) return null;

  // A ratio bar is only meaningful against a positive gross figure.
  const ratio = s.costRatioPct;
  const barPct = ratio == null ? 0 : Math.min(100, Math.max(0, ratio));

  return (
    <Animated.View entering={FadeInDown.duration(duration.base)}>
      <Panel>
        <View style={styles.header}>
          <Text style={styles.title}>{t('costTitle')}</Text>
          <Text style={styles.coverage}>
            {t('costCoverage')
              .replace('{n}', String(s.tradesWithCost))
              .replace('{total}', String(s.trades))}
          </Text>
        </View>

        <View style={styles.row}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t('costGross')}</Text>
            <AnimatedNumber
              value={s.grossPnl}
              format={(v: number) => money(v)}
              style={[styles.cellValue, s.grossPnl >= 0 ? styles.green : styles.red]}
            />
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t('costTotal')}</Text>
            <AnimatedNumber
              value={s.totalCost}
              format={(v: number) => `-${money(v)}`}
              style={[styles.cellValue, styles.red]}
            />
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>{t('costNet')}</Text>
            <AnimatedNumber
              value={s.netPnl}
              format={(v: number) => money(v)}
              style={[styles.cellValue, s.netPnl >= 0 ? styles.green : styles.red]}
            />
          </View>
        </View>

        {ratio != null && (
          <View style={styles.barBlock}>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${barPct}%` }]} />
            </View>
            <Text style={styles.barText}>
              {t('costRatio').replace('{pct}', ratio.toFixed(1))}
            </Text>
          </View>
        )}

        <View style={styles.footRow}>
          <Text style={styles.footLabel}>{t('costAvgPerTrade')}</Text>
          <Text style={styles.footValue} numberOfLines={1}>
            {money(s.avgCostPerTrade)}
          </Text>
        </View>
        <View style={styles.footRow}>
          <Text style={styles.footLabel}>{t('costExpectancy')}</Text>
          <Text style={styles.footValue} numberOfLines={1}>
            {money(s.grossExpectancy)} → {money(s.netExpectancy)}
          </Text>
        </View>

        {s.profitableBeforeCostsOnly && (
          <Text style={styles.warn}>{t('costEdgeEaten')}</Text>
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
    cellValue: { fontSize: 13, fontFamily: theme.fonts.monoBold },
    green: { color: theme.colors.green },
    red: { color: theme.colors.red },
    barBlock: { marginTop: 14 },
    barTrack: {
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.colors.surfaceLight,
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 3, backgroundColor: theme.colors.red },
    barText: {
      marginTop: 6,
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
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
    warn: {
      marginTop: 12,
      color: theme.colors.gold,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      lineHeight: 14,
    },
  });
