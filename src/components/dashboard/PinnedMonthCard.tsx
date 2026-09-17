import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Share2,
} from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT, localeFor } from '../../i18n';
import { Panel } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { Sparkline } from '../ui/Sparkline';
import { selectTrades, computeShareStats } from '../../utils/shareScope';
import { startOfWeek } from '../../utils/shareScope';
import { cumulativePnlSeries } from '../../features/analytics/periodReview';
import { duration } from '../../theme/motion';
import type { Trade } from '../../types/domain';

/**
 * PinnedMonthCard — the export shortcut, sitting on the dashboard.
 *
 * The month card was one tap deep (share button → period "month") for the one
 * export most traders repeat. Pinned to the cockpit it becomes one tap total:
 * the card shows the month at a glance and its share button opens the regular
 * ShareCardModal already set to the month scope, so the exported image stays
 * THE card — this is a shortcut to it, never a second copy of it.
 *
 * The chevrons page the card back through past months exactly like the
 * monthly review does: an export of "the month" means the month you are
 * looking at, so the modal receives the anchor too. The forward arrow only
 * reappears once navigated, and the back arrow disappears at the journal's
 * first month so the card never offers a month of zeros.
 *
 * Hidden entirely while off (a card nobody pinned is scroll noise), and the
 * mini curve is the month's cumulative P&L — the same shape the export
 * carries, so the shortcut previews its own output.
 */
export const PinnedMonthCard: React.FC<{
  trades: Trade[];
  formatMoney: (n: number) => string;
  onShare: (anchor: Date) => void;
  /** Persisted through usePinnedCards; Settings owns the re-arm control. */
  onUnpin: () => void;
}> = ({ trades, formatMoney, onShare, onUnpin }) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const now = useMemo(() => new Date(), []);
  const [monthsBack, setMonthsBack] = useState(0);
  const anchor = useMemo(
    () => new Date(now.getFullYear(), now.getMonth() - monthsBack, 1),
    [now, monthsBack]
  );

  const scoped = useMemo(
    () => selectTrades(trades, 'month', { now: anchor }),
    [trades, anchor]
  );
  const stats = useMemo(() => computeShareStats(scoped), [scoped]);

  /** First closed month in the journal: the back arrow's hard stop. */
  const firstMonthStart = useMemo(() => {
    let first: number | null = null;
    for (const tr of trades) {
      if (tr.pnl === null || tr.pnl === undefined) continue;
      const raw = tr.exit_time || tr.entry_time;
      if (!raw) continue;
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) continue;
      const ts = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
      if (first === null || ts < first) first = ts;
    }
    return first;
  }, [trades]);

  /** A month before the anchor exists in the journal only if it holds trades. */
  const canGoPrev =
    firstMonthStart !== null &&
    new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1).getTime() >= firstMonthStart;

  /** Cumulative curve for the card's sparkline: same buckets the export uses. */
  const cum = useMemo(
    () =>
      cumulativePnlSeries(
        scoped,
        new Date(anchor.getFullYear(), anchor.getMonth(), 1),
        new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)
      ),
    [scoped, anchor]
  );

  if (stats.trades.length === 0 && monthsBack === 0) return null;

  const accent = stats.netPnl >= 0 ? theme.colors.green : theme.colors.red;
  const monthLabel = anchor.toLocaleDateString(localeFor(lang), {
    month: 'long',
    year: 'numeric',
  });

  return (
    <Animated.View entering={FadeIn.duration(duration.base)}>
      <Panel
        title={t('pinnedMonthTitle')}
        action={
          <View style={styles.headerActions}>
            <PressableScale
              style={styles.headerBtn}
              onPress={() => onShare(anchor)}
              accessibilityRole="button"
              accessibilityLabel={t('scExportShare')}
              hitSlop={8}
              testID="pinned-month-share"
            >
              <Share2 size={13} color={theme.colors.primary} strokeWidth={1.9} />
            </PressableScale>
            <PressableScale
              style={styles.headerBtn}
              onPress={onUnpin}
              accessibilityRole="button"
              accessibilityLabel={t('pinnedMonthUnpin')}
              hitSlop={8}
            >
              <Text style={styles.unpinText}>×</Text>
            </PressableScale>
          </View>
        }
      >
        <View style={styles.body}>
          <View style={styles.left}>
            <View style={styles.monthRow}>
              <CalendarDays size={11} color={theme.colors.textMuted} />
              <Text style={styles.monthLabel}>{monthLabel}</Text>
            </View>
            {cum.length > 1 ? (
              <Sparkline data={cum} baseline={0} width={120} height={34} strokeWidth={1.6} />
            ) : null}
            <Text style={[styles.net, { color: accent }]}>{formatMoney(stats.netPnl)}</Text>
            {(canGoPrev || monthsBack > 0) && (
              <View style={styles.navRow}>
                {canGoPrev ? (
                  <PressableScale
                    style={styles.navBtn}
                    onPress={() => setMonthsBack(b => b + 1)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11yPrevMonth')}
                    testID="pinned-month-prev"
                  >
                    <ChevronLeft size={13} color={theme.colors.textPrimary} strokeWidth={2.2} />
                  </PressableScale>
                ) : null}
                {monthsBack > 0 ? (
                  <PressableScale
                    style={styles.navBtn}
                    onPress={() => setMonthsBack(b => Math.max(0, b - 1))}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11yNextMonth')}
                    testID="pinned-month-next"
                  >
                    <ChevronRight size={13} color={theme.colors.textPrimary} strokeWidth={2.2} />
                  </PressableScale>
                ) : null}
              </View>
            )}
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('scPositions')}</Text>
              <Text style={styles.statValue}>{stats.trades.length}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('scWinRate')}</Text>
              <Text
                style={[
                  styles.statValue,
                  { color: stats.winRate >= 50 ? theme.colors.green : theme.colors.red },
                ]}
              >
                {stats.winRate.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('scCumulR')}</Text>
              <Text style={[styles.statValue, { color: theme.colors.cyan }]}>
                {stats.totalR >= 0 ? '+' : ''}
                {stats.totalR.toFixed(1)}R
              </Text>
            </View>
          </View>
        </View>
      </Panel>
    </Animated.View>
  );
};

