import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface BadgeProps {
  label: string | null | undefined;
  variant?: 'green' | 'red' | 'gold' | 'blue' | 'cyan' | 'neutral';
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'neutral',
  size = 'md',
  pulse = false,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!label) return null;

  return (
    <View
      style={[
        styles.badge,
        size === 'sm' && styles.badgeSm,
        variant === 'green' && styles.badgeGreen,
        variant === 'red' && styles.badgeRed,
        variant === 'gold' && styles.badgeGold,
        variant === 'blue' && styles.badgeBlue,
        variant === 'cyan' && styles.badgeCyan,
        variant === 'neutral' && styles.badgeNeutral,
      ]}
    >
      {pulse && (
        <View
          style={[
            styles.dot,
            variant === 'green' && styles.dotGreen,
            variant === 'red' && styles.dotRed,
            variant === 'gold' && styles.dotGold,
            variant === 'blue' && styles.dotBlue,
          ]}
        />
      )}
      <Text
        style={[
          styles.text,
          size === 'sm' && styles.textSm,
          variant === 'green' && styles.textGreen,
          variant === 'red' && styles.textRed,
          variant === 'gold' && styles.textGold,
          variant === 'blue' && styles.textBlue,
          variant === 'cyan' && styles.textCyan,
          variant === 'neutral' && styles.textNeutral,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    gap: 4,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotGreen: { backgroundColor: theme.colors.green },
  dotRed: { backgroundColor: theme.colors.red },
  dotGold: { backgroundColor: theme.colors.gold },
  dotBlue: { backgroundColor: theme.colors.primaryLight },

  badgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.35)',
  },
  badgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  badgeGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  badgeBlue: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    borderColor: 'rgba(99, 102, 241, 0.35)',
  },
  badgeCyan: {
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderColor: 'rgba(6, 182, 212, 0.35)',
  },
  badgeNeutral: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderBright,
  },

  text: {
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  textSm: {
    fontSize: 9,
  },
  textGreen: { color: theme.colors.greenLight },
  textRed: { color: theme.colors.redLight },
  textGold: { color: theme.colors.goldLight },
  textBlue: { color: theme.colors.primaryLight },
  textCyan: { color: theme.colors.cyanLight },
  textNeutral: { color: theme.colors.textSecondary },
});
