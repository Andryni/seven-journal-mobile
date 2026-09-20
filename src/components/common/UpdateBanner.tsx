import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Download, RotateCw } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { PressableScale } from '../ui/PressableScale';
import { useOtaUpdate } from '../../features/updates/otaUpdate';

/**
 * "An update is downloaded — restart to apply it."
 *
 * Not decoration: without it, a published fix waits for the next cold start of
 * the app, and on a phone that is never closed that is days. It is also the
 * smallest honest version of the feature — one line, one tap, and it disappears
 * if the update is not there.
 *
 * It renders nothing at all in the common case (`idle`), which is most of the
 * time: an update banner that is always present is a banner nobody reads.
 */
export const UpdateBanner: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { state, apply } = useOtaUpdate();

  if (state !== 'ready') return null;

  return (
    <PressableScale
      style={styles.bar}
      onPress={apply}
      accessibilityRole="button"
      accessibilityLabel={t('otaReady')}
    >
      <Download size={11} color={theme.colors.primary} strokeWidth={2} />
      <Text style={styles.text}>{t('otaReady')}</Text>
      <RotateCw size={11} color={theme.colors.primary} strokeWidth={2} />
    </PressableScale>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    // Same geometry as OfflineBanner: the two can stack, and they must read as
    // one strip rather than two competing notices.
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 5,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.primaryMuted,
    },
    text: {
      color: theme.colors.primary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.4,
    },
  });