/**
 * PinnedWeekCard — the week twin of the month shortcut.
 *
 * A week is the other ritual export ("this week's result" is what most
 * trading groups ask for), and it reuses the exact same anatomy: scoped
 * stats, a cumulative sparkline, one tap to the share modal preselected on
 * the week. Weeks are not paged here — the weekly review owns navigation —
 * so the card stays a glanceable shortcut rather than growing a second one.
 */
export const PinnedWeekCard: React.FC<{
  trades: Trade[];
  formatMoney: (n: number) => string;
  onShare: () => void;
  onUnpin: () => void;
}> = ({ trades, formatMoney, onShare, onUnpin }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const now = useMemo(() => new Date(), []);
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const scoped = useMemo(
    () => selectTrades(trades, 'week', { now }),
    [trades, now]
  );
  const stats = useMemo(() => computeShareStats(scoped), [scoped]);

  const cum = useMemo(
    () =>
      cumulativePnlSeries(
        scoped,
        weekStart,
        new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 7)
      ),
    [scoped, weekStart]
  );

  if (stats.trades.length === 0) return null;

  const accent = stats.netPnl >= 0 ? theme.colors.green : theme.colors.red;

  return (
    <Animated.View entering={FadeIn.duration(duration.base)}>
      <Panel
        title={t('pinnedWeekTitle')}
        action={
          <View style={styles.headerActions}>
            <PressableScale
              style={styles.headerBtn}
              onPress={onShare}
              accessibilityRole="button"
              accessibilityLabel={t('scExportShare')}
              hitSlop={8}
              testID="pinned-week-share"
            >
              <Share2 size={13} color={theme.colors.primary} strokeWidth={1.9} />
            </PressableScale>
            <PressableScale
              style={styles.headerBtn}
              onPress={onUnpin}
              accessibilityRole="button"
              accessibilityLabel={t('pinnedWeekUnpin')}
              hitSlop={8}
            >
              <Text style={styles.unpinText}>×</Text>
            </PressableScale>
          </View>
        }
      >
        <View style={styles.body}>
          <View style={styles.left}>
            <View style={styles.monthRow}>
              <CalendarDays size={11} color={theme.colors.textMuted} />
              <Text style={styles.monthLabel}>{t('pinnedWeekLabel')}</Text>
            </View>
            {cum.length > 1 ? (
              <Sparkline data={cum} baseline={0} width={120} height={34} strokeWidth={1.6} />
            ) : null}
            <Text style={[styles.net, { color: accent }]}>{formatMoney(stats.netPnl)}</Text>
          </View>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('scPositions')}</Text>
              <Text style={styles.statValue}>{stats.trades.length}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('scWinRate')}</Text>
              <Text
                style={[
                  styles.statValue,
                  { color: stats.winRate >= 50 ? theme.colors.green : theme.colors.red },
                ]}
              >
                {stats.winRate.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('scCumulR')}</Text>
              <Text style={[styles.statValue, { color: theme.colors.cyan }]}>
                {stats.totalR >= 0 ? '+' : ''}
                {stats.totalR.toFixed(1)}R
              </Text>
            </View>
          </View>
        </View>
      </Panel>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    headerActions: { flexDirection: 'row', gap: 6 },
    headerBtn: {
      width: 26,
      height: 26,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    unpinText: {
      color: theme.colors.textMuted,
      fontSize: 15,
      fontFamily: theme.fonts.monoBold,
      lineHeight: 17,
    },
    body: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    left: { gap: 4 },
    monthRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    monthLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      textTransform: 'capitalize',
    },
    navRow: { flexDirection: 'row', gap: 5 },
    navBtn: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    net: {
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    stats: { flex: 1, flexDirection: 'row' },
    stat: { flex: 1, alignItems: 'center', gap: 3 },
    statLabel: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.7,
    },
    statValue: {
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
  });
