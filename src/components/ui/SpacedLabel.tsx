import React from 'react';
import { Text, TextProps } from 'react-native';

interface SpacedLabelProps extends TextProps {
  /** Font size of the label. */
  fontSize: number;
  /** Mono family (bold or regular) — matches the app's label convention. */
  fontFamily: string;
  /** Letter spacing in dp. The trailing-gap compensation is derived from it. */
  letterSpacing: number;
}

/**
 * A letter-spaced label that cannot lose its last letter.
 *
 * THE BUG, once and for all: Android measures letterSpacing between glyphs
 * but does NOT include the trailing gap after the final glyph in the text's
 * measured width. A centered or constrained Text therefore lays out N glyphs
 * plus (N-1) gaps, and the last letter lands outside the measured box — the
 * clip then removes it. That is the recurring "the L of JOURNAL", "the L of
 * TERMINAL" reports: whichever spaced label had no compensation lost its
 * tail, one surface at a time.
 *
 * The fix has always been the same one-liner (pad the measured box by the
 * trailing gap, like TopAccountBar and BrandWordmark already do). This
 * component exists so it is APPLIED, not re-remembered: every spaced label
 * goes through here, and the padding is derived from the spacing itself —
 * there is no second place to get it wrong.
 *
 * Right-padding of letterSpacing * 1.25 mirrors BrandWordmark's factor: it
 * fully covers the gap at every spacing used in the app (0.8..3.4) without
 * visibly offsetting centered text.
 */
export const SpacedLabel: React.FC<SpacedLabelProps> = ({
  fontSize,
  fontFamily,
  letterSpacing,
  style,
  children,
  ...rest
}) => {
  return (
    <Text
      {...rest}
      style={[
        {
          fontSize,
          fontFamily,
          letterSpacing,
          // Books the trailing gap Android does not measure. Applied after
          // ...rest merges, before `style`, so a caller style can still
          // override colours but not accidentally drop the compensation
          // (it would have to re-declare paddingRight deliberately).
          paddingRight: letterSpacing * 1.25,
        },
        style,
      ]}
    >
      {children}
    </Text>
  );
};
