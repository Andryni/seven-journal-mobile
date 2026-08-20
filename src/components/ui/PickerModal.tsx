import React, { useMemo } from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

export interface PickerModalItem {
  id: string;
  label: string;
  sub?: string;
  leftIcon?: React.ReactNode;
  rightText?: string;
}

interface PickerModalProps {
  visible: boolean;
  title: string;
  items: PickerModalItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
  maxHeight?: number;
}

export const PickerModal: React.FC<PickerModalProps> = ({
  visible,
  title,
  items,
  selectedId,
  onSelect,
  onClose,
  maxHeight = 300,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={`Fermer ${title.toLowerCase()}`}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} color={theme.colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight }} showsVerticalScrollIndicator={false}>
            {items.map(item => {
              const isSelected = selectedId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.item, isSelected && styles.itemActive]}
                  onPress={() => onSelect(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={styles.itemLeft}>
                    {item.leftIcon ? null : <View style={[styles.dot, isSelected && styles.dotActive]} />}
                    {item.leftIcon}
                    <View style={styles.itemTextWrap}>
                      <Text style={[styles.itemName, isSelected && styles.itemNameActive]} numberOfLines={1}>
                        {item.label}
                      </Text>
                      {item.sub ? (
                        <Text style={styles.itemSub} numberOfLines={1}>
                          {item.sub}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.itemRight}>
                    {item.rightText ? (
                      <Text style={[styles.itemRightText, isSelected && styles.itemNameActive]} numberOfLines={1}>
                        {item.rightText}
                      </Text>
                    ) : null}
                    {isSelected && <Check size={14} color={theme.colors.green} style={{ marginLeft: 6 }} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  content: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderBright,
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    paddingBottom: 10,
    marginBottom: 10,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 1,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: 6,
  },
  itemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textDark,
  },
  dotActive: {
    backgroundColor: theme.colors.green,
  },
  itemTextWrap: {
    flex: 1,
  },
  itemName: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  itemNameActive: {
    color: theme.colors.textPrimary,
  },
  itemSub: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 1,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemRightText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
});
