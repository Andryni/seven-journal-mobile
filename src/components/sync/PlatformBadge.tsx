import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

// Bundled asset modules resolve through Metro's require; the returned
// number is the RN asset reference the Image source expects.
const MT5_LOGO = require('../../../assets/platforms/mt5.png');
const CTRADER_LOGO = require('../../../assets/platforms/ctrader.png');

/**
 * Platform identity for a sync connector.
 *
 * MT5 and cTrader render the vendors' own logos (bundled PNGs — the user
 * supplied them; they scale cleanly at 34 px on every density since the
 * sources are 225/447 px). CSV and API keep their text tiles.
 *
 * The sync-status dot is NOT part of this component — screens overlay it so
 * the semantics (ok/error/never) stay theirs.
 */

export type PlatformKind = 'mt5' | 'mt4' | 'ctrader' | 'csv' | 'api';

const FALLBACK_BG: Record<Exclude<PlatformKind, 'csv' | 'api'>, string> = {
  mt5: '#2C5AA0',
  mt4: '#8B8B92',
  ctrader: '#DE5124',
};

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

  if (kind === 'csv' || kind === 'api') {
    return (
      <View style={[styles.badge, { backgroundColor: theme.colors.card, borderRadius: size * 0.264 }]}>
        <Text style={[styles.textGlyph, { color: theme.colors.textMuted }]}>
          {kind === 'csv' ? 'CSV' : 'API'}
        </Text>
      </View>
    );
  }

  const label = kind === 'mt5' ? 'MT5' : kind === 'mt4' ? 'MT4' : 'cTrader';
  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: FALLBACK_BG[kind], borderRadius: size * 0.264 },
      ]}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      {/* mt4 has no supplied asset: it shows the cTrader-independent MT4
          fallback tile with the plain "MT4" glyph instead of an image. */}
      {kind === 'mt4' ? (
        <Text style={[styles.textGlyph, { color: '#FFFFFF' }]}>4</Text>
      ) : (
        <Image
          source={kind === 'mt5' ? MT5_LOGO : CTRADER_LOGO}
          style={styles.image}
          resizeMode="cover"
          accessibilityLabel={label}
        />
      )}
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
    image: { width: '100%', height: '100%' },
    textGlyph: {
      fontSize: size * 0.3,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
  });
