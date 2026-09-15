import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

/**
 * Card — kept for API compatibility with the existing screens, but rebuilt on
 * the "Trading Desk" language: flat surface, hairline border, no gradient,
 * no glow, no accent dot, tighter radius.
 *
 * `gradientColors` and `glowBorder` are accepted but intentionally ignored so
 * call sites do not break during the redesign. Prefer <Panel /> for new code.
 */
interface CardProps {
  title?: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'green' | 'red' | 'gold' | 'blue' | 'neutral';
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  /** @deprecated visual noise — ignored since the Trading Desk redesign */
  gradientColors?: [string, string, ...string[]];
  /** @deprecated glow removed — maps to a subtle accent border */
  glowBorder?: boolean;
  delay?: number;
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
  glowBorder = false,
  delay = 0,
  animated = true,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const Wrapper: React.ComponentType<any> = animated ? Animated.View : View;
  const wrapperProps = animated ? { entering: FadeIn.delay(delay).duration(220) } : {};

  const badgeTone = {
    green: { bg: theme.colors.greenMuted, fg: theme.colors.green },
    red: { bg: theme.colors.redMuted, fg: theme.colors.red },
    gold: { bg: theme.colors.goldGlow, fg: theme.colors.goldLight },
    blue: { bg: theme.colors.primaryMuted, fg: theme.colors.primary },
    neutral: { bg: theme.colors.surface, fg: theme.colors.textSecondary },
  }[badgeVariant];

  return (
    <Wrapper
      {...wrapperProps}
      style={[styles.card, glowBorder && { borderColor: theme.colors.cardBorderGlow }, style]}
    >
      {title ? (
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {badge ? (
            <View style={[styles.badge, { backgroundColor: badgeTone.bg }]}>
              <Text style={[styles.badgeText, { color: badgeTone.fg }]}>{badge}</Text>
            </View>
          ) : null}
          {headerAction ? <View style={styles.headerAction}>{headerAction}</View> : null}
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </Wrapper>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.lg,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.hairline,
      gap: theme.spacing.sm,
    },
    titleWrap: { flex: 1 },
    title: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 3,
    },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: theme.borderRadius.xs,
    },
    badgeText: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    headerAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
    },
    content: {
      gap: theme.spacing.sm,
    },
  });
