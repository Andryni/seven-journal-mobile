import React from 'react';
import Svg, { Path, Rect, Defs, LinearGradient, Stop, G } from 'react-native-svg';
import { useTheme } from '../../theme';

interface SevenMarkProps {
  size?: number;
  /** Main ink colour. Defaults to the theme's primary. */
  color?: string;
  /** Colour of the tallest bar. Defaults to the theme's green. */
  accent?: string;
  /** Draw the rounded app-icon plate behind the mark. */
  plate?: boolean;
  plateColor?: string;
  /** Flatten to a single colour (share sheets, watermarks, disabled states). */
  monochrome?: boolean;
  /**
   * Draw the candlesticks and grid. Defaults to on above 28px and off below,
   * where the detail would only alias.
   */
  scene?: boolean;
}

/**
 * SevenMark — the brand mark, as geometry rather than a bitmap.
 *
 * Same construction as make_icons.py's draw_mark(), on a 100x100 viewBox: a
 * seven standing on a green rule, with candlesticks printing across it. The
 * candles inside the diagonal are shaded toward the plate so they recede, and
 * the foreground series carries a plate-coloured keyline so the green never
 * dissolves into the amber behind it.
 *
 * `scene={false}` drops the candles and grid and leaves the numeral on its
 * rule. Below roughly 28px the candle bodies stop being candles and turn into
 * noise, so small placements keep the silhouette and lose the detail rather
 * than rendering a smudge.
 *
 * Vector, not a PNG: it takes the current theme's colours, needs no
 * per-density export, stays sharp at any size and can be animated per element.
 */
export const SevenMark: React.FC<SevenMarkProps> = ({
  size = 40,
  color,
  accent,
  plate = false,
  plateColor,
  monochrome = false,
  scene: sceneProp,
}) => {
  const { theme } = useTheme();
  const ink = color ?? theme.colors.primary;
  const rule = monochrome ? ink : (accent ?? theme.colors.green);
  const up = monochrome ? ink : theme.colors.green;
  const down = monochrome ? ink : theme.colors.red;
  const plateBg = plateColor ?? theme.colors.background;

  // Detail is pointless once the candles are a couple of pixels wide.
  const scene = (sceneProp ?? size >= 28) && !monochrome;

  // Geometry in viewBox units, mirroring draw_mark() at inset 0.14.
  const m = 14;
  const w = 100 - m * 2;
  const X = (f: number) => m + w * f;
  const Y = (f: number) => m + w * f;

  const stroke = w * 0.154;
  const baseY = Y(1.02);
  const baseH = w * 0.04;

  const bw = w * 0.084;
  const kw = w * 0.022;
  const wickW = w * 0.024;

  /** Ink mixed toward the plate, so a candle behind the 7 reads as depth. */
  const recede = (f: number) => (monochrome ? ink : ink);

  const backCandles = [
    { cx: 0.6, top: 0.42, bot: 0.68, o: 0.4 },
    { cx: 0.72, top: 0.3, bot: 0.56, o: 0.52 },
    { cx: 0.83, top: 0.18, bot: 0.44, o: 0.64 },
  ];

  const frontCandles = [
    { cx: 0.4, top: 0.6, bot: 1.02, wt: 0.53, wb: 1.02, col: up },
    { cx: 0.55, top: 0.68, bot: 1.02, wt: 0.61, wb: 1.02, col: up },
    { cx: 0.69, top: 0.76, bot: 0.88, wt: 0.69, wb: 0.96, col: down },
    { cx: 0.83, top: 0.5, bot: 1.02, wt: 0.43, wb: 1.02, col: up },
  ];

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="sevenInk" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={ink} stopOpacity="1" />
          <Stop offset="1" stopColor={ink} stopOpacity="0.82" />
        </LinearGradient>
      </Defs>

      {plate ? <Rect x="0" y="0" width="100" height="100" rx="22" fill={plateBg} /> : null}

      <G>
        {/* Faint chart rules behind everything. */}
        {scene
          ? [0.18, 0.46, 0.74].map(gx => (
              <Rect
                key={`v${gx}`}
                x={X(gx)}
                y={Y(0.02)}
                width={w * 0.006}
                height={w * 0.96}
                fill={theme.colors.textMuted}
                opacity={0.16}
              />
            ))
          : null}
        {scene
          ? [0.22, 0.52, 0.82].map(gy => (
              <Rect
                key={`h${gy}`}
                x={X(0.02)}
                y={Y(gy)}
                width={w * 0.96}
                height={w * 0.006}
                fill={theme.colors.textMuted}
                opacity={0.16}
              />
            ))
          : null}

        {/* The numeral. */}
        <Path
          d={`M ${X(0.04)} ${Y(0.06)} L ${X(0.92)} ${Y(0.06)} L ${X(0.35)} ${Y(0.94)}`}
          stroke="url(#sevenInk)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* Candles climbing the diagonal, behind the foreground series. */}
        {scene
          ? backCandles.map(c => (
              <G key={`b${c.cx}`} opacity={c.o}>
                <Rect
                  x={X(c.cx) - w * 0.008}
                  y={Y(c.top - 0.07)}
                  width={w * 0.016}
                  height={Y(c.bot + 0.07) - Y(c.top - 0.07)}
                  fill={recede(c.o)}
                />
                <Rect
                  x={X(c.cx) - w * 0.026}
                  y={Y(c.top)}
                  width={w * 0.052}
                  height={Y(c.bot) - Y(c.top)}
                  fill={recede(c.o)}
                />
              </G>
            ))
          : null}

        {/* Foreground series: keyline, then the shape over it. */}
        {scene
          ? frontCandles.map(c => (
              <G key={`f${c.cx}`}>
                <Rect
                  x={X(c.cx) - (wickW + kw) / 2}
                  y={Y(c.wt)}
                  width={wickW + kw}
                  height={Y(c.wb) - Y(c.wt)}
                  fill={plateBg}
                />
                <Rect
                  x={X(c.cx) - wickW / 2}
                  y={Y(c.wt)}
                  width={wickW}
                  height={Y(c.wb) - Y(c.wt)}
                  fill={c.col}
                />
                <Rect
                  x={X(c.cx) - bw / 2 - kw / 2}
                  y={Y(c.top) - kw / 2}
                  width={bw + kw}
                  height={Y(c.bot) - Y(c.top) + kw}
                  fill={plateBg}
                />
                <Rect
                  x={X(c.cx) - bw / 2}
                  y={Y(c.top)}
                  width={bw}
                  height={Y(c.bot) - Y(c.top)}
                  fill={c.col}
                />
              </G>
            ))
          : null}

        {/* The baseline everything stands on. */}
        <Rect
          x={X(-0.02)}
          y={baseY}
          width={X(1.02) - X(-0.02)}
          height={baseH}
          rx={baseH / 2}
          fill={rule}
        />
      </G>
    </Svg>
  );
};
