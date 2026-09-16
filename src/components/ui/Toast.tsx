import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react-native';

export type ToastType = 'error' | 'success' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onDismiss: () => void;
}

const TOAST_ICONS: Record<ToastType, React.FC<{ color: string; size: number }>> = {
  error: AlertTriangle,
  success: CheckCircle,
  info: Info,
};

const makeToastColors = (
  colors: AppTheme['colors']
): Record<ToastType, { bg: string; border: string; icon: string }> => ({
  error: {
    bg: withAlpha(colors.red, 0.15),
    border: withAlpha(colors.red, 0.4),
    icon: colors.redLight,
  },
  success: {
    bg: withAlpha(colors.green, 0.15),
    border: withAlpha(colors.green, 0.4),
    icon: colors.greenLight,
  },
  info: {
    bg: withAlpha(colors.primary, 0.15),
    border: withAlpha(colors.primary, 0.4),
    icon: colors.primaryLight,
  },
});

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 4000,
  onDismiss,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-20)).current;
  const Icon = TOAST_ICONS[type];
  const colors = makeToastColors(theme.colors)[type];

  useEffect(() => {
    // Slide in
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Icon color={colors.icon} size={16} />
      <Text style={styles.message} numberOfLines={3}>
        {message}
      </Text>
      <TouchableOpacity
        onPress={() => {
          Animated.parallel([
            Animated.timing(opacity, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: -20,
              duration: 200,
              useNativeDriver: true,
            }),
          ]).start(() => onDismiss());
        }}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <X color={theme.colors.textMuted} size={14} />
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      top: 50,
      left: theme.spacing.md,
      right: theme.spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: 12,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      zIndex: 9999,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 10,
    },
    message: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontFamily: theme.fonts.sansMedium,
    },
  });
