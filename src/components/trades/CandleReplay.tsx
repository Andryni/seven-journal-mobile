import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  useWindowDimensions,
  Platform,
  Image,
  Pressable,
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import { History, RefreshCw, Camera } from 'lucide-react-native';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { PressableScale } from '../ui/PressableScale';
import { Panel } from '../ui/Panel';
import { useToast } from '../../store/toastStore';
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
 *
 * The chart can also be captured as a PNG (Svg.toDataURL — JS only, no native
 * module) and saved as the trade's after-screenshot: the replay is drawn from
 * the actual prices, so it is a more truthful "after" than a manual screenshot
 * that may arrive retouched.
 */
export const CandleReplay: React.FC<{
  trade: Trade;
  /** Called with the PNG data URI when the trader captures the chart. */
  onCapture?: (dataUri: string) => void;
}> = ({ trade, onCapture }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const toast = useToast();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();

  const [asked, setAsked] = useState(false);
  const [capturing, setCapturing] = useState(false);
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

  // The capture rasterizes the Svg itself, so the pixels must come from an
  // element that is actually mounted: with a transparent background the PNG
  // comes out black-on-black on some devices, hence the solid card-colored
  // wrapper. The image preview is hidden off-screen — not unmounted — for the
  // split second the capture runs, so Android's view hierarchy keeps it.
  const svgRef = useRef<React.ElementRef<typeof Svg> | null>(null);
  const [capturePreview, setCapturePreview] = useState<string | null>(null);

  const onAsk = async () => {
    try {
      await request.mutateAsync(trade.id);
    } catch {
      // A failed RPC leaves the button in place: the trader can try again, and
      // nothing was promised in the meantime.
    }
    setAsked(true);
  };

  const handleCapture = () => {
    const svg = svgRef.current;
    if (!svg || !onCapture || capturing) return;
    setCapturing(true);
    svg.toDataURL((dataUri: string) => {
      setCapturing(false);
      setCapturePreview(null);
      if (!dataUri || dataUri.length < 64) {
        toast.showError(t('replayCaptureFailed'));
        return;
      }
      // Svg.toDataURL returns raw base64 WITHOUT the `data:image/png;base64,`
      // prefix on every platform (the web implementation strips it explicitly).
      // React Native's Image cannot decode a bare base64 string, so gallery
      // tiles rendered as black squares. Wrap it into a complete data URI.
      const pngDataUri = dataUri.startsWith('data:') ? dataUri : `data:image/png;base64,${dataUri}`;
      onCapture(pngDataUri);
      toast.showSuccess(t('replayCaptured'));
    });
  };

  const up = theme.colors.green;
  const down = theme.colors.red;

  return (
    <Panel title={t('replayTitle')}>
      {geometry ? (
        <View>
          <View
            style={[styles.captureSurface, { backgroundColor: theme.colors.card }]}
            pointerEvents="none"
          >
            <Svg
              ref={svgRef}
              width={chartWidth}
              height={CHART_HEIGHT}
              testID="candle-replay-chart"
            >
              {/* Same solid background inside the rasterized PNG. */}
              <Rect x={0} y={0} width={chartWidth} height={CHART_HEIGHT} fill={theme.colors.card} />
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
            {capturePreview ? (
              <Image
                source={{ uri: capturePreview }}
                style={{ width: chartWidth, height: CHART_HEIGHT, position: 'absolute', left: -9999 }}
              />
            ) : null}
          </View>

          <Text style={styles.meta}>
            {t('replayMeta', String(candles?.bars.length ?? 0), candles?.timeframe ?? 'M1')}
          </Text>
          {candles?.truncated ? <Text style={styles.warn}>{t('replayTruncated')}</Text> : null}

          {onCapture ? (
            <Pressable
              onPress={handleCapture}
              disabled={capturing}
              accessibilityRole="button"
              accessibilityLabel={t('replayCapture')}
              style={({ pressed }) => [
                styles.captureBtn,
                (pressed || capturing) && styles.captureBtnActive,
              ]}
              testID="candle-replay-capture"
            >
              <Camera size={13} color={theme.colors.goldLight} strokeWidth={2} />
              <Text style={styles.captureBtnText}>
                {capturing ? t('replayCapturing') : t('replayCapture')}
              </Text>
            </Pressable>
          ) : null}
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
    captureSurface: {
      alignItems: 'flex-start',
      borderRadius: theme.borderRadius.sm,
      overflow: 'hidden',
    },
    captureBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.goldLight, 0.45),
      backgroundColor: withAlpha(theme.colors.goldLight, 0.08),
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    captureBtnActive: { opacity: 0.6 },
    captureBtnText: {
      color: theme.colors.goldLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
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
