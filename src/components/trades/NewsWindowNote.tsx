import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RadioTower } from 'lucide-react-native';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { formatNewsOffset, type NewsContext } from '../../features/calendar/newsContext';

/**
 * "USD Core CPI m/m · dans 3 min" — shown while the trader is filling the form.
 *
 * This is the only place in the app that speaks BEFORE a trade exists, and it
 * is the reason the news context was worth recording at all: knowing afterwards
 * that you lose money trading into CPI teaches you nothing you can act on,
 * while seeing the countdown mid-entry can stop the trade that produces the
 * number.
 *
 * It warns, it does not block. The entry sheet is an informed-fill surface, not
 * a nanny: a trader who wants to trade the release has to be able to, and the
 * record of it is what the analytics will judge later.
 */
export const NewsWindowNote: React.FC<{ context: NewsContext | null }> = ({ context }) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!context) return null;

  const label = `${context.currency} ${context.event}`;

  return (
    <View
      style={styles.note}
      accessibilityRole="alert"
      accessibilityLabel={t('newsWindowWarn', label, formatNewsOffset(context.offsetMin, lang))}
    >
      <RadioTower size={13} color={theme.colors.gold} strokeWidth={2} />
      <Text style={styles.text}>
        {t('newsWindowWarn', label, formatNewsOffset(context.offsetMin, lang))}
      </Text>
    </View>
  );
};

/**
 * The same context, read back from a saved trade.
 *
 * Null when the trade carries no offset — an unmigrated database, or a trade
 * saved before the calendar was in cache. The badge then simply is not there,
 * which is right: "unknown context" must not render as "no news".
 */
export const NewsBadge: React.FC<{ context: NewsContext | null }> = ({ context }) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!context) return null;

  const label = `${context.currency} ${context.event}`.trim();
  const when = formatNewsOffset(context.offsetMin, lang);

  return (
    <View style={styles.badge} accessibilityLabel={t('newsBadgeA11y', label, when)}>
      <RadioTower size={11} color={theme.colors.gold} strokeWidth={2} />
      <Text style={styles.badgeText} numberOfLines={1}>
        {t('newsBadge', label, when)}
      </Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: theme.spacing.sm,
    },
    badgeText: {
      flexShrink: 1,
      color: theme.colors.goldLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.4,
    },
    note: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 7,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.gold,
      backgroundColor: withAlpha(theme.colors.gold, 0.08),
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
    },
    text: {
      flex: 1,
      color: theme.colors.goldLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      lineHeight: 15,
    },
  });
