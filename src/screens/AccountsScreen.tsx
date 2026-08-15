import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAccounts } from '../features/accounts/useAccounts';
import { useUIStore } from '../store/uiStore';
import type { TradingAccount, AccountType } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Plus, Shield, Check, Trash2, Edit3, X, DollarSign, Wallet, Target, Activity } from 'lucide-react-native';

const ACCOUNT_TYPES: { id: AccountType; label: string }[] = [
  { id: 'challenge', label: 'CHALLENGE PROP' },
  { id: 'funded', label: 'FUNDED PROP' },
  { id: 'personal', label: 'COMPTE PERSONNEL' },
  { id: 'demo', label: 'COMPTE DEMO' },
];

const CURRENCIES = ['USD', 'EUR', 'GBP'];

export const AccountsScreen: React.FC = () => {
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount } = useAccounts();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const setActiveAccountId = useUIStore((state: { setActiveAccountId: (id: string | null) => void }) => state.setActiveAccountId);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAcc, setEditingAcc] = useState<TradingAccount | null>(null);

  // Section 1: Identité
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('challenge');
  const [currency, setCurrency] = useState('USD');

  // Section 2: Capital & Garde-fou
  const [initialBalance, setInitialBalance] = useState('100000');
  const [balance, setBalance] = useState('100000');
  const [maxDailyLoss, setMaxDailyLoss] = useState('1000');

  // Section 3: Prop Firm Parameters
  const [profitTarget, setProfitTarget] = useState('10000');
  const [maxDrawdownLimit, setMaxDrawdownLimit] = useState('10000');
  const [drawdownType, setDrawdownType] = useState<'static' | 'trailing'>('static');
  const [consistencyRulePercent, setConsistencyRulePercent] = useState('15');

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
    setDrawdownType('static');
    setConsistencyRulePercent('15');
    setModalVisible(true);
  };

  const openEditModal = (acc: TradingAccount) => {
    setEditingAcc(acc);
    setName(acc.name);
    setType(acc.type);
    setBalance(acc.balance.toString());
    setInitialBalance(acc.initial_balance.toString());
    setCurrency(acc.currency || 'USD');
    setMaxDailyLoss(acc.max_daily_loss_limit ? acc.max_daily_loss_limit.toString() : '');
    setProfitTarget(acc.profit_target ? acc.profit_target.toString() : '');
    setMaxDrawdownLimit(acc.max_drawdown_limit ? acc.max_drawdown_limit.toString() : '');
    setDrawdownType((acc as any).drawdown_type || 'static');
    setConsistencyRulePercent((acc as any).consistency_rule_percent ? (acc as any).consistency_rule_percent.toString() : '15');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !balance.trim() || !initialBalance.trim()) {
      alert('Veuillez remplir tous les champs obligatoires (*).');
      return;
    }

    const payload = {
      name: name.trim(),
      type,
      balance: Number(balance),
      initial_balance: Number(initialBalance),
      currency,
      is_active: true,
      max_daily_loss_limit: maxDailyLoss ? Number(maxDailyLoss) : null,
      profit_target: profitTarget ? Number(profitTarget) : null,
      max_drawdown_limit: maxDrawdownLimit ? Number(maxDrawdownLimit) : null,
      drawdown_type: drawdownType,
      consistency_rule_percent: consistencyRulePercent ? Number(consistencyRulePercent) : null,
    };

    if (editingAcc) {
      await updateAccount({ id: editingAcc.id, ...payload });
    } else {
      await createAccount(payload);
    }
    setModalVisible(false);
  };

  const handleDelete = async (id: string) => {
    await deleteAccount(id);
  };

  const renderAccountItem = ({ item }: { item: TradingAccount }) => {
    const isSelected = activeAccountId === item.id;
    const isProp = item.type === 'challenge' || item.type === 'funded';

    return (
      <TouchableOpacity
        style={[styles.accountCard, isSelected && styles.selectedCard]}
        onPress={() => setActiveAccountId(isSelected ? null : item.id)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleInfo}>
            <Text style={styles.accountName}>{item.name}</Text>
            <Badge
              label={item.type.toUpperCase()}
              variant={item.type === 'funded' ? 'green' : item.type === 'challenge' ? 'gold' : 'blue'}
              size="sm"
            />
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity onPress={() => openEditModal(item)} style={styles.iconBtn}>
              <Edit3 color={theme.colors.textSecondary} size={15} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
              <Trash2 color={theme.colors.redLight} size={15} />
            </TouchableOpacity>
          </View>
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

        {/* Lock Guard & Prop Info */}
        <View style={styles.footerRow}>
          <View style={styles.lockRuleBox}>
            <Shield color={theme.colors.goldLight} size={12} />
            <Text style={styles.lockRuleText}>
              Perte Max/J : ${item.max_daily_loss_limit ?? (item.initial_balance * 0.01).toFixed(0)}
            </Text>
          </View>

          {isProp && item.profit_target && (
            <View style={styles.targetRuleBox}>
              <Target color={theme.colors.greenLight} size={12} />
              <Text style={styles.targetRuleText}>
                TP : ${item.profit_target.toLocaleString()}
              </Text>
            </View>
          )}
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

  const isPropSelected = type === 'challenge' || type === 'funded';

  return (
    <View style={styles.container}>
      {/* ── HEADER ── */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>COMPTES DE TRADING</Text>
          <Text style={styles.screenSubtitle}>Prop Firms, Comptes Personnels & Lock Guard</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
          <Plus color="#ffffff" size={16} />
          <Text style={styles.addBtnText}>AJOUTER</Text>
        </TouchableOpacity>
      </View>

      {/* ── ACCOUNTS LIST ── */}
      <FlatList
        data={accounts}
        keyExtractor={item => item.id}
        renderItem={renderAccountItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Wallet size={36} color={theme.colors.textDark} />
            <Text style={styles.emptyTitle}>Aucun compte enregistré</Text>
            <Text style={styles.emptySub}>Ajoutez votre compte Prop Firm ou Personnel.</Text>
          </View>
        }
      />

      {/* ── MODAL 100% PARITÉ WEB : AJOUTER / MODIFIER COMPTE ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingAcc ? 'MODIFIER LE COMPTE' : 'NOUVEAU COMPTE'}
                </Text>
                <Text style={styles.modalSub}>
                  {editingAcc ? editingAcc.name : 'Prop Firm / Compte Personnel / Démo'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <X color="#ffffff" size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* ── SECTION 1 : IDENTITÉ DU COMPTE ── */}
              <View style={styles.formSection}>
                <Text style={styles.sectionHeader}>1. IDENTITÉ DU COMPTE</Text>
                
                <Text style={styles.fieldLabel}>Nom du compte *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: Challenge FTMO 100K"
                  placeholderTextColor={theme.colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.fieldLabel}>Type de compte *</Text>
                <View style={styles.typeGrid}>
                  {ACCOUNT_TYPES.map(t => (
                    <TouchableOpacity
                      key={t.id}
                      style={[styles.typeBtn, type === t.id && styles.typeBtnActive]}
                      onPress={() => setType(t.id)}
                    >
                      <Text style={[styles.typeBtnText, type === t.id && styles.typeBtnTextActive]}>
                        {t.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>Devise</Text>
                <View style={styles.currencyRow}>
                  {CURRENCIES.map(curr => (
                    <TouchableOpacity
                      key={curr}
                      style={[styles.currBtn, currency === curr && styles.currBtnActive]}
                      onPress={() => setCurrency(curr)}
                    >
                      <Text style={[styles.currBtnText, currency === curr && styles.currBtnTextActive]}>
                        {curr} ({curr === 'USD' ? '$' : curr === 'EUR' ? '€' : '£'})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* ── SECTION 2 : CAPITAL & GARDE-FOU ── */}
              <View style={styles.formSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeader}>2. CAPITAL & GARDE-FOU</Text>
                  <Text style={styles.lockBadge}>🔒 Lock Guard</Text>
                </View>

                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Capital Initial ($) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="100000"
                      placeholderTextColor={theme.colors.textMuted}
                      value={initialBalance}
                      onChangeText={setInitialBalance}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>Solde Actuel ($) *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="100000"
                      placeholderTextColor={theme.colors.textMuted}
                      value={balance}
                      onChangeText={setBalance}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Text style={styles.fieldLabel}>Perte Max Quotidienne / Daily Loss ($) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: 1000 ($1,000 ou 1% du capital)"
                  placeholderTextColor={theme.colors.textMuted}
                  value={maxDailyLoss}
                  onChangeText={setMaxDailyLoss}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>
                  La session sera automatiquement verrouillée si la perte du jour atteint ce seuil.
                </Text>
              </View>

              {/* ── SECTION 3 : PARAMÈTRES PROP FIRM TRACKER (SI CHALLENGE OU FUNDED) ── */}
              {isPropSelected && (
                <View style={[styles.formSection, styles.propSection]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionHeader, { color: theme.colors.goldLight }]}>
                      3. PARAMÈTRES PROP FIRM TRACKER
                    </Text>
                    <Text style={styles.goldBadge}>Requis</Text>
                  </View>

                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Objectif de Profit ($) *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="ex: 10000"
                        placeholderTextColor={theme.colors.textMuted}
                        value={profitTarget}
                        onChangeText={setProfitTarget}
                        keyboardType="numeric"
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>Max Drawdown Limite ($) *</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="ex: 10000"
                        placeholderTextColor={theme.colors.textMuted}
                        value={maxDrawdownLimit}
                        onChangeText={setMaxDrawdownLimit}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <Text style={styles.fieldLabel}>Type de Drawdown (Calcul) *</Text>
                  <View style={styles.row2}>
                    <TouchableOpacity
                      style={[styles.ddTypeBtn, drawdownType === 'static' && styles.ddTypeBtnActive]}
                      onPress={() => setDrawdownType('static')}
                    >
                      <Text style={[styles.ddTypeText, drawdownType === 'static' && styles.ddTypeTextActive]}>
                        STATIC (Fixe)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.ddTypeBtn, drawdownType === 'trailing' && styles.ddTypeBtnActive]}
                      onPress={() => setDrawdownType('trailing')}
                    >
                      <Text style={[styles.ddTypeText, drawdownType === 'trailing' && styles.ddTypeTextActive]}>
                        TRAILING (Suit l'Equity)
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>Règle de Consistance (%)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: 15 (FTMO 15%, FundedNext 20%)"
                    placeholderTextColor={theme.colors.textMuted}
                    value={consistencyRulePercent}
                    onChangeText={setConsistencyRulePercent}
                    keyboardType="numeric"
                  />
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                  <Text style={styles.saveBtnText}>
                    {editingAcc ? 'SAUVEGARDER LES MODIFICATIONS' : 'CRÉER LE COMPTE'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>ANNULER</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    marginBottom: theme.spacing.md,
  },
  screenTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.2,
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
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  listContent: {
    paddingBottom: 40,
  },
  accountCard: {
    backgroundColor: '#12141c',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#141724',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accountName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  balanceValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  initialValue: {
    color: theme.colors.textSecondary,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 8,
    marginTop: 6,
  },
  lockRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockRuleText: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '700',
  },
  targetRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  targetRuleText: {
    color: '#34d399',
    fontSize: 9,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 30,
  },
  modalContent: {
    backgroundColor: '#12141c',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
  modalSub: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalScroll: {
    paddingBottom: 20,
  },
  formSection: {
    backgroundColor: '#161922',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  propSection: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: '#18171d',
  },
  sectionHeader: {
    color: '#818cf8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
    paddingBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockBadge: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '800',
  },
  goldBadge: {
    color: '#fbbf24',
    fontSize: 9,
    fontWeight: '800',
  },
  fieldLabel: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    marginTop: 6,
  },
  fieldHint: {
    color: '#64748b',
    fontSize: 9,
    marginTop: 3,
  },
  input: {
    backgroundColor: '#0e1017',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 8,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 10,
    height: 38,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  typeBtn: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#0e1017',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  typeBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  typeBtnText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
  },
  typeBtnTextActive: {
    color: '#ffffff',
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  currBtn: {
    flex: 1,
    backgroundColor: '#0e1017',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  currBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  currBtnText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
  },
  currBtnTextActive: {
    color: '#ffffff',
  },
  row2: {
    flexDirection: 'row',
    gap: 8,
  },
  ddTypeBtn: {
    flex: 1,
    backgroundColor: '#0e1017',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  ddTypeBtnActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderColor: theme.colors.gold,
  },
  ddTypeText: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
  },
  ddTypeTextActive: {
    color: '#fbbf24',
  },
  modalActions: {
    gap: 8,
    marginTop: 10,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  cancelBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#94a3b8',
    fontSize: 10,
    fontWeight: '800',
  },
});
