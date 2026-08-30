import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { PressableScale } from './PressableScale';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Terminal-style empty state — framed like a "NO DATA" readout on a
 * trading terminal, with an optional call-to-action.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.container}>
      <View style={styles.iconRing}>
        <View style={styles.iconInner}>{icon}</View>
      </View>
      <Text style={styles.noData}>— NO DATA —</Text>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <PressableScale onPress={onAction} style={styles.actionBtn} accessibilityLabel={actionLabel}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </PressableScale>
      ) : null}
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingVertical: theme.spacing.xxl,
      paddingHorizontal: theme.spacing.xl,
    },
    iconRing: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 1,
      borderColor: theme.colors.cardBorderGlow,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.primaryGlow,
    },
    iconInner: {
      width: 52,
      height: 52,
      borderRadius: 26,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noData: {
      color: theme.colors.textDark,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 2,
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontFamily: theme.fonts.sansBold,
      textAlign: 'center',
      marginBottom: 6,
    },
    description: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily: theme.fonts.sansMedium,
      textAlign: 'center',
      lineHeight: 18,
      maxWidth: 280,
    },
    actionBtn: {
      marginTop: theme.spacing.lg,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: 10,
      borderRadius: theme.borderRadius.md,
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 6,
    },
    actionText: {
      color: '#ffffff',
      fontSize: 12,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
  });
