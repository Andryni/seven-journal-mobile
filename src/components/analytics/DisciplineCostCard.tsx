import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Panel } from '../ui/Panel';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { duration } from '../../theme/motion';
import { disciplineCost } from '../../features/insights/disciplineCost';
import type { BehaviourId } from '../../features/insights/disciplineCost';
import { useMoney } from '../../features/accounts/useMoney';
import type { Trade } from '../../types/domain';

/**
 * What indiscipline costs, in money.
 *
 * `InsightsCard` states each finding separately, with its own currency impact —
 * which is right for reading them one at a time and wrong for adding up: a
 * revenge entry taken in a tilt state is two findings over one trade, so a sum
 * doubles. This card is the one figure that can be added up, because the
 * bucketing is exclusive (see disciplineCost).
 *
 * Renders nothing below the sample threshold. A cost figure computed over six
 * trades is not a small truth, it is a large error — and the trader who acts on
 * it will be changing behaviour to chase noise.
 */
export const DisciplineCostCard: React.FC<{ trades: Trade[] }> = ({ trades }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const cost = useMemo(() => disciplineCost(trades), [trades]);

  if (!cost) return null;

  /**
   * Only buckets that actually cost something get a line. A bucket that lost
   * nothing relative to the trader's own baseline is not a finding, and a row
   * of "-0" would dress it up as one.
   */
  const costly = cost.byBehaviour.filter(b => b.cost > 0);
  const biggest = costly[0]?.cost ?? 0;

  return (
    <Animated.View entering={FadeInDown.duration(duration.base)}>
      <Panel>
        <View style={styles.header}>
          <Text style={styles.title}>{t('discCostTitle')}</Text>
          <Text style={styles.coverage}>{t('discCostClosed').replace('{n}', String(cost.closedCount))}</Text>
        </View>

        <View style={styles.totalRow}>
          <View style={styles.totalCell}>
            <Text style={styles.totalLabel}>{t('discCostTotal')}</Text>
            <AnimatedNumber
              value={cost.total}
              format={(v: number) => (v > 0 ? `-${money(v)}` : money(0))}
              style={[styles.totalValue, cost.total > 0 ? styles.red : styles.green]}
            />
          </View>
          <Text style={styles.baseline}>
            {t('discCostBaseline')
              .replace('{n}', String(cost.cleanCount))
              .replace('{avg}', money(cost.cleanAvg))}
          </Text>
        </View>

        {costly.length === 0 && (
          <Text style={styles.none}>{t('discCostNone')}</Text>
        )}

        {costly.map(b => (
          <View key={b.id} style={styles.bucket}>
            <View style={styles.bucketHead}>
              <Text style={styles.bucketLabel} numberOfLines={1}>
                {t(BUCKET_LABEL[b.id])}
              </Text>
              <Text style={styles.bucketCost}>-{money(b.cost)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  { width: `${biggest > 0 ? Math.max(4, (b.cost / biggest) * 100) : 0}%` },
                ]}
              />
            </View>
            <Text style={styles.bucketMeta}>
              {t('discCostCount')
                .replace('{n}', String(b.count))
                .replace('{pnl}', money(b.pnl))}
            </Text>
          </View>
        ))}

        {cost.shareOfGross != null && cost.total > 0 && (
          <Text style={styles.share}>
            {t('discCostShare').replace('{pct}', (cost.shareOfGross * 100).toFixed(0))}
          </Text>
        )}

        {/* Disclosure, not decoration: a trader who sees two findings about the
            same trade and a smaller total deserves to know why. */}
        <Text style={styles.note}>{t('discCostNote')}</Text>
      </Panel>
    </Animated.View>
  );
};

const BUCKET_LABEL = {
  tilt: 'discCostTilt',
  'off-plan': 'discCostOffPlan',
  revenge: 'discCostRevenge',
} as const satisfies Record<BehaviourId, string>;

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
      letterSpacing: 1.4,
    },
    coverage: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.6,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      marginBottom: 14,
    },
    totalCell: { flexShrink: 1 },
    totalLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.mono,
      letterSpacing: 1,
      marginBottom: 2,
    },
    totalValue: {
      fontSize: 26,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: -0.5,
    },
    baseline: {
      flexShrink: 1,
      maxWidth: '52%',
      textAlign: 'right',
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.mono,
      lineHeight: 14,
    },
    none: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily: theme.fonts.sans,
      lineHeight: 18,
      marginBottom: 8,
    },
    bucket: { marginBottom: 10 },
    bucketHead: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 5,
    },
    bucketLabel: {
      flexShrink: 1,
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.4,
    },
    bucketCost: {
      color: theme.colors.red,
      fontSize: 12,
      fontFamily: theme.fonts.monoBold,
      marginLeft: 8,
    },
    barTrack: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.surfaceLight,
      overflow: 'hidden',
    },
    barFill: {
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.red,
    },
    bucketMeta: {
      marginTop: 4,
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.mono,
    },
    share: {
      marginTop: 4,
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: theme.fonts.mono,
    },
    note: {
      marginTop: 10,
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.sans,
      lineHeight: 14,
    },
    red: { color: theme.colors.red },
    green: { color: theme.colors.green },
  });
