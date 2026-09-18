import React from 'react';
import { Text, TextProps } from 'react-native';

interface BrandWordmarkProps extends TextProps {
  /** Font size of both words. */
  fontSize: number;
  /** Letter spacing, applied identically to both words. */
  letterSpacing?: number;
  /** Font family of the whole wordmark. */
  fontFamily: string;
  /** Colour of "SEVEN" (defaults to the inherited text colour). */
  primaryColor?: string;
  /** Colour of "JOURNAL". */
  accentColor?: string;
}

/**
 * The two-word brand, rendered so "JOURNAL" cannot vanish on its own.
 *
 * Four screens (boot, auth, reset-password, top bar) each hand-rolled a
 * "SEVEN " + "JOURNAL" pair of sibling Texts in a row. Sibling texts are
 * laid out independently: when the container narrows, a font settles late
 * or the row is squeezed, React Native wraps the second word to a line the
 * container clips — the accent word silently disappears, which is exactly
 * the intermittent "only SEVEN shows" report on the boot screen.
 *
 * Nested Texts inside ONE parent with numberOfLines={1} are laid out as a
 * single line: the two words are inseparable, and an over-narrow container
 * degrades visibly (ellipsis) instead of hiding the brand half-way.
 */
export const BrandWordmark: React.FC<BrandWordmarkProps> = ({
  fontSize,
  letterSpacing = 2,
  fontFamily,
  primaryColor,
  accentColor,
  style,
  ...rest
}) => {
  return (
    <Text
      numberOfLines={1}
      {...rest}
      // Android measures letterSpacing per glyph but not the trailing gap,
      // so the LAST letter (the "L" of JOURNAL) can fall outside the
      // measured width and get clipped. The padding books that gap.
      // Applied after ...rest so a caller style cannot drop it.
      style={[
        { fontSize, fontFamily, letterSpacing, paddingRight: letterSpacing * 1.25 },
        style,
      ]}
    >
      <Text style={primaryColor ? { color: primaryColor } : undefined}>SEVEN </Text>
      <Text style={accentColor ? { color: accentColor } : undefined}>JOURNAL</Text>
    </Text>
  );
};
