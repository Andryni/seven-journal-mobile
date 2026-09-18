import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldAlert } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import type { DriftAlert } from '../../features/guard/liveDrift';

/**
 * A rule broken while a position is still open.
 *
 * The notification covers the case where the app is closed; this covers the
 * case where it is not. A push that fires while the trader is already looking
 * at the dashboard is easy to miss and impossible to re-read.
 *
 * Renders nothing when no rule is breached, like the economic band: the
 * dashboard is held to nine sections and neither of these earns a permanent
 * frame. Red rather than amber, because unlike a calendar entry this one is
 * about the trader's own behaviour right now.
 */
export const LiveDriftBanner: React.FC<{ alert: DriftAlert | null }> = ({ alert }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!alert) return null;

  const title =
    alert.code === 'MAX_TRADES_PER_DAY' ? t('driftTradesTitle') : t('driftLossesTitle');
  const body = (
    alert.code === 'MAX_TRADES_PER_DAY' ? t('driftTradesBody') : t('driftLossesBody')
  )
    .replace('{count}', String(alert.count))
    .replace('{limit}', String(alert.limit));

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={styles.band}
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${body}`}
    >
      <ShieldAlert size={16} color={theme.colors.red} strokeWidth={2} />
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body} numberOfLines={2}>
          {body}
        </Text>
      </View>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    band: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      marginHorizontal: 14,
      marginBottom: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.red, 0.45),
      backgroundColor: withAlpha(theme.colors.red, 0.1),
    },
    content: { flex: 1 },
    title: {
      color: theme.colors.redLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    body: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      marginTop: 2,
      lineHeight: 14,
    },
  });
