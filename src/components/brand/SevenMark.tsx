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
 * Same geometry as make_icons.py's draw_mark(), on a 100x100 viewBox: a heavy
 * seven drawn as one round-capped stroke, standing on a green baseline. The
 * rule is the axis the figure stands on, which is what makes the numeral read
 * as a value on a chart instead of a digit with an ornament — and, unlike the
 * ascending bars it replaces, it never collides with the glyph at small sizes.
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
  const rule = monochrome ? ink : (accent ?? theme.colors.green);
  const plateBg = plateColor ?? theme.colors.card;

  // Geometry in viewBox units, mirroring draw_mark() at inset 0.22.
  const m = 22;
  const w = 100 - m * 2;
  const stroke = w * 0.175;

  const yTop = m + w * 0.04;
  const xFoot = m + w * 0.4;
  const yFoot = m + w * 0.78;

  const baseH = w * 0.075;
  const baseY = m + w * 0.93;

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
        {/* The seven: one continuous stroke, round joins, no seams. */}
        <Path
          d={`M ${m} ${yTop} L ${m + w} ${yTop} L ${xFoot} ${yFoot}`}
          stroke="url(#sevenInk)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* The baseline it stands on. */}
        <Rect
          x={m}
          y={baseY}
          width={w}
          height={baseH}
          rx={baseH / 2}
          fill={rule}
        />
      </G>
    </Svg>
  );
};
