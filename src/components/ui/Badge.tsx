import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

interface BadgeProps {
  label: string;
  variant?: 'blue' | 'gold' | 'green' | 'red' | 'neutral';
}

export const Badge: React.FC<BadgeProps> = ({ label, variant = 'neutral' }) => {
  const getColors = () => {
    switch (variant) {
      case 'blue':
        return { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.4)', text: theme.colors.primaryLight };
      case 'gold':
        return { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: theme.colors.goldLight };
      case 'green':
        return { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: theme.colors.greenLight };
      case 'red':
        return { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', text: theme.colors.redLight };
      default:
        return { bg: 'rgba(148, 163, 184, 0.1)', border: 'rgba(148, 163, 184, 0.2)', text: theme.colors.textSecondary };
    }
  };

  const colors = getColors();

  return (
    <View style={[styles.badge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
      <Text style={[styles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
