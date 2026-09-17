import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Plus, Zap } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { duration } from '../../theme/motion';
import { useUIStore } from '../../store/uiStore';
import { TradeFormModal } from './TradeFormModal';
import { QuickTradeSheet } from './QuickTradeSheet';

/**
 * Floating action button for logging a trade, available on every screen.
 *
 * Logging used to live only in the Trades header, where the label was clipped
 * by the icon buttons beside it and the tap target was 32px tall -- under the
 * 44px minimum, and the single most-used control in a journal. Worse, it was
 * one tab away from wherever the trader actually was.
 *
 * Tap opens quick entry, which covers the common case in seconds; long-press
 * opens the full form. A journal is only kept if logging is faster than not
 * logging.
 */
/**
 * Screens where the floating button must not appear.
 *
 * On Chat it sat directly on top of the send button, so the composer could be
 * typed into but not submitted. A global overlay has to know about the one
 * place that owns its own bottom-right corner; anywhere else it is welcome.
 */
const HIDDEN_ON: string[] = ['Chat'];

export const GlobalAddTradeFab: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  /**
   * The active route name arrives through the UI store, not
   * useNavigationState. This component is mounted by App.tsx OUTSIDE the
   * Tab.Navigator (so it survives tab switches), and useNavigationState
   * *throws* when there is no navigator above it -- in release builds that
   * exception is fatal and killed the app right after the splash whenever a
   * restored session mounted the FAB before the navigator tree settled.
   * The navigator publishes its route via onStateChange; before the first
   * event the store says null and the FAB simply renders.
   */
  const routeName = useUIStore(state => state.activeRouteName);

  const [quickVisible, setQuickVisible] = useState(false);
  const [formVisible, setFormVisible] = useState(false);

  if (routeName && HIDDEN_ON.includes(routeName)) return null;

  return (
    <>
      <Animated.View
        entering={FadeInUp.duration(duration.base)}
        style={styles.wrap}
        pointerEvents="box-none"
      >
        <Pressable
          onPress={() => setQuickVisible(true)}
          onLongPress={() => setFormVisible(true)}
          delayLongPress={280}
          accessibilityRole="button"
          accessibilityLabel={t('quickEntry')}
          accessibilityHint={t('fabHint')}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Zap color={theme.colors.background} size={16} strokeWidth={2.5} />
          <Text style={styles.label}>{t('quickEntry')}</Text>
          <View style={styles.sep} />
          <Plus color={theme.colors.background} size={14} strokeWidth={2.5} />
        </Pressable>
      </Animated.View>

      <QuickTradeSheet visible={quickVisible} onClose={() => setQuickVisible(false)} />
      <TradeFormModal visible={formVisible} onClose={() => setFormVisible(false)} />
    </>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      // Clears the 62px tab bar with room to spare.
      bottom: 78,
      right: theme.spacing.md,
      zIndex: 40,
    },
    fab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 16,
      // 48px: above the 44px minimum touch target.
      height: 48,
      borderRadius: 24,
      shadowColor: '#000',
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    fabPressed: {
      opacity: 0.85,
      transform: [{ scale: 0.97 }],
    },
    label: {
      color: theme.colors.background,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    sep: {
      width: StyleSheet.hairlineWidth,
      height: 18,
      backgroundColor: theme.colors.background,
      opacity: 0.35,
    },
  });
