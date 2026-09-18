import React, { useMemo, useState } from 'react';
import { Alert, View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Plus, Wallet } from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAccounts } from '../features/accounts/useAccounts';
import { useSyncedAccountIds } from '../features/sync/useSyncQueue';
import { useTrades } from '../features/trades/useTrades';
import { useRefresh } from '../features/data/useRefresh';
import { useUIStore } from '../store/uiStore';
import type { TradingAccount } from '../types/domain';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { duration, stagger } from '../theme/motion';
import { SkeletonCard } from '../components/ui/Skeleton';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT } from '../i18n';
import { AccountCard } from '../components/accounts/AccountCard';
import { AccountFormModal } from '../components/accounts/AccountFormModal';

/**
 * Accounts — list, selection, and the add/edit form.
 *
 * Presentation lives in components/accounts (AccountCard, AccountFormModal);
 * this screen keeps the state and the orchestration: which account is
 * selected, which is being edited, and the delete confirmation.
 */
export const AccountsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount } = useAccounts();
  const syncedIds = useSyncedAccountIds();
  const syncedSet = useMemo(() => new Set(syncedIds), [syncedIds]);
  const { trades } = useTrades();
  const { refreshing, onRefresh } = useRefresh();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const setActiveAccountId = useUIStore((state: { setActiveAccountId: (id: string | null) => void }) => state.setActiveAccountId);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAcc, setEditingAcc] = useState<TradingAccount | null>(null);

  const openAddModal = () => {
    setEditingAcc(null);
    setModalVisible(true);
  };

  const openEditModal = (acc: TradingAccount) => {
    setEditingAcc(acc);
    setModalVisible(true);
  };

  const handleSave = async (payload: Record<string, unknown>) => {
    // mutateAsync rejects on failure. Without a catch the rejection is
    // unhandled, the modal stays open with no explanation, and on Android an
    // unhandled rejection can take the app down. The hook raises the toast.
    try {
      if (editingAcc) {
        await updateAccount({ id: editingAcc.id, ...payload });
      } else {
        await createAccount(payload as Omit<TradingAccount, 'id' | 'user_id' | 'created_at'>);
      }
      setModalVisible(false);
    } catch {
      // Reported by useAccounts' onError; keep the form open so the user's
      // input is not lost.
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t('confirmTitle'),
      t('confirmDeleteAccount'),
      [
        { text: t('confirmNo'), style: 'cancel' },
        {
          text: t('confirmYes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccount(id);
            } catch {
              /* reported by useAccounts' onError */
            }
          },
        },
      ],
    );
  };

  const renderAccountItem = ({ item, index }: { item: TradingAccount; index: number }) => (
    /* Staggered entrance, matching the blotter: the list assembles rather
       than appearing all at once, which also makes the order readable. */
    <Animated.View entering={FadeInDown.delay(stagger(index)).duration(duration.fast)}>
      <AccountCard
        account={item}
        trades={trades}
        isActive={activeAccountId === item.id}
        synced={syncedSet.has(item.id)}
        onPress={() => setActiveAccountId(activeAccountId === item.id ? null : item.id)}
        onEdit={() => openEditModal(item)}
        onDelete={() => handleDelete(item.id)}
      />
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={styles.container} accessibilityLabel={t('loading')}>
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Shared header: same type, spacing and entrance as every other
          screen. See components/ui/ScreenHeader. */}
      <ScreenHeader
        title={t('screenTitleAccounts')}
        subtitle={t('screenSubtitleAccounts')}
        action={
          <TouchableOpacity
            style={styles.addBtn}
            onPress={openAddModal}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('addAccount')}
          >
            <Plus color={theme.colors.textPrimary} size={16} />
            <Text style={styles.addBtnText}>{t('addAccount')}</Text>
          </TouchableOpacity>
        }
        style={styles.screenHeader}
      />

      {/* ── ACCOUNTS LIST ── */}
      <FlatList
        data={accounts}
        keyExtractor={item => item.id}
        renderItem={renderAccountItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Wallet size={36} color={theme.colors.textDark} />
            <Text style={styles.emptyTitle}>{t('noAccounts')}</Text>
            <Text style={styles.emptySub}>{t('noAccountsSub')}</Text>
          </View>
        }
      />

      {/* ── MODAL AJOUTER / MODIFIER COMPTE ── */}
      <AccountFormModal
        visible={modalVisible}
        editing={editingAcc}
        onClose={() => setModalVisible(false)}
        onSave={handleSave}
      />
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.xl,
    },
    screenHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: theme.borderRadius.md,
    },
    addBtnText: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    listContent: {
      paddingBottom: 40,
    },
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 60,
      gap: 8,
    },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontFamily: theme.fonts.sansBold,
    },
    emptySub: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: theme.fonts.sans,
    },
  });
