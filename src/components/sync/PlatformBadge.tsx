import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

/**
 * Platform identity for a sync connector.
 *
 * The real MT5/cTrader logos are trademarked, so these are hand-drawn vector
 * monograms in each brand's colour: MetaTrader's orange with the MT5
 * "5"-glyph, cTrader's green with its double-c mark. Drawn with react-native-svg
 * (already in the dependency tree) rather than raster assets: they scale on
 * every density and stay crisp in dark mode.
 *
 * The sync-status dot is NOT part of this component — screens overlay it so
 * the semantics (ok/error/never) stay theirs.
 */

export type PlatformKind = 'mt5' | 'mt4' | 'ctrader' | 'csv' | 'api';

// Brand approximations, deliberate: close enough to be recognised, not
// claimed as the vendors' assets.
const BRAND = {
  mt5: '#F07E1F',
  mt4: '#D9D9DE',
  ctrader: '#22B573',
} as const;

const SIZE = 34;

export const platformKind = (p: string): PlatformKind => {
  switch (p) {
    case 'mt5_ea':
      return 'mt5';
    case 'mt4_ea':
      return 'mt4';
    case 'ctrader':
      return 'ctrader';
    case 'csv_mt5':
    case 'csv_generic':
      return 'csv';
    default:
      return 'api';
  }
};

interface Props {
  platform: string;
  size?: number;
}

export const PlatformBadge: React.FC<Props> = ({ platform, size = SIZE }) => {
  const { theme } = useTheme();
  const styles = makeStyles(theme, size);
  const kind = platformKind(platform);
  const bg = kind === 'csv' ? theme.colors.card : BRAND[kind as keyof typeof BRAND] ?? BRAND.mt5;
  const radius = size * 0.264;

  const glyph = (() => {
    if (kind === 'mt5' || kind === 'mt4') {
      // Stylised "5" (MetaTrader's wordmark glyph): down-stroke, mid bar.
      return (
        <Path
          d={`M ${size * 0.44} ${size * 0.34} L ${size * 0.44} ${size * 0.58} L ${size * 0.66} ${size * 0.58}`}
          stroke={kind === 'mt5' ? '#FFFFFF' : '#17181C'}
          strokeWidth={size * 0.09}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      );
    }
    if (kind === 'ctrader') {
      // cTrader's double-c: an open ring and its core dot.
      return (
        <>
          <Path
            d={`M ${size * 0.66} ${size * 0.38} A ${size * 0.16} ${size * 0.16} 0 1 0 ${size * 0.66} ${size * 0.62}`}
            stroke="#FFFFFF"
            strokeWidth={size * 0.085}
            strokeLinecap="round"
            fill="none"
          />
          <Circle cx={size * 0.42} cy={size * 0.5} r={size * 0.062} fill="#FFFFFF" />
        </>
      );
    }
    if (kind === 'csv') {
      return (
        <Text style={[styles.textGlyph, { color: theme.colors.textMuted }]}>CSV</Text>
      );
    }
    return <Text style={[styles.textGlyph, { color: theme.colors.primary }]}>API</Text>;
  })();

  if (kind === 'csv' || kind === 'api') {
    return <View style={[styles.badge, { backgroundColor: bg, borderRadius: radius }]}>{glyph}</View>;
  }

  return (
    <View
      style={[styles.badge, { backgroundColor: bg, borderRadius: radius }]}
      accessibilityRole="image"
      accessibilityLabel={kind === 'mt5' ? 'MT5' : kind === 'mt4' ? 'MT4' : 'cTrader'}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {glyph}
      </Svg>
    </View>
  );
};

const makeStyles = (theme: AppTheme, size: number) =>
  StyleSheet.create({
    badge: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    textGlyph: {
      fontSize: size * 0.3,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
  });
