import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

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

export const SectionTabs: React.FC<SectionTabsProps> = ({ tabs, active, onChange, scrollable = false }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const content = tabs.map(tab => {
    const isActive = active === tab.id;
    return (
      <TouchableOpacity
        key={tab.id}
        style={[styles.tab, isActive && styles.tabActive]}
        onPress={() => onChange(tab.id)}
        activeOpacity={0.7}
      >
        {typeof tab.icon === 'function' ? tab.icon(isActive) : tab.icon}
        <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{tab.label}</Text>
      </TouchableOpacity>
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
  },
  tabActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
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

