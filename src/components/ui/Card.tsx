import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  style?: object;
}

export const Card: React.FC<CardProps> = ({ children, title, style }) => {
  return (
    <View style={[styles.card, style]}>
      {title ? (
        <View style={styles.header}>
          <View style={styles.indicator} />
          <Text style={styles.title}>{title}</Text>
        </View>
      ) : null}
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  indicator: {
    width: 3,
    height: 14,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
