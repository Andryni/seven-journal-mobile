import React, { useMemo, useState } from 'react';
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
  Alert,
  RefreshControl,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAccounts } from '../features/accounts/useAccounts';
import { useTrades } from '../features/trades/useTrades';
import { formatCurrency } from '../utils/formatCurrency';
import { useUIStore } from '../store/uiStore';
import type { TradingAccount, AccountType, Trade } from '../types/domain';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { accountTypeLabel, useT } from '../i18n';
import { Badge } from '../components/ui/Badge';
import {
  Plus,
  Shield,
  Trash2,
  Edit3,
  X,
  Wallet,
  Target,
} from 'lucide-react-native';

const ACCOUNT_TYPE_IDS: AccountType[] = ['challenge', 'funded', 'personal', 'demo'];

const CURRENCIES = ['USD', 'EUR', 'GBP'];

export const AccountsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount, isCreating, isUpdating } = useAccounts();
  const { trades } = useTrades();
  const [refreshing, setRefreshing] = useState(false);
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const setActiveAccountId = useUIStore((state: { setActiveAccountId: (id: string | null) => void }) => state.setActiveAccountId);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingAcc, setEditingAcc] = useState<TradingAccount | null>(null);

  // Section 1: Identité
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('challenge');
  const [instrumentType, setInstrumentType] = useState<'CFD' | 'Futures'>('CFD');
  const [leverage, setLeverage] = useState('100');
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
  const [challengeEndDate, setChallengeEndDate] = useState('');

  const openAddModal = () => {
    setEditingAcc(null);
    setName('');
    setType('challenge');
    setInstrumentType('CFD');
    setLeverage('100');
    setBalance('100000');
    setInitialBalance('100000');
    setCurrency('USD');
    setMaxDailyLoss('1000');
    setProfitTarget('10000');
    setMaxDrawdownLimit('10000');
    setDrawdownType('static');
    setConsistencyRulePercent('15');
    setChallengeEndDate('');
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
    setChallengeEndDate((acc as any).challenge_end_date || '');
    setInstrumentType((acc as any).instrument_type || 'CFD');
    setLeverage((acc as any).leverage?.toString() || '100');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !balance.trim() || !initialBalance.trim()) {
      alert(t('requiredFields'));
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
      instrument_type: instrumentType,
      leverage: instrumentType === 'CFD' ? Number(leverage) : undefined,
      challenge_end_date: challengeEndDate || null,
    };

    if (editingAcc) {
      await updateAccount({ id: editingAcc.id, ...payload });
    } else {
      await createAccount(payload);
    }
    setModalVisible(false);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['trading_accounts'] });
    await queryClient.invalidateQueries({ queryKey: ['trades'] });
    setRefreshing(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      t('confirmTitle'),
      t('confirmDeleteAccount'),
      [
        { text: t('confirmNo'), style: 'cancel' },
        { text: t('confirmYes'), style: 'destructive', onPress: async () => { await deleteAccount(id); } },
      ],
    );
  };

  const renderAccountItem = ({ item }: { item: TradingAccount }) => {
    const isSelected = activeAccountId === item.id;
    const isProp = item.type === 'challenge' || item.type === 'funded';

    // Account specific trades & metrics calculation
    const accountTrades = trades.filter((t: Trade) => t.account_id === item.id);
    const closedTrades = accountTrades.filter((t: Trade) => t.pnl !== null);
    const winTrades = closedTrades.filter((t: Trade) => (t.pnl || 0) > 0);

    const cumulativePnl = closedTrades.reduce((sum: number, t: Trade) => sum + (t.pnl || 0), 0);
    const computedBalance = item.initial_balance + cumulativePnl;
    const pnlPercent = item.initial_balance > 0 ? (cumulativePnl / item.initial_balance) * 100 : 0;
    const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;
    const totalR = closedTrades.reduce((sum: number, t: Trade) => sum + (t.r_multiple || 0), 0);

    return (
      <TouchableOpacity
        style={[styles.accountCard, isSelected && styles.selectedCard]}
        onPress={() => setActiveAccountId(isSelected ? null : item.id)}
        activeOpacity={0.85}
      >
        {/* Card Top Header */}
        <View style={styles.cardHeader}>
          <View style={styles.titleInfo}>
            <View style={[styles.activeDot, isSelected && styles.activeDotSelected]} />
            <Text style={styles.accountName} numberOfLines={1}>{item.name}</Text>
            <Badge
              label={accountTypeLabel(t, item.type)}
              variant={item.type === 'funded' ? 'green' : item.type === 'challenge' ? 'gold' : 'blue'}
              size="sm"
            />
            {(item as any).instrument_type && (
              <Badge
                label={(item as any).instrument_type}
                variant="neutral"
                size="sm"
              />
            )}
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={() => openEditModal(item)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('editAccountA11y', item.name)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Edit3 color={theme.colors.textSecondary} size={14} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel={t('deleteAccountA11y', item.name)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Trash2 color={theme.colors.redLight} size={14} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary Balances Row */}
        <View style={styles.balanceRow}>
          <View>
            <Text style={styles.statLabel}>{t('currentBalance')}</Text>
            <Text style={styles.balanceValue}>
              {formatCurrency(computedBalance, { showPlus: false, thousandsSeparator: true })}
            </Text>
          </View>
          <View style={styles.alignRight}>
            <Text style={styles.statLabel}>{t('cumulatedPnl')}</Text>
            <Text
              style={[
                styles.pnlValue,
                cumulativePnl >= 0 ? styles.greenText : styles.redText,
              ]}
            >
              {formatCurrency(cumulativePnl)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
            </Text>
          </View>
        </View>

        {/* Multi-metric 3-box Grid (Positions, WR, Cumul R) */}
        <View style={styles.metricsGrid3}>
          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>{t('positions')}</Text>
            <Text style={styles.metricBoxValue}>{closedTrades.length}</Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>{t('winRate')}</Text>
            <Text style={[styles.metricBoxValue, winRate >= 50 ? styles.greenText : styles.redText]}>
              {winRate.toFixed(0)}%
            </Text>
          </View>
          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>{t('cumulR')}</Text>
            <Text style={[styles.metricBoxValue, totalR >= 0 ? styles.cyanText : styles.redText]}>
              {totalR >= 0 ? '+' : ''}{totalR.toFixed(1)}R
            </Text>
          </View>
        </View>

        {/* Lock Guard & Prop Info */}
        <View style={styles.footerRow}>
          <View style={styles.lockRuleBox}>
            <Shield color={theme.colors.goldLight} size={11} />
            <Text style={styles.lockRuleText}>
              {t('maxLossPerDay')} : {formatCurrency(item.max_daily_loss_limit ?? item.initial_balance * 0.01, { showPlus: false, decimals: 0 })}
            </Text>
          </View>

          {isProp && item.profit_target && (
            <View style={styles.targetRuleBox}>
              <Target color={theme.colors.greenLight} size={11} />
              <Text style={styles.targetRuleText}>
                {t('target')} : {formatCurrency(item.profit_target, { showPlus: false, decimals: 0, thousandsSeparator: true })}
              </Text>
            </View>
          )}

          <View style={styles.initialCapBox}>
            <Text style={styles.initialCapText}>
              {t('cap')}: {formatCurrency(item.initial_balance, { showPlus: false, decimals: 0, thousandsSeparator: true })} {item.currency}
            </Text>
          </View>
        </View>

        {/* Prop Firm Target Progress Bar */}
        {isProp && item.profit_target && item.profit_target > 0 && (
          <View style={styles.targetProgressContainer}>
            <View style={styles.targetProgressHeader}>
              <Text style={styles.targetProgressTitle}>{t('targetProgress')}</Text>
              <Text style={styles.targetProgressPercent}>
                {Math.min(100, Math.max(0, (cumulativePnl / item.profit_target) * 100)).toFixed(1)}%
              </Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, Math.max(0, (cumulativePnl / item.profit_target) * 100))}%`,
                    backgroundColor: cumulativePnl >= 0 ? theme.colors.green : theme.colors.red,
                  },
                ]}
              />
            </View>
          </View>
        )}
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
          <Text style={styles.screenTitle}>{t('screenTitleAccounts')}</Text>
          <Text style={styles.screenSubtitle}>{t('screenSubtitleAccounts')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
          <Plus color={theme.colors.textPrimary} size={16} />
          <Text style={styles.addBtnText}>{t('addAccount')}</Text>
        </TouchableOpacity>
      </View>

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

      {/* ── MODAL 100% PARITÉ WEB : AJOUTER / MODIFIER COMPTE ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {editingAcc ? t('editAccount') : t('newAccount')}
                </Text>
                <Text style={styles.modalSub}>
                  {editingAcc ? editingAcc.name : t('newAccountSub')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeBtn}
                accessibilityRole="button"
                accessibilityLabel={t('closeAccountForm')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X color={theme.colors.textPrimary} size={18} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll}>
              {/* ── SECTION 1 : IDENTITÉ DU COMPTE ── */}
              <View style={styles.formSection}>
                <Text style={styles.sectionHeader}>{t('accountIdentity')}</Text>
                
                <Text style={styles.fieldLabel}>{t('accountNameLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('accountNamePlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />

                <Text style={styles.fieldLabel}>{t('accountInstrumentLabel')}</Text>
                <View style={styles.typeGrid}>
                  {(['CFD', 'Futures'] as const).map(iType => (
                    <TouchableOpacity
                      key={iType}
                      style={[styles.typeBtn, instrumentType === iType && styles.typeBtnActive]}
                      onPress={() => setInstrumentType(iType)}
                    >
                      <Text style={[styles.typeBtnText, instrumentType === iType && styles.typeBtnTextActive]}>
                        {iType}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* CFD: Leverage */}
                {instrumentType === 'CFD' && (
                  <>
                    <Text style={styles.fieldLabel}>{t('accountLeverage') || 'LEVIER'}</Text>
                    <TextInput
                      style={styles.input}
                      value={leverage}
                      onChangeText={setLeverage}
                      keyboardType="numeric"
                      placeholder="100"
                      placeholderTextColor={theme.colors.textMuted}
                    />
                  </>
                )}

                <Text style={styles.fieldLabel}>{t('accountTypeLabel')}</Text>
                <View style={styles.typeGrid}>
                  {ACCOUNT_TYPE_IDS.map(id => (
                    <TouchableOpacity
                      key={id}
                      style={[styles.typeBtn, type === id && styles.typeBtnActive]}
                      onPress={() => setType(id)}
                    >
                      <Text style={[styles.typeBtnText, type === id && styles.typeBtnTextActive]}>
                        {accountTypeLabel(t, id)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.fieldLabel}>{t('currencyLabel')}</Text>
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
                  <Text style={styles.sectionHeader}>{t('capitalSection')}</Text>
                  <Text style={styles.lockBadge}>{t('lockGuardBadge')}</Text>
                </View>

                <View style={styles.row2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabel}>{t('initialBalanceLabel')}</Text>
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
                    <Text style={styles.fieldLabel}>{t('currentBalanceLabel')}</Text>
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

                <Text style={styles.fieldLabel}>{t('maxDailyLossLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('maxDailyLossPlaceholder')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={maxDailyLoss}
                  onChangeText={setMaxDailyLoss}
                  keyboardType="numeric"
                />
                <Text style={styles.fieldHint}>{t('maxDailyLossHint')}</Text>
              </View>

              {/* ── SECTION 3 : PARAMÈTRES PROP FIRM TRACKER (SI CHALLENGE OU FUNDED) ── */}
              {isPropSelected && (
                <View style={[styles.formSection, styles.propSection]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionHeader, { color: theme.colors.goldLight }]}>
                      {t('propParamsSection')}
                    </Text>
                    <Text style={styles.goldBadge}>{t('requiredBadge')}</Text>
                  </View>

                  <View style={styles.row2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldLabel}>{t('profitTargetLabel')}</Text>
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
                      <Text style={styles.fieldLabel}>{t('maxDrawdownLimitLabel')}</Text>
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

                  <Text style={styles.fieldLabel}>{t('drawdownTypeLabel')}</Text>
                  <View style={styles.row2}>
                    <TouchableOpacity
                      style={[styles.ddTypeBtn, drawdownType === 'static' && styles.ddTypeBtnActive]}
                      onPress={() => setDrawdownType('static')}
                    >
                      <Text style={[styles.ddTypeText, drawdownType === 'static' && styles.ddTypeTextActive]}>
                        {t('drawdownStatic')}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.ddTypeBtn, drawdownType === 'trailing' && styles.ddTypeBtnActive]}
                      onPress={() => setDrawdownType('trailing')}
                    >
                      <Text style={[styles.ddTypeText, drawdownType === 'trailing' && styles.ddTypeTextActive]}>
                        {t('drawdownTrailing')}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.fieldLabel}>{t('consistencyRuleLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('consistencyRulePlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={consistencyRulePercent}
                    onChangeText={setConsistencyRulePercent}
                    keyboardType="numeric"
                  />

                  <Text style={styles.fieldLabel}>{t('challengeEndDateLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.colors.textMuted}
                    value={challengeEndDate}
                    onChangeText={setChallengeEndDate}
                  />
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.saveBtn, (isCreating || isUpdating) && { opacity: 0.6 }]}
                  onPress={handleSave}
                  activeOpacity={0.8}
                  disabled={isCreating || isUpdating}
                >
                  {isCreating || isUpdating ? (
                    <ActivityIndicator color={theme.colors.textPrimary} size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>
                      {editingAcc ? t('saveChanges') : t('createAccount')}
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1.2,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
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
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },
  listContent: {
    paddingBottom: 40,
  },
  accountCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  selectedCard: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: theme.colors.surface,
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
    flex: 1,
    marginRight: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceLight,
  },
  activeDotSelected: {
    backgroundColor: theme.colors.green,
  },
  accountName: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.sansBold,
    flexShrink: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: theme.colors.surface,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
  },
  balanceValue: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  pnlValue: {
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  metricsGrid3: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    marginBottom: 8,
  },
  metricBox: {
    flex: 1,
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  metricBoxLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  metricBoxValue: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.monoExtraBold,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
    paddingTop: 8,
  },
  lockRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  lockRuleText: {
    color: theme.colors.goldLight,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  targetRuleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  targetRuleText: {
    color: theme.colors.greenLight,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  targetProgressContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
  },
  targetProgressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  targetProgressTitle: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  targetProgressPercent: {
    color: theme.colors.green,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  progressBarTrack: {
    height: 5,
    backgroundColor: theme.colors.inputBg,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  initialCapBox: {
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  initialCapText: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 30,
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderBright,
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
    borderBottomColor: theme.colors.cardBorder,
    paddingBottom: 10,
    marginBottom: 12,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 1,
  },
  modalSub: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  modalScroll: {
    paddingBottom: 20,
  },
  formSection: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  propSection: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: theme.colors.surface,
  },
  sectionHeader: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 1,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    paddingBottom: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lockBadge: {
    color: theme.colors.goldLight,
    fontSize: 9,
    fontWeight: '800',
  },
  goldBadge: {
    color: theme.colors.goldLight,
    fontSize: 9,
    fontWeight: '800',
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    marginBottom: 4,
    marginTop: 6,
  },
  fieldHint: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.sans,
    marginTop: 3,
  },
  input: {
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 8,
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
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
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.cardBorder,
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
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  typeBtnTextActive: {
    color: theme.colors.textPrimary,
  },
  currencyRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  currBtn: {
    flex: 1,
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.cardBorder,
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
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
  },
  currBtnTextActive: {
    color: theme.colors.textPrimary,
  },
  row2: {
    flexDirection: 'row',
    gap: 8,
  },
  ddTypeBtn: {
    flex: 1,
    backgroundColor: theme.colors.backgroundElevated,
    borderColor: theme.colors.cardBorder,
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
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  ddTypeTextActive: {
    color: theme.colors.goldLight,
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
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 0.8,
  },
  cancelBtn: {
    backgroundColor: theme.colors.surface,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: theme.fonts.monoMedium,
  },
  greenText: {
    color: theme.colors.green,
  },
  redText: {
    color: theme.colors.red,
  },
  cyanText: {
    color: theme.colors.cyanLight,
  },
});
