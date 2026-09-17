import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { Panel } from './Panel';
import { Sparkline } from './Sparkline';
import { PressableScale } from './PressableScale';

/**
 * SeriesStrip — the period-vs-period comparison, as two mini curves.
 *
 * The monthly review named the delta ("▼ -400 vs mois dernier") without ever
 * showing the shape behind it: a month that ground its way up through thirty
 * flat days and one good week reads exactly like a month that won everything
 * in trade one and bled afterwards. Side-by-side cumulative curves make the
 * shape the first thing you see; Sparkline already colours by direction, so
 * the verdict arrives preattentively.
 *
 * Optional chevrons let a caller reuse the strip as a navigator, but the
 * monthly review keeps them out of the header: navigation lives once, in the
 * hero, where it moves the whole review.
 */

export interface SeriesStripProps {
  title: string;
  /** Caption over the current-period half (e.g. "CE MOIS"). */
  leftCaption: string;
  /** Caption over the previous-period half (e.g. "MOIS DERNIER"). */
  rightCaption: string;
  /** Cumulative series for the current period; may be empty. */
  current: number[];
  /** Cumulative series for the previous period; may be empty. */
  previous: number[];
  /** Formatted net of the current period, e.g. "+1 240 $". */
  currentNet: string;
  /** Formatted net of the previous period. */
  previousNet: string;
  /** Sign of the current period, drives the value's colour. */
  currentPositive: boolean;
  /** Prev chevron; absent when there is no earlier period to show. */
  onPrev?: () => void;
  /** Next chevron; shown only while navigated away from the live period. */
  onNext?: () => void;
  prevA11yLabel?: string;
  nextA11yLabel?: string;
}

export const SeriesStrip: React.FC<SeriesStripProps> = ({
  title,
  leftCaption,
  rightCaption,
  current,
  previous,
  currentNet,
  previousNet,
  currentPositive,
  onPrev,
  onNext,
  prevA11yLabel,
  nextA11yLabel,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const accent = currentPositive ? theme.colors.green : theme.colors.red;

  return (
    <Panel
      title={title}
      action={
        onPrev || onNext ? (
          <View style={styles.navRow}>
            {onPrev ? (
              <PressableScale
                onPress={onPrev}
                hitSlop={10}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel={prevA11yLabel}
                testID="series-strip-prev"
              >
                <ChevronLeft size={14} color={theme.colors.textPrimary} strokeWidth={2.2} />
              </PressableScale>
            ) : null}
            {onNext ? (
              <PressableScale
                onPress={onNext}
                hitSlop={10}
                style={styles.navBtn}
                accessibilityRole="button"
                accessibilityLabel={nextA11yLabel}
                testID="series-strip-next"
              >
                <ChevronRight size={14} color={theme.colors.textPrimary} strokeWidth={2.2} />
              </PressableScale>
            ) : null}
          </View>
        ) : null
      }
    >
      <View style={styles.stripRow}>
        <SeriesHalf
          styles={styles}
          caption={leftCaption}
          net={currentNet}
          netColor={accent}
          data={current}
        />
        <View style={styles.divider} />
        <SeriesHalf
          styles={styles}
          caption={rightCaption}
          net={previousNet}
          netColor={theme.colors.textSecondary}
          data={previous}
        />
      </View>
    </Panel>
  );
};

const SeriesHalf: React.FC<{
  styles: ReturnType<typeof createStyles>;
  caption: string;
  net: string;
  netColor: string;
  data: number[];
}> = ({ styles, caption, net, netColor, data }) => (
  <View style={styles.half}>
    <Text style={styles.caption} numberOfLines={1}>
      {caption}
    </Text>
    {data.length > 1 ? (
      <Sparkline data={data} baseline={0} width={104} height={34} strokeWidth={1.6} />
    ) : (
      <View style={styles.noSeries}>
        <Text style={styles.noSeriesText}>—</Text>
      </View>
    )}
    <Text style={[styles.net, { color: netColor }]} numberOfLines={1}>
      {net}
    </Text>
  </View>
);

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    navRow: { flexDirection: 'row', gap: 6 },
    navBtn: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stripRow: { flexDirection: 'row', alignItems: 'stretch', gap: theme.spacing.md },
    half: { flex: 1, alignItems: 'flex-start', gap: 5 },
    caption: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.1,
    },
    noSeries: { width: 104, height: 34, justifyContent: 'center' },
    noSeriesText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
    },
    net: {
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    divider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.colors.hairline },
  });
