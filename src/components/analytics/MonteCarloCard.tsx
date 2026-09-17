import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Dices, Info } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { simulateChallenge } from '../../features/analytics/monteCarlo';
import type { MonteCarloBlock } from '../../features/analytics/monteCarlo';
import { useMoney } from '../../features/accounts/useMoney';

/**
 * The Monte Carlo card: replays the trader's future 2,000 times through their
 * own R distribution and states, in percent, how often the target is reached
 * before the drawdown kills the account.
 *
 * Deliberately framed as a DISTRIBUTION, never a promise: the headline is
 * "68% of futures", the sub-line names the sample it resamples, and the
 * explainer says plainly that the past is an assumption, not a guarantee.
 * The card is also honest about being unavailable: fewer than 20 closed
 * trades or missing challenge parameters yield a reason, not a fake number.
 */
export const MonteCarloCard: React.FC<{
  rMultiples: number[];
  startingBalance: number;
  profitTarget: number;
  maxDrawdown: number;
  /** Risk per trade, as a percentage of the starting balance. */
  riskPct: number;
}> = ({ rMultiples, startingBalance, profitTarget, maxDrawdown, riskPct }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [showExplainer, setShowExplainer] = useState(false);

  const sim = useMemo(
    () => simulateChallenge({ rMultiples, startingBalance, profitTarget, maxDrawdown, riskPct }),
    [rMultiples, startingBalance, profitTarget, maxDrawdown, riskPct]
  );

  const REASONS: Record<MonteCarloBlock, string> = {
    'not-enough-samples': t('mcReasonSamples'),
    'no-target': t('mcReasonTarget'),
    'no-drawdown-limit': t('mcReasonDrawdown'),
    'no-risk': t('mcReasonRisk'),
  };

  const rate = sim.result?.passRate ?? 0;
  // Tone follows the verdict: a coin-flip edge is amber, a losing profile
  // red, a genuinely strong edge green. 75/25 thresholds match the display.
  const tone =
    sim.status !== 'ok'
      ? theme.colors.textMuted
      : rate >= 0.6
        ? theme.colors.green
        : rate >= 0.35
          ? theme.colors.gold
          : theme.colors.red;

  return (
    <Card title={t('mcTitle')}>
      {sim.status !== 'ok' ? (
        <View style={styles.blocked}>
          <Dices size={20} color={theme.colors.textMuted} />
          <Text style={styles.blockedText}>{REASONS[sim.reason!]}</Text>
        </View>
      ) : (
        <>
          <View style={styles.headlineRow}>
            <Text style={[styles.rate, { color: tone }]}>{Math.round(rate * 100)}%</Text>
            <View style={styles.rateMeta}>
              <Text style={styles.rateLabel}>{t('mcPassRate')}</Text>
              <Text style={styles.rateSub}>
                {t('mcMedianTrades', String(sim.result!.medianTradesToPass ?? '—'))}
              </Text>
              <Text style={styles.rateSub}>
                {t('mcBalanceBand', money(sim.result!.endBalanceP10, { decimals: 0 }), money(sim.result!.endBalanceP90, { decimals: 0 }))}
              </Text>
            </View>
          </View>

          <View style={styles.failRow}>
            <Text style={styles.failLabel}>{t('mcFailRate')}</Text>
            <Text style={[styles.failValue, { color: sim.result!.failRate > 0.35 ? theme.colors.red : theme.colors.textSecondary }]}>
              {Math.round(sim.result!.failRate * 100)}%
            </Text>
            <Text style={styles.failLabel}>{t('mcTimeoutRate')}</Text>
            <Text style={styles.failValue}>{Math.round(sim.result!.timeoutRate * 100)}%</Text>
            <Text style={styles.failLabel}>{t('mcSample')}</Text>
            <Text style={styles.failValue}>{sim.result!.sampleCount}</Text>
          </View>

          <TouchableOpacity
            style={styles.explainerToggle}
            onPress={() => setShowExplainer(v => !v)}
            accessibilityRole="button"
            accessibilityLabel={t('mcHowItWorks')}
          >
            <Info size={12} color={theme.colors.textMuted} />
            <Text style={styles.explainerToggleText}>{t('mcHowItWorks')}</Text>
          </TouchableOpacity>
          {showExplainer ? (
            <Text style={styles.explainer}>{t('mcExplainer')}</Text>
          ) : null}
        </>
      )}
    </Card>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    headlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      paddingVertical: 6,
    },
    rate: {
      fontSize: 38,
      fontFamily: theme.fonts.monoExtraBold,
    },
    rateMeta: {
      flex: 1,
      gap: 2,
    },
    rateLabel: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.4,
    },
    rateSub: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
    },
    failRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.hairline,
    },
    failLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    failValue: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      marginRight: 10,
    },
    explainerToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    explainerToggleText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
    },
    explainer: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
      marginTop: 6,
      lineHeight: 17,
    },
    blocked: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
    },
    blockedText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
    },
  });
