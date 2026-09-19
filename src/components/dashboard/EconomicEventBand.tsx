import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { useEconomicCalendar } from '../../features/calendar/useEconomicCalendar';
import { bannerEvent, minutesUntil } from '../../features/calendar/economicEvents';

/**
 * One line: the next high-impact release, or nothing.
 *
 * Deliberately a band and not a section. The dashboard was cut from eleven
 * sections to six once and had grown back to ten; a calendar panel would be
 * the eleventh, and the budget test now in place would fail. What a trader
 * needs before the session is not a table of releases — it is whether
 * something is about to move the market in the next few hours.
 *
 * Renders the next release, or — when the week's calendar IS loaded and
 * nothing is imminent — a calm "no major release" line. Silence was the old
 * behaviour and read as a bug: the trader could not tell "all clear" from
 * "the calendar is broken". The all-clear is now stated, quietly; a FAILED
 * feed still renders nothing, because asserting "no news" without the feed
 * would be the one claim this band must never make.
 */
export const EconomicEventBand: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { events, isLoading } = useEconomicCalendar();

  const event = useMemo(() => bannerEvent(events), [events]);
  // Feed still loading or unreachable: no claim. Loaded and quiet: all-clear.
  if (!event && (isLoading || events.length === 0)) return null;
  if (!event) {
    return (
      <Animated.View
        entering={FadeIn.duration(260)}
        style={styles.band}
        accessibilityRole="text"
        accessibilityLabel={t('ecoNone')}
      >
        <CalendarClock size={13} color={theme.colors.textMuted} strokeWidth={2} />
        <Text style={styles.title} numberOfLines={1}>
          {t('ecoNone')}
        </Text>
      </Animated.View>
    );
  }

  const mins = minutesUntil(event);
  const past = mins < 0;
  const abs = Math.abs(mins);

  /**
   * Relative time, because "in 2h" is actionable where "14:30" needs mental
   * arithmetic against a timezone the trader may not be in.
   */
  const when = (() => {
    if (abs < 5) return t('ecoNow');
    if (abs < 60) return `${abs} min`;
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return m > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`;
  })();

  const label = past
    ? t('ecoSince').replace('{when}', when)
    : t('ecoIn').replace('{when}', when);

  // Imminent events earn the accent; anything further is informational.
  const urgent = !past && mins <= 60;
  const tone = urgent ? theme.colors.gold : theme.colors.textMuted;

  return (
    <Animated.View
      entering={FadeIn.duration(260)}
      style={[styles.band, urgent && styles.bandUrgent]}
      accessibilityRole="text"
      accessibilityLabel={`${event.currency} ${event.title}, ${label}`}
    >
      <CalendarClock size={13} color={tone} strokeWidth={2} />
      <Text style={[styles.currency, { color: tone }]}>{event.currency}</Text>
      <Text style={styles.title} numberOfLines={1}>
        {event.title}
      </Text>
      <Text style={[styles.when, { color: tone }]}>{label}</Text>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    band: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginHorizontal: 14,
      marginBottom: 10,
      paddingHorizontal: 11,
      paddingVertical: 8,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    bandUrgent: {
      borderColor: withAlpha(theme.colors.gold, 0.4),
      backgroundColor: withAlpha(theme.colors.gold, 0.08),
    },
    currency: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    title: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
    },
    when: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.4,
    },
  });
