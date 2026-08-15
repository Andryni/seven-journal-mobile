import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

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

const styles = StyleSheet.create({
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
  dotGreen: { backgroundColor: '#10b981' },
  dotRed: { backgroundColor: '#ef4444' },
  dotGold: { backgroundColor: '#f59e0b' },
  dotBlue: { backgroundColor: '#818cf8' },

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
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },

  text: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    fontVariant: ['tabular-nums'],
  },
  textSm: {
    fontSize: 9,
  },
  textGreen: { color: '#34d399' },
  textRed: { color: '#f87171' },
  textGold: { color: '#fbbf24' },
  textBlue: { color: '#818cf8' },
  textCyan: { color: '#67e8f9' },
  textNeutral: { color: '#94a3b8' },
});
