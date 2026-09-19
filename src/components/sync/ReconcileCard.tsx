import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Scale, AlertTriangle, Check } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Card } from '../ui/Card';
import { formatCurrency } from '../../utils/formatCurrency';
import type { ReconcileResult } from '../../features/sync/reconcileBalance';

/**
 * Journal balance against broker balance.
 *
 * The one card in the app whose job is to say the journal might be wrong.
 * Everything else reports what the journal contains; this reports whether it
 * contains everything.
 *
 * Renders nothing on `unknown`. A connector that has never reported a balance
 * — an older EA, or one that has not beaten yet — is not agreement, and a
 * card claiming a match on data it does not have would be worse than absence.
 */
export const ReconcileCard: React.FC<{
  result: ReconcileResult;
  currency?: string | null;
}> = ({ result, currency }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (result.verdict === 'unknown') return null;

  const matched = result.verdict === 'match';
  const money = (v: number) =>
    formatCurrency(v, { symbol: currency ?? '$', decimals: 2, thousandsSeparator: true });

  const tone = matched ? theme.colors.green : theme.colors.gold;

  return (
    <Animated.View entering={FadeIn.duration(260)}>
      <Card title={t('reconcileTitle')}>
        <View style={styles.row}>
          <Scale size={14} color={tone} strokeWidth={1.9} />
          <View style={styles.figures}>
            <Text style={styles.line}>
              {t('reconcileJournal')}{' '}
              <Text style={styles.value}>{money(result.journalBalance ?? 0)}</Text>
            </Text>
            <Text style={styles.line}>
              {t('reconcileBroker')}{' '}
              <Text style={styles.value}>{money(result.brokerBalance ?? 0)}</Text>
            </Text>
          </View>
          <View style={styles.verdict}>
            {matched ? (
              <Check size={15} color={theme.colors.green} strokeWidth={2.5} />
            ) : (
              <AlertTriangle size={15} color={theme.colors.gold} strokeWidth={2} />
            )}
            <Text style={[styles.diff, { color: tone }]} numberOfLines={1}>
              {matched
                ? t('reconcileMatch')
                : formatCurrency(result.difference ?? 0, {
                    symbol: currency ?? '$',
                    decimals: 2,
                    showPlus: true,
                  })}
            </Text>
          </View>
        </View>

        {/* Hypotheses, never findings. The app cannot know why the numbers
            differ; naming a cause it cannot prove would be exactly the kind
            of confident wrongness this journal avoids elsewhere. */}
        {!matched && result.hints.length > 0 ? (
          <View style={styles.hints}>
            <Text style={styles.hintLead}>{t('reconcileWhy')}</Text>
            {result.hints.map(h => (
              <Text key={h} style={styles.hint}>
                • {t(`reconcileHint_${h}` as never)}
              </Text>
            ))}
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    figures: { flex: 1 },
    line: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      lineHeight: 16,
    },
    value: {
      color: theme.colors.textPrimary,
      fontFamily: theme.fonts.monoBold,
    },
    verdict: { alignItems: 'flex-end', gap: 2 },
    diff: {
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    hints: {
      marginTop: 10,
      paddingTop: 9,
      borderTopWidth: 1,
      borderTopColor: withAlpha(theme.colors.gold, 0.25),
    },
    hintLead: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      marginBottom: 4,
    },
    hint: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      lineHeight: 15,
    },
  });
