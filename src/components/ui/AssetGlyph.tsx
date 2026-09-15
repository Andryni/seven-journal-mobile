import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
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
          borderColor: tone,
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
      borderWidth: StyleSheet.hairlineWidth * 2,
      backgroundColor: theme.colors.surface,
    },
    text: {
      fontFamily: theme.fonts.monoBold,
      letterSpacing: -0.2,
      includeFontPadding: false,
      textAlign: 'center',
    },
  });
