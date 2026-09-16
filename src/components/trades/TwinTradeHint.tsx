import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { History } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/translations';
import { useMoney } from '../../features/accounts/useMoney';
import type { Trade } from '../../types/domain';
import {
  findTwinTrades,
  aggregateTwins,
  isTwinSignificant,
  type TwinCriteria,
} from '../../utils/twinTrade';

interface TwinTradeHintProps {
  /** The full journal, already scoped to the account being booked to. */
  trades: Trade[];
  /** Exclude the trade being edited from its own twins. */
  excludeId?: string;
  criteria: TwinCriteria;
}

/**
 * The twin trade, at the moment of decision.
 *
 * Rendered inside the trade form above the submit button: before the write
 * happens, the trader sees how the closest past version of this exact trade
 * went. Silence is the default — fewer than MIN_TWIN_SAMPLE closed twins say
 * nothing, because a pattern of two is a coincidence.
 */
export const TwinTradeHint: React.FC<TwinTradeHintProps> = ({
  trades,
  excludeId,
  criteria,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const aggregate = useMemo(() => {
    const candidates = excludeId ? trades.filter(tr => tr.id !== excludeId) : trades;
    return aggregateTwins(findTwinTrades(candidates, criteria));
  }, [trades, excludeId, criteria]);

  if (!isTwinSignificant(aggregate)) return null;

  const positive = aggregate.totalPnl > 0;
  const color = positive ? theme.colors.green : theme.colors.red;
  const toneKey: TranslationKey = positive ? 'twinPositive' : 'twinNegative';

  const rLabel =
    aggregate.avgR !== null ? `${aggregate.avgR > 0 ? '+' : ''}${aggregate.avgR.toFixed(2)} R` : null;

  return (
    <View style={[styles.hint, { borderColor: color }]}>
      <History size={14} color={color} strokeWidth={2} />
      <View style={styles.textCol}>
        <Text style={[styles.line, { color }]}>
          {t(toneKey, {
            count: aggregate.closed,
            wins: aggregate.wins,
            losses: aggregate.losses,
            pnl: money(aggregate.totalPnl, { decimals: 0 }),
            r: rLabel ?? '',
          })}
        </Text>
        <Text style={styles.sub}>{t('twinBasis')}</Text>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    hint: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      paddingVertical: 10,
      paddingHorizontal: 12,
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.inputBg,
    },
    textCol: { flex: 1, gap: 2 },
    line: {
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
    },
    sub: {
      fontSize: theme.type.micro,
      color: theme.colors.textMuted,
      fontFamily: theme.fonts.mono,
    },
  });
