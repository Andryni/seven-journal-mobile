import React, { useState } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { useAccounts } from '../features/accounts/useAccounts';
import { useUIStore } from '../store/uiStore';
import type { TradingAccount, AccountType } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Plus, Shield, Check, Trash2, Edit3, X } from 'lucide-react-native';

export const AccountsScreen: React.FC = () => {
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount } = useAccounts();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const setActiveAccountId = useUIStore((state: { setActiveAccountId: (id: string | null) => void }) => state.setActiveAccountId);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAcc, setEditingAcc] = useState<TradingAccount | null>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('challenge');
  const [balance, setBalance] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [maxDailyLoss, setMaxDailyLoss] = useState('');
  const [profitTarget, setProfitTarget] = useState('');
  const [maxDrawdownLimit, setMaxDrawdownLimit] = useState('');

  const openAddModal = () => {
    setEditingAcc(null);
    setName('');
    setType('challenge');
    setBalance('100000');
    setInitialBalance('100000');
    setCurrency('USD');
    setMaxDailyLoss('1000');
    setProfitTarget('10000');
    setMaxDrawdownLimit('10000');
    setModalVisible(true);
  };

  const openEditModal = (acc: TradingAccount) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.balance.toString());
    setInitialBalance(acc.initial_balance.toString());
    setCurrency(acc.currency);
    setMaxDailyLoss(acc.max_daily_loss_limit ? acc.max_daily_loss_limit.toString() : '');
    setProfitTarget(acc.profit_target ? acc.profit_target.toString() : '');
    setMaxDrawdownLimit(acc.max_drawdown_limit ? acc.max_drawdown_limit.toString() : '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name || !balance || !initialBalance) {
      alert('Veuillez remplir les champs obligatoires.');
      return;
    }

    const payload = {
      name,
      type,
      balance: Number(balance),
      initial_balance: Number(initialBalance),
      currency,
      is_active: true,
      max_daily_loss_limit: maxDailyLoss ? Number(maxDailyLoss) : null,
      profit_target: profitTarget ? Number(profitTarget) : null,
      max_drawdown_limit: maxDrawdownLimit ? Number(maxDrawdownLimit) : null,
    };

    if (editingAcc) {
      await updateAccount({ id: editingAcc.id, ...payload });
    } else {
      await createAccount(payload);
    }
    setModalVisible(false);
  };

  const renderAccountItem = ({ item }: { item: TradingAccount }) => {
    const isSelected = activeAccountId === item.id;

    return (
      <TouchableOpacity
        style={[styles.accountCard, isSelected && styles.selectedCard]}
        onPress={() => setActiveAccountId(isSelected ? null : item.id)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleInfo}>
            <Text style={styles.accountName}>{item.name}</Text>
            <Badge
              label={item.type}
              variant={item.type === 'funded' ? 'gold' : item.type === 'challenge' ? 'blue' : 'neutral'}
            />
          </View>
          <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editBtn}>
            <Edit3 color={theme.colors.textSecondary} size={16} />
          </TouchableOpacity>
        </View>

        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.statLabel}>SOLDE ACTUEL</Text>
            <Text style={styles.balanceValue}>
              ${item.balance.toLocaleString()} {item.currency}
            </Text>
          </View>
          <View style={styles.alignRight}>
            <Text style={styles.statLabel}>CAPITAL INITIAL</Text>
            <Text style={styles.initialValue}>
              ${item.initial_balance.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Lock Guard Rule Box */}
        <View style={styles.lockRuleBox}>
          <Shield color={theme.colors.goldLight} size={14} />
          <Text style={styles.lockRuleText}>
            Garde-fou : Perte max jour{' '}
            <Text style={styles.boldText}>
              ${item.max_daily_loss_limit ?? (item.initial_balance * 0.01).toFixed(0)}
            </Text>{' '}
            ({item.max_daily_loss_limit ? '' : 'défaut 1%'})
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>COMPTES DE TRADING</Text>
          <Text style={styles.screenSubtitle}>Gestion multi-comptes & Lock Guard</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal}>
          <Plus color="#ffffff" size={16} />
          <Text style={styles.addBtnText}>AJOUTER</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={accounts}
        keyExtractor={(item) => item.id}
        renderItem={renderAccountItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {/* Account Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingAcc ? 'MODIFIER LE COMPTE' : 'NOUVEAU COMPTE'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X color="#ffffff" size={20} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>NOM DU COMPTE *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="ex: FTMO 100K"
              placeholderTextColor={theme.colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <View style={styles.gridRow}>
              <View style={styles.gridCol}>
                <Text style={styles.inputLabel}>CAPITAL INITIAL *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="100000"
                  placeholderTextColor={theme.colors.textMuted}
                  value={initialBalance}
                  onChangeText={setInitialBalance}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.gridCol}>
                <Text style={styles.inputLabel}>SOLDE ACTUEL *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="100000"
                  placeholderTextColor={theme.colors.textMuted}
                  value={balance}
                  onChangeText={setBalance}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            <Text style={styles.inputLabel}>LIMITE DE PERTE MAX JOUR ($) *</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="1000 (Bloque la session en cas d'atteinte)"
              placeholderTextColor={theme.colors.textMuted}
              value={maxDailyLoss}
              onChangeText={setMaxDailyLoss}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>ENREGISTRER LE COMPTE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  screenTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  list: {
    paddingBottom: theme.spacing.xxl,
  },
  accountCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  titleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  accountName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  editBtn: {
    padding: 4,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  statLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  balanceValue: {
    color: theme.colors.greenLight,
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2,
  },
  initialValue: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  lockRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
  },
  lockRuleText: {
    color: theme.colors.goldLight,
    fontSize: 10,
  },
  boldText: {
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  inputLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: theme.spacing.sm,
  },
  modalInput: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    height: 44,
    paddingHorizontal: theme.spacing.md,
    color: '#ffffff',
    fontSize: 13,
  },
  gridRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  gridCol: {
    flex: 1,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    height: 46,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
});
