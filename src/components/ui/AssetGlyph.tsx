import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { assetIdentity } from '../../utils/assetIdentity';

interface AssetGlyphProps {
  /** Instrument symbol, e.g. 'XAUUSD', 'ES', 'BTCUSD'. */
  symbol: string;
  size?: number;
}

/**
 * Typographic identity mark for an instrument.
 *
 * Replaces nothing today -- the blotter showed a bare ticker string -- and
 * adds scannability: at a glance a row is gold, an index or a crypto without
 * reading the text. Vector only, so there is no image to license, fetch or
 * cache. See utils/assetIdentity for why bitmap logos were rejected.
 */
export const AssetGlyph: React.FC<AssetGlyphProps> = ({ symbol, size = 30 }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const id = useMemo(() => assetIdentity(symbol), [symbol]);

  const TONES: Record<string, string> = {
    amber: theme.colors.primary,
    gold: theme.colors.gold,
    cyan: theme.colors.cyan,
    green: theme.colors.green,
    blue: theme.colors.cyan,
    neutral: theme.colors.textMuted,
  };
  const tone = TONES[id.tone] ?? theme.colors.textMuted;

  // Micros are the same product at 1/10 size; muting them keeps MES visually
  // subordinate to ES instead of competing with it.
  const opacity = id.isMicro ? 0.62 : 1;

  // Long glyphs ('SOL', 'NAS') need to step down or they overflow the circle.
  const fontSize =
    id.symbol.length >= 3 ? size * 0.34 : id.symbol.length === 2 ? size * 0.42 : size * 0.46;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: withAlpha(tone, 0.55),
          /**
           * Tinted fill, not a bare outline.
           *
           * A hairline ring on the card background made every instrument the
           * same shape in the corner of the eye; the whole point of the mark
           * is that a row is identifiable before the ticker is read. A soft
           * wash of the instrument's own tone gives it a silhouette at a
           * glance while staying far enough from the P&L colours that it is
           * never mistaken for a result.
           */
          backgroundColor: withAlpha(tone, 0.14),
          opacity,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={[styles.text, { color: tone, fontSize }]} numberOfLines={1}>
        {id.symbol}
      </Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    text: {
      fontFamily: theme.fonts.monoBold,
      letterSpacing: -0.2,
      includeFontPadding: false,
      textAlign: 'center',
    },
  });
