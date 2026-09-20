import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { History, RefreshCw } from 'lucide-react-native';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { PressableScale } from '../ui/PressableScale';
import { Panel } from '../ui/Panel';
import {
  buildCandleChart,
  tradeMarkers,
  type MarkerTone,
} from '../../utils/candleChart';
import { useRequestCandles, useTradeCandles } from '../../features/sync/useTradeCandles';
import type { Trade } from '../../types/domain';

const CHART_HEIGHT = 190;
/** While a request is in flight the terminal answers on its next heartbeat. */
const WAIT_POLL_MS = 20_000;

function toneColor(theme: AppTheme, tone: MarkerTone): string {
  switch (tone) {
    case 'stop':
      return theme.colors.red;
    case 'target':
      return theme.colors.green;
    case 'entry':
      return theme.colors.primaryLight;
    case 'exit':
      return theme.colors.textPrimary;
    case 'mae':
    case 'mfe':
      return theme.colors.textMuted;
  }
}

/**
 * The trade, drawn from the terminal's own candles.
 *
 * Everything else in this app describes a trade in numbers — a P&L, an R, an
 * MAE, an MFE. All of it is derived, and none of it shows the shape of what
 * happened. This is the one surface that answers the questions a trader
 * actually asks about a finished trade: was the stop inside the noise? did I
 * exit into the first pullback? did I enter three candles early?
 *
 * The candles come from the same terminal that reported the trade (see
 * schema.sql SECTION 9), on demand, once. So the honest states are exactly
 * these four, and there is no fallback that would draw a chart of something
 * else: they are here, they have been asked for, they cannot be asked for, or
 * the terminal has no history left to give.
 */
export const CandleReplay: React.FC<{ trade: Trade }> = ({ trade }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();

  const [asked, setAsked] = useState(false);
  const { candles, refetch } = useTradeCandles(trade.id, {
    enabled: true,
    pollMs: asked ? WAIT_POLL_MS : undefined,
  });
  const request = useRequestCandles();

  const markers = useMemo(
    () =>
      tradeMarkers({
        direction: trade.direction,
        entry_price: trade.entry_price,
        stop_loss: trade.stop_loss,
        take_profit: trade.take_profit,
        exit_price: trade.exit_price,
        mae_price: trade.mae_price,
        mfe_price: trade.mfe_price,
      }),
    [trade]
  );

  const chartWidth = Math.max(160, width - 2 * theme.spacing.lg - 2 * theme.spacing.md);

  const geometry = useMemo(
    () =>
      candles
        ? buildCandleChart({
            bars: candles.bars,
            markers,
            width: chartWidth,
            height: CHART_HEIGHT,
            padding: 8,
          })
        : null,
    [candles, markers, chartWidth]
  );

  const onAsk = async () => {
    try {
      await request.mutateAsync(trade.id);
    } catch {
      // A failed RPC leaves the button in place: the trader can try again, and
      // nothing was promised in the meantime.
    }
    setAsked(true);
  };

  const up = theme.colors.green;
  const down = theme.colors.red;

  return (
    <Panel title={t('replayTitle')}>
      {geometry ? (
        <View>
          <Svg width={chartWidth} height={CHART_HEIGHT} testID="candle-replay-chart">
            {geometry.candles.map((c, i) => (
              <React.Fragment key={`c${i}`}>
                <Line
                  x1={c.wickX}
                  y1={c.wickTop}
                  x2={c.wickX}
                  y2={c.wickBottom}
                  stroke={c.up ? up : down}
                  strokeWidth={1}
                />
                <Rect
                  x={c.x}
                  y={c.bodyY}
                  width={c.bodyWidth}
                  height={c.bodyHeight}
                  fill={c.up ? up : down}
                />
              </React.Fragment>
            ))}
            {geometry.markers.map((m, i) => {
              const color = toneColor(theme, m.tone);
              return (
                <React.Fragment key={`m${i}`}>
                  <Line
                    x1={0}
                    y1={m.y}
                    x2={chartWidth}
                    y2={m.y}
                    stroke={color}
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <SvgText x={3} y={Math.max(9, m.y - 3)} fill={color} fontSize={9}>
                    {m.label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>

          <Text style={styles.meta}>
            {t('replayMeta', String(candles?.bars.length ?? 0), candles?.timeframe ?? 'M1')}
          </Text>
          {candles?.truncated ? <Text style={styles.warn}>{t('replayTruncated')}</Text> : null}
        </View>
      ) : (
        <View>
          {/* The two sentences have to differ: "not asked yet" is actionable,
              and "no history left" is not. Same button, different promise. */}
          <Text style={styles.hint}>{asked ? t('replayWaiting') : t('replayAskHint')}</Text>

          <PressableScale
            style={[styles.btn, request.isPending && styles.btnOff]}
            onPress={asked ? () => refetch() : onAsk}
            disabled={request.isPending}
            accessibilityRole="button"
            accessibilityLabel={asked ? t('replayCheck') : t('replayAsk')}
          >
            {asked ? (
              <RefreshCw size={13} color={theme.colors.primaryLight} strokeWidth={2} />
            ) : (
              <History size={13} color={theme.colors.primaryLight} strokeWidth={2} />
            )}
            <Text style={styles.btnText}>{asked ? t('replayCheck') : t('replayAsk')}</Text>
          </PressableScale>
        </View>
      )}
    </Panel>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    hint: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      lineHeight: 16,
      marginBottom: theme.spacing.md,
    },
    warn: {
      color: theme.colors.gold,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: theme.spacing.xs,
    },
    meta: {
      color: theme.colors.textDark,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      marginTop: theme.spacing.xs,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.primaryLight, 0.5),
      backgroundColor: withAlpha(theme.colors.primaryLight, 0.08),
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
    },
    btnOff: { opacity: 0.6 },
    btnText: {
      color: theme.colors.primaryLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
  });
