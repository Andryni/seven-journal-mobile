import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  style?: ViewStyle;
  variant?: 'default' | 'glow' | 'accent';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  style,
  variant = 'default',
}) => {
  return (
    <View style={[styles.cardWrapper, style]}>
      {/* Top subtle highlight border */}
      <LinearGradient
        colors={
          variant === 'glow'
            ? ['rgba(99, 102, 241, 0.6)', 'rgba(6, 182, 212, 0.4)', 'transparent']
            : ['rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.02)', 'transparent']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topGlowLine}
      />

      <View style={styles.cardInner}>
        {title ? (
          <View style={styles.header}>
            <LinearGradient
              colors={[theme.colors.primary, theme.colors.cyan]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.indicator}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
        ) : null}
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardWrapper: {
    backgroundColor: '#14161f',
    borderColor: 'rgba(255, 255, 255, 0.07)',
    borderWidth: 1,
    borderRadius: 16,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 8,
  },
  topGlowLine: {
    height: 1.5,
    width: '100%',
  },
  cardInner: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  indicator: {
    width: 3.5,
    height: 16,
    borderRadius: 2,
    marginRight: theme.spacing.sm,
  },
  title: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
