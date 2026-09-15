import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, withDelay } from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { duration, easing } from '../../theme/motion';
import { maeR, mfeR, realisedR } from '../../utils/excursions';
import type { Trade } from '../../types/domain';

/**
 * The path of a single trade, drawn on one axis in R.
 *
 * A number like "MFE 3.0R" is abstract; seeing the exit marker sitting a third
 * of the way along the green run makes the giving-back obvious at a glance.
 * The axis is centred on entry (0R): red extends left to the worst excursion,
 * green right to the best, and a marker shows where the trade actually closed.
 */
export const ExcursionBar: React.FC<{ trade: Trade }> = ({ trade }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const mae = maeR(trade);
  const mfe = mfeR(trade);
  const realised = realisedR(trade);

  const grow = useSharedValue(0);
  useEffect(() => {
    grow.value = withDelay(
      duration.fast,
      withTiming(1, { duration: duration.slow, easing: easing.out })
    );
  }, [grow, trade.id]);

  // Symmetric scale so 1R left and 1R right are the same width: an asymmetric
  // axis would make a small adverse move look as dramatic as a large gain.
  const span = Math.max(1, Math.abs(mae ?? 0), Math.abs(mfe ?? 0), Math.abs(realised ?? 0));

  /**
   * Percentages are computed HERE, on the JS thread, and captured as plain
   * numbers by the worklets below.
   *
   * A worklet runs on the UI runtime and can only call functions that were
   * themselves workletised. Calling a normal JS closure from inside one throws
   * "[Worklets] Tried to synchronously call a Remote Function" at the first
   * frame -- which is exactly what a helper like `pct(mae)` did here.
   */
  const adversePct = (Math.abs(mae ?? 0) / span) * 50;
  const favourablePct = (Math.abs(mfe ?? 0) / span) * 50;
  const realisedPct = (Math.abs(realised ?? 0) / span) * 50;

  const adverseStyle = useAnimatedStyle(() => ({
    width: `${adversePct * grow.value}%`,
  }));
  const favourableStyle = useAnimatedStyle(() => ({
    width: `${favourablePct * grow.value}%`,
  }));
  const markerStyle = useAnimatedStyle(() => ({
    opacity: grow.value,
  }));

  if (mae === null && mfe === null) return null;

  const realisedOffset =
    realised === null ? null : 50 + (realised >= 0 ? realisedPct : -realisedPct);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('excPath')}</Text>

      <View style={styles.track}>
        {/* Entry sits at the centre; everything is measured from it. */}
        <View style={styles.zeroLine} />
        <View style={styles.half}>
          <Animated.View style={[styles.adverse, adverseStyle]} />
        </View>
        <View style={styles.half}>
          <Animated.View style={[styles.favourable, favourableStyle]} />
        </View>
        {realisedOffset !== null && (
          <Animated.View
            style={[styles.marker, markerStyle, { left: `${realisedOffset}%` }]}
          />
        )}
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendRed}>
          {mae !== null ? `${t('excMae')} -${mae.toFixed(2)}R` : `${t('excMae')} —`}
        </Text>
        {realised !== null && (
          <Text style={styles.legendNeutral}>
            {t('excExit')} {realised >= 0 ? '+' : ''}
            {realised.toFixed(2)}R
          </Text>
        )}
        <Text style={styles.legendGreen}>
          {mfe !== null ? `${t('excMfe')} +${mfe.toFixed(2)}R` : `${t('excMfe')} —`}
        </Text>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    title: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.7,
      marginBottom: 10,
    },
    track: {
      flexDirection: 'row',
      height: 14,
      borderRadius: 4,
      backgroundColor: theme.colors.surfaceLight,
      overflow: 'hidden',
    },
    half: { flex: 1, flexDirection: 'row' },
    // The adverse half fills from the centre leftwards.
    adverse: {
      height: '100%',
      backgroundColor: theme.colors.red,
      alignSelf: 'flex-end',
    },
    favourable: {
      height: '100%',
      backgroundColor: theme.colors.green,
    },
    zeroLine: {
      position: 'absolute',
      left: '50%',
      top: 0,
      bottom: 0,
      width: 1,
      backgroundColor: theme.colors.textMuted,
      zIndex: 2,
    },
    marker: {
      position: 'absolute',
      top: -3,
      width: 2,
      height: 20,
      marginLeft: -1,
      borderRadius: 1,
      backgroundColor: theme.colors.textPrimary,
      zIndex: 3,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    legendRed: {
      color: theme.colors.red,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
    },
    legendGreen: {
      color: theme.colors.green,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
    },
    legendNeutral: {
      color: theme.colors.textPrimary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
    },
  });
