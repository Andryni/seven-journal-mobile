import React, { useMemo, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { PressableScale } from '../ui/PressableScale';
import { AssetGlyph } from '../ui/AssetGlyph';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { localeFor, useT } from '../../i18n';
import { useMoney } from '../../features/accounts/useMoney';
import { useAccounts } from '../../features/accounts/useAccounts';
import { formatSize, unitForMarket, INSTRUMENTS } from '../../utils/positionSizing';
import { formatDuration } from '../../utils/formatDate';
import { outcomeVariant } from '../../utils/tradeOutcome';
import type { Trade } from '../../types/domain';

interface TradeBlotterRowProps {
  trade: Trade;
  /** Present wherever the row is tappable — Trades list and Dashboard preview. */
  onPress?: (trade: Trade) => void;
  /** Horizontal padding for panels that are flush (Dashboard) vs screen-scoped (Trades). */
  style?: StyleProp<ViewStyle>;
}

/**
 * One blotter row, everywhere a trade is listed.
 *
 * This used to live inline in TradesScreen and a simplified look-alike was
 * re-implemented on the Dashboard: same data, different weights, no asset
 * mark, no R multiple, no holding time. Two renderers for one concept drift
 * the moment either changes, so both screens now mount this one. The layout
 * reads like an execution report — instrument and context, R, P&L — with the
 * direction rail and the typographic asset mark as the only colour cues.
 */
export const TradeBlotterRow: React.FC<TradeBlotterRowProps> = ({
  trade,
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const money = useMoney();
  const { accounts } = useAccounts();
  const styles = useMemo(() => createStyles(theme), [theme]);

  /** Blotter sizes carry the unit of the account that traded them. */
  const unitFor = useCallback(
    (tr: Trade) => {
      const acc = accounts.find(a => a.id === tr.account_id);
      if (acc?.instrument_type) return unitForMarket(acc.instrument_type);
      return INSTRUMENTS[tr.pair]?.unit ?? 'lot';
    },
    [accounts]
  );

  const isOpen = trade.pnl === null;
  const pnlColor = isOpen
    ? theme.colors.textSecondary
    : (trade.pnl || 0) >= 0
    ? theme.colors.green
    : theme.colors.red;

  /**
   * Open positions keep a neutral rail: they have no outcome yet, and
   * colouring them green or red would assert a result that does not exist.
   */
  const railColor = isOpen
    ? theme.colors.textDark
    : {
        green: theme.colors.green,
        red: theme.colors.red,
        neutral: theme.colors.textMuted,
      }[outcomeVariant(trade)];

  return (
    <PressableScale
      style={[styles.row, style]}
      onPress={onPress ? () => onPress(trade) : undefined}
      accessibilityLabel={`${trade.pair} ${trade.direction}`}
      pressedScale={0.995}
    >
      {/* Outcome rail — how the trade ENDED, which is what you scan for.
          It used to repeat the direction, duplicating the BUY/SELL label two
          centimetres to its right while the one thing a blotter is scanned
          for -- did this win or lose -- had no left-edge cue at all. Driven
          by money, not by the stated exit reason, so a BE that banked a
          partial gain reads green rather than grey. */}
      <View style={[styles.rail, { backgroundColor: railColor }]} />

      {/* Asset mark — lets a row be identified by shape and colour before
          the ticker is read. Typographic, so no logo licensing. */}
      <AssetGlyph symbol={trade.pair} size={28} />

      {/* Col 1 — instrument + context */}
      <View style={styles.colMain}>
        <View style={styles.pairLine}>
          <Text style={styles.pair}>{trade.pair}</Text>
          <Text
            style={[
              styles.dir,
              {
                color:
                  trade.direction === 'BUY'
                    ? theme.colors.greenLight
                    : theme.colors.redLight,
              },
            ]}
          >
            {trade.direction}
          </Text>
        </View>
        <Text style={styles.meta} numberOfLines={1}>
          {new Date(trade.entry_time).toLocaleDateString(localeFor(lang), {
            day: '2-digit',
            month: '2-digit',
          })}
          {'  '}
          {new Date(trade.entry_time).toLocaleTimeString(localeFor(lang), {
            hour: '2-digit',
            minute: '2-digit',
          })}
          {trade.timeframe ? `  ${trade.timeframe}` : ''}
          {trade.size ? `  ${formatSize(trade.size, unitFor(trade))}` : ''}
          {/* Holding time belongs on the row: scanning the blotter is how
              you notice a "scalp" that was actually held for two days. */}
          {formatDuration(trade.entry_time, trade.exit_time, lang)
            ? `  ${formatDuration(trade.entry_time, trade.exit_time, lang)}`
            : ''}
        </Text>
      </View>

      {/* Col 2 — R multiple */}
      <Text
        style={[
          styles.colR,
          {
            color:
              trade.r_multiple === null
                ? theme.colors.textDark
                : trade.r_multiple >= 0
                ? theme.colors.textSecondary
                : theme.colors.textMuted,
          },
        ]}
      >
        {trade.r_multiple !== null
          ? `${trade.r_multiple >= 0 ? '+' : ''}${trade.r_multiple.toFixed(1)}R`
          : '—'}
      </Text>

      {/* Col 3 — P&L + outcome */}
      <View style={styles.colPnl}>
        <Text style={[styles.pnl, { color: pnlColor }]} numberOfLines={1}>
          {!isOpen ? money(trade.pnl!) : t('openTradeStatus')}
        </Text>
        <Text
          style={[
            styles.result,
            {
              // Driven by P&L, not by the label: a BE exit that banked a
              // partial gain was rendered in the same dead grey as a
              // scratch, hiding a winning trade in the blotter.
              color: {
                green: theme.colors.green,
                red: theme.colors.red,
                neutral: theme.colors.textDark,
              }[outcomeVariant(trade)],
            },
          ]}
        >
          {trade.result || (isOpen ? 'OPEN' : 'CLOSED')}
        </Text>
      </View>
    </PressableScale>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: theme.spacing.sm,
    },
    rail: {
      width: 3,
      height: 30,
      borderRadius: 1.5,
    },
    colMain: { flex: 1, marginLeft: 10 },
    pairLine: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 6,
    },
    pair: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.4,
    },
    dir: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    meta: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
      marginTop: 3,
    },
    colR: {
      width: 54,
      textAlign: 'right',
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoMedium,
      fontVariant: ['tabular-nums'],
    },
    colPnl: {
      width: 92,
      alignItems: 'flex-end',
    },
    pnl: {
      /**
       * Same size as the instrument and the R multiple beside it.
       *
       * P&L was metricSm (15) against body (12) and label (10), a five-point
       * spread inside one row, which made the blotter look ragged rather than
       * hierarchical. These three are scanned together, so they share a size
       * and are separated by weight and colour -- P&L stays extra-bold and
       * coloured, and still reads first.
       */
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    result: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
      marginTop: 2,
    },
  });
