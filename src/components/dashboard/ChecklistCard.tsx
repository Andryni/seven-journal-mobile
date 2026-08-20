import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { CheckSquare, Square as UncheckedBox, Plus, Trash2, RotateCcw } from 'lucide-react-native';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { useChecklist } from '../../features/dashboard/useChecklist';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';

export const ChecklistCard: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { items: checklistItems, toggleItem, addItem, deleteItem, resetAll } = useChecklist();
  const [newRuleText, setNewRuleText] = useState('');

  return (
    <Card
      title={t('disciplineChecklist')}
      headerAction={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Badge
            label={`${checklistItems.filter(i => i.is_done).length}/${checklistItems.length}`}
            variant="green"
            size="sm"
          />
          <TouchableOpacity
            onPress={() => resetAll()}
            style={styles.resetBtn}
            accessibilityRole="button"
            accessibilityLabel={t('resetChecklist')}
          >
            <RotateCcw size={10} color={theme.colors.textSecondary} />
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.checklistGroup}>
        {checklistItems.map(item => (
          <View key={item.id} style={styles.checkItemRow}>
            <TouchableOpacity
              style={styles.checkItem}
              onPress={() => toggleItem(item.id, !item.is_done)}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.is_done }}
              accessibilityLabel={item.text}
            >
              {item.is_done ? (
                <CheckSquare color={theme.colors.primaryLight} size={18} />
              ) : (
                <UncheckedBox color={theme.colors.textMuted} size={18} />
              )}
              <Text style={[styles.checkLabel, item.is_done && styles.checkDone]}>
                {item.text}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => deleteItem(item.id)}
              style={styles.deleteCheckBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel={t('a11yDeleteRule')}
            >
              <Trash2 size={13} color={theme.colors.red} />
            </TouchableOpacity>
          </View>
        ))}

        {checklistItems.length === 0 && (
          <Text style={styles.emptyText}>{t('noRulesConfigured')}</Text>
        )}

        {/* Add New Rule Form */}
        <View style={styles.addRuleRow}>
          <TextInput
            style={styles.addRuleInput}
            placeholder={t('addRulePlaceholder')}
            placeholderTextColor={theme.colors.textMuted}
            value={newRuleText}
            onChangeText={setNewRuleText}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (newRuleText.trim()) {
                addItem(newRuleText);
                setNewRuleText('');
              }
            }}
          />
          <TouchableOpacity
            style={styles.addRuleBtn}
            onPress={() => {
              if (newRuleText.trim()) {
                addItem(newRuleText);
                setNewRuleText('');
              }
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t('a11yAddRule')}
          >
            <Plus size={14} color={theme.colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  resetBtn: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resetText: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  checklistGroup: {
    gap: theme.spacing.sm,
  },
  checkItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  checkLabel: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
    flex: 1,
  },
  checkDone: {
    color: theme.colors.textMuted,
    textDecorationLine: 'line-through',
  },
  deleteCheckBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  addRuleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
  },
  addRuleInput: {
    flex: 1,
    height: 38,
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.sansMedium,
  },
  addRuleBtn: {
    width: 38,
    height: 38,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.sans,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
});
