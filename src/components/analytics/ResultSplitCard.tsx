import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Card } from '../ui/Card';
import { DonutChart } from '../ui/DonutChart';
import { tradeCost } from '../../utils/tradingCosts';
import { formatCurrency } from '../../utils/formatCurrency';
import type { Trade } from '../../types/domain';

/**
 * Win/loss split, classified by the trade's declared `result` (TP/SL/BE).
 *
 * The previous split used the SIGN of net PnL, which silently swallowed
 * breakeven trades: a BE exit minus commissions has pnl = -1.20, and the
 * trader saw their BE trades vanish into "losses". The declared outcome is
 * the truth the trader recorded; the sign is only a fallback for legacy rows
 * created before `result` existed.
 *
 * The card also prices the BE bucket: a breakeven trade still paid its
 * commissions, and "free" losses are the ones nobody reacts to.
 */
export const ResultSplitCard: React.FC<{ trades: Trade[]; symbol: string }> = ({
  trades,
  symbol,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const split = useMemo(() => {
    let wins = 0;
    let losses = 0;
    let be = 0;
    let beCost = 0;
    for (const tr of trades) {
      const r = tr.result;
      if (r === 'TP' || (r !== 'SL' && r !== 'BE' && (tr.pnl || 0) > 0)) wins++;
      else if (r === 'SL' || (r !== 'BE' && (tr.pnl || 0) < 0)) losses++;
      else {
        be++;
        beCost += tradeCost(tr);
      }
    }
    return { wins, losses, be, beCost };
  }, [trades]);

  const data = useMemo(
    () => [
      { label: t('gainsLabel'), value: split.wins, color: theme.colors.green },
      { label: t('lossesLabel'), value: split.losses, color: theme.colors.red },
      { label: t('beLabel'), value: split.be, color: theme.colors.primary },
    ],
    [split, t, theme]
  );

  if (trades.length === 0) return null;

  return (
    <Card title={t('gainLossSplit')}>
      <DonutChart data={data} size={150} centerLabel={String(trades.length)} centerSub="TRADES" />
      {split.be > 0 ? (
        <View style={styles.beRow}>
          <View style={[styles.beDot, { backgroundColor: theme.colors.primary }]} />
          <Text style={styles.beText}>
            {split.be === 1
              ? t('beCostLineOne', formatCurrency(split.beCost, { symbol, decimals: 2 }))
              : t('beCostLine', split.be, formatCurrency(split.beCost, { symbol, decimals: 2 }))}
          </Text>
        </View>
      ) : null}
    </Card>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    beRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.hairline,
    },
    beDot: { width: 6, height: 6, borderRadius: 3 },
    beText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
    },
  });
