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
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.xs,
    gap: 4,
  },
  badgeSm: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.xs,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotGreen: { backgroundColor: theme.colors.green },
  dotRed: { backgroundColor: theme.colors.red },
  dotGold: { backgroundColor: theme.colors.gold },
  dotBlue: { backgroundColor: theme.colors.primary },

  // Badges are tinted fills with no border: one less line competing with the
  // panel hairlines. Colours come from the theme, never hardcoded.
  badgeGreen: { backgroundColor: theme.colors.greenMuted },
  badgeRed: { backgroundColor: theme.colors.redMuted },
  badgeGold: { backgroundColor: theme.colors.goldGlow },
  badgeBlue: { backgroundColor: theme.colors.primaryMuted },
  badgeCyan: { backgroundColor: theme.colors.cyanGlow },
  badgeNeutral: { backgroundColor: theme.colors.surface },

  text: {
    fontSize: theme.type.label,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  textSm: {
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoBold,
  },
  textGreen: { color: theme.colors.green },
  textRed: { color: theme.colors.red },
  textGold: { color: theme.colors.goldLight },
  textBlue: { color: theme.colors.primary },
  textCyan: { color: theme.colors.cyan },
  textNeutral: { color: theme.colors.textSecondary },
});
