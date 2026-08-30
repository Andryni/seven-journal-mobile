import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

interface CardProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'green' | 'red' | 'gold' | 'blue' | 'neutral';
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  gradientColors?: [string, string, ...string[]];
  glowBorder?: boolean;
  /** Entrance animation delay (ms) for staggered lists */
  delay?: number;
  /** Disable the entrance animation (e.g. inside virtualized lists) */
  animated?: boolean;
}

export const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  badge,
  badgeVariant = 'blue',
  headerAction,
  children,
  style,
  gradientColors,
  glowBorder = false,
  delay = 0,
  animated = true,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedGradientColors = gradientColors ?? [theme.colors.card, theme.colors.backgroundElevated];
  const Wrapper: React.ComponentType<any> = animated ? Animated.View : View;
  const wrapperProps = animated
    ? { entering: FadeInUp.delay(delay).duration(420).springify().damping(16) }
    : {};
  return (
    <Wrapper {...wrapperProps} style={[styles.outerContainer, glowBorder && styles.glowOuter, style]}>
      {/* Top subtle highlight line */}
      <LinearGradient
        colors={[theme.colors.borderBright, theme.colors.primaryGlow, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topHighlight}
      />

      <LinearGradient
        colors={resolvedGradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.innerCard}
      >
        {title && (
          <View style={styles.header}>
            <View style={styles.accentDot} />
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
            {headerAction && (
              <View style={styles.headerAction}>{headerAction}</View>
            )}
          </View>
        )}
        <View style={styles.content}>{children}</View>
      </LinearGradient>
    </Wrapper>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  outerContainer: {
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.backgroundElevated,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
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
    shadowColor: theme.colors.primary,
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
    borderBottomColor: theme.colors.cardBorder,
    paddingBottom: theme.spacing.sm,
  },
  accentDot: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
    marginRight: theme.spacing.sm,
    shadowColor: theme.colors.primary,
    shadowOpacity: 0.8,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 0 },
  },
  titleWrap: {
    flex: 1,
  },
  titleText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  subtitleText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.sansSemiBold,
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
  badgeTextGreen: { color: theme.colors.greenLight },
  badgeTextRed: { color: theme.colors.redLight },
  badgeTextGold: { color: theme.colors.goldLight },
  badgeTextBlue: { color: theme.colors.primaryLight },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginLeft: theme.spacing.sm,
  },
  content: {
    gap: theme.spacing.sm,
  },
});
