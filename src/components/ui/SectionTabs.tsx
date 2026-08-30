import React, { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { PressableScale } from './PressableScale';

export interface SectionTab {
  id: string;
  label: string;
  icon?: React.ReactNode | ((isActive: boolean) => React.ReactNode);
}

interface SectionTabsProps {
  tabs: SectionTab[];
  active: string;
  onChange: (id: string) => void;
  scrollable?: boolean;
}

/**
 * Terminal segmented tabs — active tab gets a glowing indigo pill with a
 * bottom indicator bar, and every tab press has a tactile spring scale.
 */
export const SectionTabs: React.FC<SectionTabsProps> = ({ tabs, active, onChange, scrollable = false }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const content = tabs.map(tab => {
    const isActive = active === tab.id;
    return (
      <PressableScale
        key={tab.id}
        style={[styles.tab, isActive && styles.tabActive]}
        onPress={() => onChange(tab.id)}
        accessibilityLabel={tab.label}
        accessibilityRole="tab"
        pressedScale={0.94}
      >
        {typeof tab.icon === 'function' ? tab.icon(isActive) : tab.icon}
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
        {isActive && (
          <Animated.View entering={FadeIn.duration(220)} style={styles.activeIndicator} />
        )}
      </PressableScale>
    );
  });

  if (scrollable) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.row}>{content}</View>;
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  scroll: {
    marginBottom: theme.spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    marginRight: theme.spacing.sm,
    overflow: 'hidden',
  },
  tabActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.16)',
    borderColor: theme.colors.primary,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  activeIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '18%',
    right: '18%',
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.primaryLight,
  },
  tabText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: theme.colors.textPrimary,
  },
});
