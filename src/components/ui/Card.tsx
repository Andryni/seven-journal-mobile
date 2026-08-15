import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../theme';

interface CardProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'green' | 'red' | 'gold' | 'blue' | 'neutral';
  children: React.ReactNode;
  style?: ViewStyle;
  gradientColors?: [string, string, ...string[]];
  glowBorder?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  badge,
  badgeVariant = 'blue',
  children,
  style,
  gradientColors = ['#12141c', '#0d0f15'],
  glowBorder = false,
}) => {
  return (
    <View style={[styles.outerContainer, glowBorder && styles.glowOuter, style]}>
      {/* Top subtle highlight line */}
      <LinearGradient
        colors={['rgba(255,255,255,0.15)', 'rgba(99,102,241,0.2)', 'rgba(255,255,255,0.02)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topHighlight}
      />

      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.innerCard}
      >
        {title && (
          <View style={styles.header}>
            <View style={styles.titleWrap}>
              <Text style={styles.titleText}>{title}</Text>
              {subtitle && <Text style={styles.subtitleText}>{subtitle}</Text>}
            </View>
            {badge && (
              <View
                style={[
                  styles.badgeWrap,
                  badgeVariant === 'green' && styles.badgeGreen,
                  badgeVariant === 'red' && styles.badgeRed,
                  badgeVariant === 'gold' && styles.badgeGold,
                  badgeVariant === 'blue' && styles.badgeBlue,
                ]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    badgeVariant === 'green' && styles.badgeTextGreen,
                    badgeVariant === 'red' && styles.badgeTextRed,
                    badgeVariant === 'gold' && styles.badgeTextGold,
                    badgeVariant === 'blue' && styles.badgeTextBlue,
                  ]}
                >
                  {badge}
                </Text>
              </View>
            )}
          </View>
        )}
        <View style={styles.content}>{children}</View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: theme.borderRadius.lg,
    backgroundColor: '#0e1017',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  glowOuter: {
    borderColor: 'rgba(99, 102, 241, 0.4)',
    shadowColor: '#6366f1',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  topHighlight: {
    height: 1,
    width: '100%',
  },
  innerCard: {
    padding: theme.spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: theme.spacing.sm,
  },
  titleWrap: {
    flex: 1,
  },
  titleText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtitleText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  badgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  badgeGreen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  badgeRed: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  badgeGold: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  badgeBlue: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeTextGreen: { color: '#34d399' },
  badgeTextRed: { color: '#f87171' },
  badgeTextGold: { color: '#fbbf24' },
  badgeTextBlue: { color: '#818cf8' },
  content: {
    gap: theme.spacing.sm,
  },
});
