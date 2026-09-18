import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { withAlpha } from '../../theme';
import { accountTypeLabel, useT } from '../../i18n';
import { formatCurrency, currencySymbol, CURRENCIES } from '../../utils/formatCurrency';
import { MARKET_TYPES } from '../../utils/positionSizing';
import { useMarketUnitLabel } from '../../features/accounts/useMarket';
import type { TradingAccount, AccountType, MarketType } from '../../types/domain';

const ACCOUNT_TYPE_IDS: AccountType[] = ['challenge', 'funded', 'personal', 'demo'];

/**
 * Add/edit account form, extracted from the accounts screen.
 *
 * The one piece of new behaviour is the feed toggle: 'manual' (default) is
 * the classic typed journal; 'auto' declares the account as fed by a sync
 * connector — its current balance is then derived (initial + net P&L), so
 * the balance field disappears rather than collecting a value nobody reads.
 */
export const AccountFormModal: React.FC<{
  visible: boolean;
  editing: TradingAccount | null;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => void;
}> = ({ visible, editing, onClose, onSave }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Section 1: Identité
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('challenge');
  const [instrumentType, setInstrumentType] = useState<MarketType>('CFD');
  const [feedMode, setFeedMode] = useState<'manual' | 'auto'>('manual');
  const unitLabelForForm = useMarketUnitLabel(instrumentType);
  const [currency, setCurrency] = useState('USD');
  /** Wizard step: which platform feeds the account, once Auto is chosen.
   * The connector itself is created by the screen after onSave resolves —
   * the form only carries the choice. */
  const [platform, setPlatform] = useState<'mt5_ea' | 'ctrader'>('mt5_ea');

  // Section 2: Capital & Garde-fou
  const [initialBalance, setInitialBalance] = useState('100000');
  const [balance, setBalance] = useState('100000');
  const [maxDailyLoss, setMaxDailyLoss] = useState('1000');
  const [maxTradesPerDay, setMaxTradesPerDay] = useState('');
  const [maxConsecutiveLosses, setMaxConsecutiveLosses] = useState('');
  const [maxRiskPerTradePct, setMaxRiskPerTradePct] = useState('');

  // Section 3: Prop Firm Parameters
  const [profitTarget, setProfitTarget] = useState('10000');
  const [maxDrawdownLimit, setMaxDrawdownLimit] = useState('10000');
  const [drawdownType, setDrawdownType] = useState<'static' | 'trailing'>('static');
  const [consistencyRulePercent, setConsistencyRulePercent] = useState('15');
  const [challengeEndDate, setChallengeEndDate] = useState('');

  // Re-seed the fields each time the modal opens for a different account —
  // keeping them in a parent would have kept 12 live states around forever.
  useEffect(() => {
    if (!visible) return;
    if (editing) {
      setName(editing.name);
      setType(editing.type);
      setBalance(editing.balance.toString());
      setInitialBalance(editing.initial_balance.toString());
      setCurrency(editing.currency || 'USD');
      setMaxDailyLoss(editing.max_daily_loss_limit ? editing.max_daily_loss_limit.toString() : '');
      setProfitTarget(editing.profit_target ? editing.profit_target.toString() : '');
      setMaxDrawdownLimit(editing.max_drawdown_limit ? editing.max_drawdown_limit.toString() : '');
      setDrawdownType(editing.drawdown_type || 'static');
      setConsistencyRulePercent(
        editing.consistency_rule_percent ? editing.consistency_rule_percent.toString() : '15'
      );
      setChallengeEndDate(editing.challenge_end_date || '');
      setInstrumentType(editing.instrument_type || 'CFD');
      setFeedMode(editing.feed_mode === 'auto' ? 'auto' : 'manual');
      setPlatform('mt5_ea');
      setMaxTradesPerDay(editing.max_trades_per_day ? String(editing.max_trades_per_day) : '');
      setMaxConsecutiveLosses(
        editing.max_consecutive_losses ? String(editing.max_consecutive_losses) : ''
      );
      setMaxRiskPerTradePct(
        editing.max_risk_per_trade_pct ? String(editing.max_risk_per_trade_pct) : ''
      );
    } else {
      setName('');
      setType('challenge');
      setInstrumentType('CFD');
      setFeedMode('manual');
      setPlatform('mt5_ea');
      setBalance('100000');
      setInitialBalance('100000');
      setCurrency('USD');
      setMaxDailyLoss('1000');
      setProfitTarget('10000');
      setMaxDrawdownLimit('10000');
      setDrawdownType('static');
      setConsistencyRulePercent('15');
      setChallengeEndDate('');
      setMaxTradesPerDay('');
      setMaxConsecutiveLosses('');
      setMaxRiskPerTradePct('');
    }
  }, [visible, editing]);

  const isAuto = feedMode === 'auto';

  const handleSave = () => {
    if (!name.trim() || !initialBalance.trim() || (!isAuto && !balance.trim())) {
      alert(t('requiredFields'));
      return;
    }

    onSave({
      name: name.trim(),
      type,
      // An auto account's balance is derived; the stored column still exists,
      // seeded from the initial balance so any legacy reader stays coherent.
      balance: isAuto ? Number(initialBalance) : Number(balance),
      initial_balance: Number(initialBalance),
      currency,
      is_active: true,
      feed_mode: feedMode,
      // Read by the screen after save: when feed_mode is 'auto', it creates
      // and links the connector for this platform as part of the same flow.
      _autoPlatform: feedMode === 'auto' ? platform : null,
      max_daily_loss_limit: maxDailyLoss ? Number(maxDailyLoss) : null,
      profit_target: profitTarget ? Number(profitTarget) : null,
      max_drawdown_limit: maxDrawdownLimit ? Number(maxDrawdownLimit) : null,
      drawdown_type: drawdownType,
      consistency_rule_percent: consistencyRulePercent ? Number(consistencyRulePercent) : null,
      instrument_type: instrumentType,
      challenge_end_date: challengeEndDate || null,
      // Blank means "no rule". Number('') is 0, which the schema rejects and
      // which would otherwise lock the session permanently.
      max_trades_per_day: maxTradesPerDay ? Number(maxTradesPerDay) : null,
      max_consecutive_losses: maxConsecutiveLosses ? Number(maxConsecutiveLosses) : null,
      max_risk_per_trade_pct: maxRiskPerTradePct ? Number(maxRiskPerTradePct) : null,
    });
  };

  const isPropSelected = type === 'challenge' || type === 'funded';

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>
                {editing ? t('editAccount') : t('newAccount')}
              </Text>
              <Text style={styles.modalSub}>
                {editing ? editing.name : t('newAccountSub')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
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
                {MARKET_TYPES.map(iType => (
                  <TouchableOpacity
                    key={iType}
                    style={[styles.typeBtn, instrumentType === iType && styles.typeBtnActive]}
                    onPress={() => setInstrumentType(iType)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: instrumentType === iType }}
                    accessibilityLabel={iType}
                  >
                    <Text style={[styles.typeBtnText, instrumentType === iType && styles.typeBtnTextActive]}>
                      {iType}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {/* The market is not cosmetic: it selects the instrument list
                  and the unit positions are sized in. */}
              <Text style={styles.fieldHint}>
                {t('marketHint')} · {unitLabelForForm}
              </Text>

              <Text style={styles.fieldLabel}>{t('accountTypeLabel')}</Text>
              <View style={styles.typeGrid}>
                {ACCOUNT_TYPE_IDS.map(id => (
                  <TouchableOpacity
                    key={id}
                    style={[styles.typeBtn, type === id && styles.typeBtnActive]}
                    onPress={() => setType(id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: type === id }}
                    accessibilityLabel={accountTypeLabel(t, id)}
                  >
                    <Text style={[styles.typeBtnText, type === id && styles.typeBtnTextActive]}>
                      {accountTypeLabel(t, id)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Feed mode: how trades reach this account. Auto means the
                  journal fills itself from the broker connector. */}
              <Text style={styles.fieldLabel}>{t('accountFeedModeLabel')}</Text>
              <View style={styles.row2}>
                <TouchableOpacity
                  style={[styles.ddTypeBtn, !isAuto && styles.ddTypeBtnActive]}
                  onPress={() => setFeedMode('manual')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !isAuto }}
                >
                  <Text style={[styles.ddTypeText, !isAuto && styles.ddTypeTextActive]}>
                    {t('accountFeedModeManual')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.ddTypeBtn, isAuto && styles.ddTypeBtnActive]}
                  onPress={() => setFeedMode('auto')}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isAuto }}
                >
                  <Text style={[styles.ddTypeText, isAuto && styles.ddTypeTextActive]}>
                    {t('accountFeedModeAuto')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.fieldHint}>{t('accountFeedModeHint')}</Text>

              {/* Auto chosen: the next tap is WHICH platform. The connector is
                  created and linked right after the account saves — the user
                  never visits Journal auto to route it by hand. */}
              {isAuto && (
                <>
                  <Text style={styles.fieldLabel}>{t('accountPlatformLabel')}</Text>
                  <View style={styles.row2}>
                    <TouchableOpacity
                      style={[styles.ddTypeBtn, platform === 'mt5_ea' && styles.ddTypeBtnActive]}
                      onPress={() => setPlatform('mt5_ea')}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: platform === 'mt5_ea' }}
                    >
                      <Text style={[styles.ddTypeText, platform === 'mt5_ea' && styles.ddTypeTextActive]}>
                        MT5
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ddTypeBtn, platform === 'ctrader' && styles.ddTypeBtnActive]}
                      onPress={() => setPlatform('ctrader')}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: platform === 'ctrader' }}
                    >
                      <Text style={[styles.ddTypeText, platform === 'ctrader' && styles.ddTypeTextActive]}>
                        cTrader
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.fieldHint}>{t('accountPlatformHint')}</Text>
                </>
              )}

              <Text style={styles.fieldLabel}>{t('currencyLabel')}</Text>
              <View style={styles.currencyRow}>
                {CURRENCIES.map(curr => (
                  <TouchableOpacity
                    key={curr}
                    style={[styles.currBtn, currency === curr && styles.currBtnActive]}
                    onPress={() => setCurrency(curr)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: currency === curr }}
                    accessibilityLabel={curr}
                  >
                    <Text style={[styles.currBtnText, currency === curr && styles.currBtnTextActive]}>
                      {curr} ({currencySymbol(curr)})
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

                {/* Hidden on auto accounts: their balance is computed from
                    the journal (initial + net P&L), so an editable field
                    would only ever lie. */}
                {!isAuto && (
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
                )}
              </View>
              {isAuto && (
                <Text style={styles.fieldHint}>{t('accountBalanceAutoHint')}</Text>
              )}

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

            {/* ── RÈGLES PERSONNELLES — tous types de comptes ── */}
            <View style={styles.formSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeader}>{t('personalRulesSection')}</Text>
                <Text style={styles.fieldHint}>{t('optionalBadge')}</Text>
              </View>
              <Text style={styles.fieldHint}>{t('personalRulesIntro')}</Text>

              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('maxTradesPerDayLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('noLimitPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={maxTradesPerDay}
                    onChangeText={setMaxTradesPerDay}
                    keyboardType="number-pad"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>{t('maxConsecutiveLossesLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('noLimitPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={maxConsecutiveLosses}
                    onChangeText={setMaxConsecutiveLosses}
                    keyboardType="number-pad"
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>{t('maxRiskPerTradeLabel')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('noLimitPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={maxRiskPerTradePct}
                onChangeText={setMaxRiskPerTradePct}
                keyboardType="decimal-pad"
              />
              <Text style={styles.fieldHint}>{t('personalRulesHint')}</Text>
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
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.8}>
                <Text style={styles.saveBtnText}>
                  {editing ? t('saveChanges') : t('createAccount')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelBtnText}>{t('cancel')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: withAlpha(theme.colors.scrim, 0.85),
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
      borderColor: withAlpha(theme.colors.gold, 0.3),
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
      fontFamily: theme.fonts.monoBold,
    },
    goldBadge: {
      color: theme.colors.goldLight,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
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
      backgroundColor: withAlpha(theme.colors.primary, 0.2),
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
      backgroundColor: withAlpha(theme.colors.primary, 0.2),
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
      backgroundColor: withAlpha(theme.colors.gold, 0.2),
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
  });
