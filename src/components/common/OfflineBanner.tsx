import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useIsMutating } from '@tanstack/react-query';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';

/**
 * Connectivity strip. Offline state used to be completely invisible: a trade
 * saved on the metro would silently fail and the trader would never know.
 */
export const OfflineBanner: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isOffline, setIsOffline] = useState(false);
  const pending = useIsMutating();

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });
    return () => unsubscribe();
  }, []);

  if (!isOffline && pending === 0) return null;

  const syncing = !isOffline && pending > 0;

  return (
    <View style={[styles.bar, syncing ? styles.syncing : styles.offline]}>
      {syncing ? (
        <RefreshCw size={11} color={theme.colors.primary} strokeWidth={2} />
      ) : (
        <CloudOff size={11} color={theme.colors.gold} strokeWidth={2} />
      )}
      <Text style={[styles.text, { color: syncing ? theme.colors.primary : theme.colors.gold }]}>
        {syncing ? t('syncPending', pending) : t('offlineBanner')}
      </Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    bar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 5,
    },
    offline: { backgroundColor: theme.colors.goldGlow },
    syncing: { backgroundColor: theme.colors.primaryMuted },
    text: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
  });
