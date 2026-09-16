import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

/**
 * Panel — the base container of the "Trading Desk" language.
 *
 * Deliberately NOT the old Card: no gradient fill, no glow border, no
 * top highlight line, no accent dot. A panel is a flat surface delimited by a
 * hairline. Hierarchy is produced by typography, not by decoration.
 */
interface PanelProps {
  /** Uppercase section label rendered in the panel header rail. */
  title?: string;
  subtitle?: string;
  /** Right-aligned node in the header (actions, badges, counts). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  style?: ViewStyle;
  /** Removes internal padding — for blotters / edge-to-edge tables. */
  flush?: boolean;
  /** Emphasised state (e.g. a breached prop-firm rule). */
  tone?: 'default' | 'accent' | 'danger' | 'success';
  delay?: number;
  animated?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  title,
  subtitle,
  action,
  children,
  style,
  flush = false,
  tone = 'default',
  delay = 0,
  animated = true,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const toneBorder = {
    default: theme.colors.cardBorder,
    accent: theme.colors.cardBorderGlow,
    danger: withAlpha(theme.colors.red, 0.3),
    success: withAlpha(theme.colors.green, 0.3),
  }[tone];

  const Wrapper: React.ComponentType<any> = animated ? Animated.View : View;
  const wrapperProps = animated
    ? { entering: FadeIn.delay(delay).duration(220) }
    : {};

  return (
    <Wrapper {...wrapperProps} style={[styles.panel, { borderColor: toneBorder }, style]}>
      {title ? (
        <View style={[styles.header, flush && styles.headerFlush]}>
          <View style={styles.titleWrap}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {action ? <View style={styles.action}>{action}</View> : null}
        </View>
      ) : null}
      <View style={flush ? styles.bodyFlush : styles.body}>{children}</View>
    </Wrapper>
  );
};

/** A 1px full-bleed separator. The workhorse of dense layouts. */
export const Hairline: React.FC<{ style?: ViewStyle; inset?: number }> = ({ style, inset = 0 }) => {
  const { theme } = useTheme();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.colors.hairline,
          marginLeft: inset,
        },
        style,
      ]}
    />
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    panel: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      marginBottom: theme.spacing.md,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    headerFlush: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.hairline,
      paddingBottom: theme.spacing.md,
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
    action: { marginLeft: theme.spacing.sm },
    body: {
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      paddingTop: theme.spacing.xs,
    },
    bodyFlush: {},
  });
