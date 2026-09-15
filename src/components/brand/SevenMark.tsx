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
}

/**
 * SevenMark — the brand mark, as geometry rather than a bitmap.
 *
 * The icons on disk are PNGs baked by tools/make_icons.py, which is the right
 * format for the launcher and the store: those slots only accept raster. But
 * inside the app a PNG is the wrong choice. It cannot take the current theme's
 * colours, it needs a separate file per density, it blurs when a screen wants
 * it larger than it was exported, and it cannot be animated per-element.
 *
 * The shapes here are the same ones make_icons.py draws, expressed on a 100x100
 * viewBox: a heavy 7, and three rising bars sitting in the empty triangle the
 * numeral creates. Nothing overlaps, so the silhouette still reads at 16px.
 */
export const SevenMark: React.FC<SevenMarkProps> = ({
  size = 40,
  color,
  accent,
  plate = false,
  plateColor,
  monochrome = false,
}) => {
  const { theme } = useTheme();
  const ink = color ?? theme.colors.primary;
  const tip = monochrome ? ink : (accent ?? theme.colors.green);
  const plateBg = plateColor ?? theme.colors.card;

  // Geometry, in viewBox units. Mirrors draw_mark(): inset 0.22 of the box,
  // stroke 0.155 of the inner width.
  const m = 14;
  const w = 72;
  const stroke = w * 0.155;
  const barY = m + w * 0.085;
  const topX = m + w;
  const botX = m + w * 0.52;
  const botY = m + w;

  const barW = w * 0.085;
  const gap = w * 0.048;
  const baseY = m + w * 0.97;
  const heights = [w * 0.15, w * 0.23, w * 0.31];

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
        {/* Top bar of the 7 */}
        <Rect
          x={m}
          y={barY}
          width={w}
          height={stroke}
          rx={stroke * 0.16}
          fill="url(#sevenInk)"
        />
        {/* Diagonal leg, as a quad so its junction with the bar stays crisp */}
        <Path
          d={`M ${topX - stroke} ${barY + stroke} L ${topX} ${barY + stroke} L ${botX} ${botY} L ${botX - stroke} ${botY} Z`}
          fill="url(#sevenInk)"
        />
        {/* Ascending bars — the journal's own subject, in the numeral's counter */}
        {heights.map((h, i) => (
          <Rect
            key={i}
            x={m + i * (barW + gap)}
            y={baseY - h}
            width={barW}
            height={h}
            rx={barW * 0.22}
            fill={i === heights.length - 1 ? tip : ink}
          />
        ))}
      </G>
    </Svg>
  );
};
