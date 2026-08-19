import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { accountTypeLabel, localeFor, mentalStateLabel, sessionLabel, useT } from '../../i18n';
import { useTrades } from '../../features/trades/useTrades';
import { useAccounts } from '../../features/accounts/useAccounts';
import { usePlaybookSetups } from '../../features/playbook/usePlaybook';
import { useUIStore } from '../../store/uiStore';
import type { Trade, TradeTimeframe, MentalState } from '../../types/domain';
import { calculateRMultiple } from '../../utils/financials';
import { formatCurrency } from '../../utils/formatCurrency';
import { PickerModal } from '../ui/PickerModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  X,
  AlertCircle,
  Image as ImageIcon,
  Upload,
  Link,
  Target,
  Layers,
  ChevronDown,
  Clock,
  Wallet,
  Calendar,
} from 'lucide-react-native';

const TIMEFRAMES: TradeTimeframe[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
const SESSION_IDS = ['', 'Asia', 'London', 'New York', 'Over Session'] as const;

const MENTAL_STATE_IDS: MentalState[] = ['focused', 'anxious', 'greedy', 'revenge', 'fomo', 'tired'];

interface TradeFormModalProps {
  visible: boolean;
  onClose: () => void;
  editingTrade?: Trade | null;
}

export const TradeFormModal: React.FC<TradeFormModalProps> = ({
  visible,
  onClose,
  editingTrade,
}) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { createTrade, updateTrade, isCreating, isUpdating } = useTrades();
  const { accounts } = useAccounts();
  const { setups: playbookSetups } = usePlaybookSetups();
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const isDailySessionLocked = useUIStore((state: { isDailySessionLocked: boolean }) => state.isDailySessionLocked);

  // Form State - Section 1
  const [accountId, setAccountId] = useState(activeAccountId || (accounts[0]?.id ?? ''));
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [sessionPickerVisible, setSessionPickerVisible] = useState(false);
  const [pair, setPair] = useState('XAUUSD');
  const [entryDateObj, setEntryDateObj] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [timeframe, setTimeframe] = useState<TradeTimeframe>('M5');
  const [session, setSession] = useState<'Asia' | 'London' | 'New York' | 'Over Session' | ''>('London');
  const [size, setSize] = useState('1.0');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [result, setResult] = useState<'TP' | 'SL' | 'BE' | 'OPEN'>('OPEN');

  // Risk Parameters
  const [riskType, setRiskType] = useState<'percent' | 'usd'>('percent');
  const [riskValue, setRiskValue] = useState('1');

  // Calculated / Manual Overwrite
  const [manualPnl, setManualPnl] = useState('');
  const [manualRMultiple, setManualRMultiple] = useState('');

  // Section 2: Strategy & Setup (Playbook Only)
  const [selectedSetupTitle, setSelectedSetupTitle] = useState('');

  // Section 3: Screenshots (URL or Local Pick)
  const [screenshotBefore, setScreenshotBefore] = useState('');
  const [screenshotAfter, setScreenshotAfter] = useState('');
  const [screenshotBeforeType, setScreenshotBeforeType] = useState<'url' | 'file'>('url');
  const [screenshotAfterType, setScreenshotAfterType] = useState<'url' | 'file'>('url');

  // Section 4: Mental State & Notes
  const [mentalState, setMentalState] = useState<MentalState>('focused');
  const [notes, setNotes] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingTrade) {
      setAccountId(editingTrade.account_id);
      setPair(editingTrade.pair);
      if (editingTrade.entry_time) {
        const dt = new Date(editingTrade.entry_time);
        if (!isNaN(dt.getTime())) {
          setEntryDateObj(dt);
        }
      }
      setDirection(editingTrade.direction);
      setTimeframe(editingTrade.timeframe);
      setSession(editingTrade.session || '');
      setSize(editingTrade.size.toString());
      setEntryPrice(editingTrade.entry_price.toString());
      setStopLoss(editingTrade.stop_loss.toString());
      setTakeProfit(editingTrade.take_profit.toString());
      setExitPrice(editingTrade.exit_price ? editingTrade.exit_price.toString() : '');
      setResult(editingTrade.result);
      setManualPnl(editingTrade.pnl !== null ? editingTrade.pnl.toString() : '');
      setManualRMultiple(editingTrade.r_multiple !== null ? editingTrade.r_multiple.toString() : '');
      setSelectedSetupTitle(
        editingTrade.setup_structures && editingTrade.setup_structures.length > 0
          ? editingTrade.setup_structures.find(s => s !== 'BOS') || editingTrade.setup_structures[0]
          : ''
      );
      setScreenshotBefore(editingTrade.screenshot_before_url || '');
      setScreenshotAfter(editingTrade.screenshot_after_url || '');
      setMentalState(editingTrade.mental_state || 'focused');
      setNotes(editingTrade.notes || '');
    } else {
      resetForm();
    }
  }, [editingTrade, visible]);

  const resetForm = () => {
    setAccountId(activeAccountId || (accounts[0]?.id ?? ''));
    setAccountPickerVisible(false);
    setSessionPickerVisible(false);
    setPair('XAUUSD');
    setEntryDateObj(new Date());
    setShowDatePicker(false);
    setShowTimePicker(false);
    setDirection('BUY');
    setTimeframe('M5');
    setSession('London');
    setSize('1.0');
    setEntryPrice('');
    setStopLoss('');
    setTakeProfit('');
    setExitPrice('');
    setResult('OPEN');
    setRiskType('percent');
    setRiskValue('1');
    setManualPnl('');
    setManualRMultiple('');
    setSelectedSetupTitle('');
    setScreenshotBefore('');
    setScreenshotAfter('');
    setMentalState('focused');
    setNotes('');
    setErrorMsg('');
  };

  // Live Auto-Calculation Effect
  useEffect(() => {
    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    const exit = exitPrice ? Number(exitPrice) : null;
    const rVal = Number(riskValue);

    if (!isNaN(entry) && !isNaN(sl) && entry > 0 && sl > 0 && entry !== sl) {
      const selectedAccount = accounts.find(acc => acc.id === accountId);
      const balance = selectedAccount ? selectedAccount.balance : 100000;

      let calculatedRiskUsd = 0;
      if (!isNaN(rVal) && rVal > 0) {
        calculatedRiskUsd = riskType === 'percent' ? balance * (rVal / 100) : rVal;
      }

      const slDist = Math.abs(entry - sl);
      let r = 0;
      if (result === 'TP') {
        r = Math.abs(tp - entry) / slDist;
      } else if (result === 'SL') {
        r = -1;
      } else if (result === 'BE') {
        r = 0;
      } else if (exit !== null && exit > 0) {
        r = calculateRMultiple({ direction, entryPrice: entry, exitPrice: exit, stopLoss: sl });
      }

      if (r !== 0 && !isNaN(r)) {
        const nextR = r.toFixed(2);
        setManualRMultiple(nextR);

        if (calculatedRiskUsd > 0) {
          setManualPnl((r * calculatedRiskUsd).toFixed(2));
        } else {
          const lot = Number(size) || 1;
          const pnl = direction === 'BUY'
            ? ((exit ?? tp) - entry) * lot * 100
            : (entry - (exit ?? tp)) * lot * 100;
          setManualPnl(pnl.toFixed(2));
        }
      }
    }
  }, [entryPrice, stopLoss, takeProfit, exitPrice, direction, result, size, riskValue, riskType, accountId, accounts]);

  // Image Picker Handler
  const pickImage = async (target: 'before' | 'after') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      alert(t('tfPermissionRequired'));
      return;
    }

    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!res.canceled && res.assets && res.assets.length > 0) {
      const asset = res.assets[0];
      const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      if (target === 'before') {
        setScreenshotBefore(dataUri);
      } else {
        setScreenshotAfter(dataUri);
      }
    }
  };

  const handleSubmit = async () => {
    setErrorMsg('');

    if (isDailySessionLocked && !editingTrade) {
      setErrorMsg(t('tfSessionLocked'));
      return;
    }

    if (!accountId || !pair.trim() || !entryPrice || !stopLoss || !takeProfit || !size) {
      setErrorMsg(t('tfRequiredFields'));
      return;
    }

    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    const lotSize = Number(size);
    const exit = exitPrice ? Number(exitPrice) : null;
    const finalPnl = manualPnl ? Number(manualPnl) : null;
    const finalR = manualRMultiple ? Number(manualRMultiple) : null;

    const setupStructures: string[] = [];
    if (selectedSetupTitle) setupStructures.push(selectedSetupTitle);

    const tradePayload = {
      account_id: accountId,
      pair: pair.trim().toUpperCase(),
      direction,
      entry_price: entry,
      exit_price: exit,
      stop_loss: sl,
      take_profit: tp,
      size: lotSize,
      entry_time: entryDateObj.toISOString(),
      exit_time: exit ? new Date().toISOString() : null,
      pnl: finalPnl,
      r_multiple: finalR,
      timeframe,
      setup_structures: setupStructures,
      setup_fvg: false,
      setup_ob: false,
      setup_liquidity_sweep: false,
      bookmap_absorption: null,
      bookmap_passive_orders: null,
      bookmap_aggressive_orders: null,
      bookmap_vwap_position: null,
      mental_state: mentalState,
      cookie_jar_ref: false,
      rule_40_percent: false,
      screenshot_before_url: screenshotBefore || null,
      screenshot_after_url: screenshotAfter || null,
      notes: notes || null,
      result,
      session: session || null,
    };

    try {
      if (editingTrade) {
        await updateTrade({ id: editingTrade.id, ...tradePayload });
      } else {
        await createTrade(tradePayload);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || t('tfSaveError'));
    }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);
  const selectedSessionLabel = sessionLabel(t, session);

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Drag Handle Indicator */}
          <View style={styles.dragHandleWrap}>
            <View style={styles.dragHandle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <View style={styles.accentBar} />
              <View>
                <Text style={styles.headerTitle}>
                  {editingTrade ? t('tfHeaderEdit') : t('tfHeaderNew')}
                </Text>
                <Text style={styles.headerSubtitle}>{t('tfHeaderSub')}</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('tfCloseForm')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X color={theme.colors.textPrimary} size={20} />
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={styles.errorBox}>
              <AlertCircle color={theme.colors.redLight} size={16} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
            {/* ── SECTION 1 : PARAMÈTRES PRINCIPAUX & DATE ── */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>                <Target color={theme.colors.primaryLight} size={13} style={{ marginRight: 6 }} />
                {t('tfSection1')}

              </Text>

              {/* Compte & Instrument / Paire */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfAccountLabel')}</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setAccountPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownSelectedContent}>
                      <Wallet size={14} color={theme.colors.primaryLight} />
                      <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                        {selectedAccount?.name || t('selectPlaceholder')}
                      </Text>
                    </View>
                    <ChevronDown size={14} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfPairLabel')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('tfPairPlaceholder')}
                    placeholderTextColor={theme.colors.textMuted}
                    value={pair}
                    onChangeText={t => setPair(t.toUpperCase())}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* Date & Heure d'entrée cliquables avec calendrier et heure natifs */}
              <View style={styles.dateRow}>
                <Text style={styles.fieldLabel}>{t('tfEntryDateTime')}</Text>
                <View style={styles.row2}>
                  {/* Bouton Date */}
                  <TouchableOpacity
                    style={[styles.dropdownSelector, { flex: 1.2 }]}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownSelectedContent}>
                      <Calendar size={14} color={theme.colors.primaryLight} />
                      <Text style={styles.dropdownSelectedText}>
                        {entryDateObj.toLocaleDateString(localeFor(lang), {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <ChevronDown size={14} color={theme.colors.textMuted} />
                  </TouchableOpacity>

                  {/* Bouton Heure */}
                  <TouchableOpacity
                    style={[styles.dropdownSelector, { flex: 0.8 }]}
                    onPress={() => setShowTimePicker(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownSelectedContent}>
                      <Clock size={14} color={theme.colors.primaryLight} />
                      <Text style={styles.dropdownSelectedText}>
                        {entryDateObj.toLocaleTimeString(localeFor(lang), {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <ChevronDown size={14} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Native Date Picker */}
              {showDatePicker && (
                <DateTimePicker
                  value={entryDateObj}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  themeVariant="dark"
                  onDismiss={() => setShowDatePicker(false)}
                  onValueChange={(_event: any, selectedDate?: Date) => {
                    setShowDatePicker(false);
                    if (selectedDate) {
                      const updated = new Date(entryDateObj);
                      updated.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
                      setEntryDateObj(updated);
                    }
                  }}
                />
              )}

              {/* Native Time Picker */}
              {showTimePicker && (
                <DateTimePicker
                  value={entryDateObj}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  is24Hour={true}
                  themeVariant="dark"
                  onDismiss={() => setShowTimePicker(false)}
                  onValueChange={(_event: any, selectedDate?: Date) => {
                    setShowTimePicker(false);
                    if (selectedDate) {
                      const updated = new Date(entryDateObj);
                      updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                      setEntryDateObj(updated);
                    }
                  }}
                />
              )}

              {/* Direction BUY / SELL */}
              <Text style={styles.fieldLabel}>{t('tfDirection')}</Text>
              <View style={styles.directionRow}>
                <TouchableOpacity
                  style={[styles.directionBtn, direction === 'BUY' && styles.buyActive]}
                  onPress={() => setDirection('BUY')}
                >
                  <Text style={[styles.directionText, direction === 'BUY' && styles.whiteText]}>
                    {t('tfBuyLong')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.directionBtn, direction === 'SELL' && styles.sellActive]}
                  onPress={() => setDirection('SELL')}
                >
                  <Text style={[styles.directionText, direction === 'SELL' && styles.whiteText]}>
                    {t('tfSellShort')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Timeframe & Session */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfTimeframe')}</Text>
                  <View style={styles.pillRow}>
                    {TIMEFRAMES.map(tf => (
                      <TouchableOpacity
                        key={tf}
                        style={[styles.pill, timeframe === tf && styles.pillActive]}
                        onPress={() => setTimeframe(tf)}
                      >
                        <Text style={[styles.pillText, timeframe === tf && styles.whiteText]}>{tf}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfSession')}</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setSessionPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownSelectedContent}>
                      <Clock size={14} color={theme.colors.primaryLight} />
                      <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                        {selectedSessionLabel || t('none')}
                      </Text>
                    </View>
                    <ChevronDown size={14} color={theme.colors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Volume & Prix d'entrée */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfVolume')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="1.0"
                    placeholderTextColor={theme.colors.textMuted}
                    value={size}
                    onChangeText={setSize}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfEntryPrice')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2380.50"
                    placeholderTextColor={theme.colors.textMuted}
                    value={entryPrice}
                    onChangeText={setEntryPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Stop Loss & Take Profit */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfStopLoss')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2375.00"
                    placeholderTextColor={theme.colors.textMuted}
                    value={stopLoss}
                    onChangeText={setStopLoss}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfTakeProfit')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2395.00"
                    placeholderTextColor={theme.colors.textMuted}
                    value={takeProfit}
                    onChangeText={setTakeProfit}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Live R:R Calculator Display */}
              {(() => {
                const entry = Number(entryPrice);
                const sl = Number(stopLoss);
                const tp = Number(takeProfit);
                if (!isNaN(entry) && !isNaN(sl) && !isNaN(tp) && entry > 0 && sl > 0 && tp > 0 && entry !== sl) {
                  const risk = Math.abs(entry - sl);
                  const reward = Math.abs(tp - entry);
                  const rr = risk > 0 ? (reward / risk) : 0;
                  const rrColor = rr >= 2 ? theme.colors.green : rr >= 1 ? theme.colors.goldLight : theme.colors.redLight;
                  const rrBg = rr >= 2 ? 'rgba(16, 185, 129, 0.15)' : rr >= 1 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)';
                  return (
                    <View style={[styles.rrCalcBox, { backgroundColor: rrBg, borderColor: rrColor + '60' }]}>
                      <Target size={12} color={rrColor} />
                      <Text style={[styles.rrCalcLabel]}>{t('rrCalculator')}</Text>
                      <View style={[styles.rrCalcBadge, { backgroundColor: rrColor + '30' }]}>
                        <Text style={[styles.rrCalcValue, { color: rrColor }]}>1 : {rr.toFixed(2)}</Text>
                      </View>
                      <Text style={styles.rrCalcDetail}>
                        {t('rrRisk')}: {risk.toFixed(2)} · {t('rrReward')}: {reward.toFixed(2)}
                      </Text>
                    </View>
                  );
                }
                return null;
              })()}

              {/* Résultat & Prix de Sortie */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfResult')}</Text>
                  <View style={styles.pillRow}>
                    {(['OPEN', 'TP', 'SL', 'BE'] as const).map(res => (
                      <TouchableOpacity
                        key={res}
                        style={[styles.pill, result === res && styles.pillActive]}
                        onPress={() => setResult(res)}
                      >
                        <Text style={[styles.pillText, result === res && styles.whiteText]}>{res}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfExitPrice')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="2390.00"
                    placeholderTextColor={theme.colors.textMuted}
                    value={exitPrice}
                    onChangeText={setExitPrice}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* Risque % ou $ & Calcul live */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfRisk', riskType === 'percent' ? '%' : '$')}</Text>
                  <View style={styles.flexRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, riskType === 'percent' && styles.toggleBtnActive]}
                      onPress={() => setRiskType('percent')}
                    >
                      <Text style={styles.toggleText}>%</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, riskType === 'usd' && styles.toggleBtnActive]}
                      onPress={() => setRiskType('usd')}
                    >
                      <Text style={styles.toggleText}>$</Text>
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, { flex: 1, marginLeft: 6 }]}
                      placeholder="1"
                      placeholderTextColor={theme.colors.textMuted}
                      value={riskValue}
                      onChangeText={setRiskValue}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>{t('tfPnlR')}</Text>
                  <View style={styles.flexRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginRight: 6 }]}
                      placeholder="P&L $"
                      placeholderTextColor={theme.colors.textMuted}
                      value={manualPnl}
                      onChangeText={setManualPnl}
                      keyboardType="decimal-pad"
                    />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="R"
                      placeholderTextColor={theme.colors.textMuted}
                      value={manualRMultiple}
                      onChangeText={setManualRMultiple}
                      keyboardType="decimal-pad"
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* ── SECTION 2 : STRATÉGIE PLAYBOOK ── */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>
                <Layers color={theme.colors.greenLight} size={13} style={{ marginRight: 6 }} />
                {t('tfSection2')}
              </Text>

              {playbookSetups.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.fieldLabel}>{t('tfChooseSetup')}</Text>
                  {playbookSetups.map(s => {
                    const isSelected = selectedSetupTitle === s.title;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.setupCard, isSelected && styles.setupCardActive]}
                        onPress={() => {
                          setSelectedSetupTitle(isSelected ? '' : s.title);
                        }}
                      >
                        <Text style={[styles.setupCardText, isSelected && styles.whiteText]}>
                          {s.title}
                        </Text>
                        <Text style={styles.setupCardTimeframes}>
                          {t('tfUt', s.timeframes.join('/'))}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyPlaybookHint}>{t('tfNoSetupHint')}</Text>
              )}
            </View>

            {/* ── SECTION 3 : SCREENSHOTS DU GRAPHIQUE ── */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>
                <ImageIcon color={theme.colors.cyanLight} size={13} style={{ marginRight: 6 }} />
                {t('tfSection3')}
              </Text>

              {/* Screenshot Avant */}
              <View style={styles.screenshotBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.fieldLabel}>{t('tfScreenshotBefore')}</Text>
                  <View style={styles.flexRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, screenshotBeforeType === 'url' && styles.toggleBtnActive]}
                      onPress={() => setScreenshotBeforeType('url')}
                    >
                      <Link size={12} color={theme.colors.textPrimary} />
                      <Text style={styles.toggleText}>URL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, screenshotBeforeType === 'file' && styles.toggleBtnActive]}
                      onPress={() => setScreenshotBeforeType('file')}
                    >
                      <Upload size={12} color={theme.colors.textPrimary} />
                      <Text style={styles.toggleText}>{t('gallery')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {screenshotBeforeType === 'url' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="https://www.tradingview.com/x/..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={screenshotBefore}
                    onChangeText={setScreenshotBefore}
                  />
                ) : (
                  <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('before')}>
                    <Upload size={16} color={theme.colors.primaryLight} />
                    <Text style={styles.uploadBtnText}>
                      {screenshotBefore ? t('tfEditImgBefore') : t('tfSelectImgBefore')}
                    </Text>
                  </TouchableOpacity>
                )}

                {screenshotBefore ? (
                  <Image source={{ uri: screenshotBefore }} style={styles.previewImage} resizeMode="cover" />
                ) : null}
              </View>

              {/* Screenshot Après */}
              <View style={[styles.screenshotBox, { marginTop: 10 }]}>
                <View style={styles.rowBetween}>
                  <Text style={styles.fieldLabel}>{t('tfScreenshotAfter')}</Text>
                  <View style={styles.flexRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, screenshotAfterType === 'url' && styles.toggleBtnActive]}
                      onPress={() => setScreenshotAfterType('url')}
                    >
                      <Link size={12} color={theme.colors.textPrimary} />
                      <Text style={styles.toggleText}>URL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, screenshotAfterType === 'file' && styles.toggleBtnActive]}
                      onPress={() => setScreenshotAfterType('file')}
                    >
                      <Upload size={12} color={theme.colors.textPrimary} />
                      <Text style={styles.toggleText}>{t('gallery')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {screenshotAfterType === 'url' ? (
                  <TextInput
                    style={styles.input}
                    placeholder="https://www.tradingview.com/x/..."
                    placeholderTextColor={theme.colors.textMuted}
                    value={screenshotAfter}
                    onChangeText={setScreenshotAfter}
                  />
                ) : (
                  <TouchableOpacity style={styles.uploadBtn} onPress={() => pickImage('after')}>
                    <Upload size={16} color={theme.colors.primaryLight} />
                    <Text style={styles.uploadBtnText}>
                      {screenshotAfter ? t('tfEditImgAfter') : t('tfSelectImgAfter')}
                    </Text>
                  </TouchableOpacity>
                )}

                {screenshotAfter ? (
                  <Image source={{ uri: screenshotAfter }} style={styles.previewImage} resizeMode="cover" />
                ) : null}
              </View>
            </View>

            {/* ── SECTION 4 : PSYCHOLOGIE & NOTES ── */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>
                <Target color={theme.colors.goldLight} size={13} style={{ marginRight: 6 }} />
                {t('tfSection4')}
              </Text>

              <Text style={styles.fieldLabel}>{t('tfPsychology')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {MENTAL_STATE_IDS.map(id => (
                  <TouchableOpacity
                    key={id}
                    style={[styles.pill, mentalState === id && styles.pillActive]}
                    onPress={() => setMentalState(id)}
                  >
                    <Text style={[styles.pillText, mentalState === id && styles.whiteText]}>
                      {mentalStateLabel(t, id)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>{t('tfNotes')}</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder={t('tfNotesPlaceholder')}
                placeholderTextColor={theme.colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
              />
            </View>
          </ScrollView>

          {/* Bouton de Soumission */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={isCreating || isUpdating}
          >
            {isCreating || isUpdating ? (
              <ActivityIndicator color={theme.colors.textPrimary} />
            ) : (
              <Text style={styles.submitText}>
                {editingTrade ? t('tfSubmitEdit') : t('tfSubmitNew')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── PICKERS COMPTE / SESSION (POPUPS PROPRES RÉUTILISABLES) ── */}
      <PickerModal
        visible={accountPickerVisible}
        title={t('tfPickAccount')}
        items={accounts.map(acc => ({
          id: acc.id,
          label: acc.name,
          sub: `${accountTypeLabel(t, acc.type)} · ${formatCurrency(acc.initial_balance, { showPlus: false, decimals: 0, thousandsSeparator: true })} ${acc.currency}`,
          rightText: formatCurrency(acc.balance, { showPlus: false, decimals: 0, thousandsSeparator: true }),
        }))}
        selectedId={accountId}
        onSelect={id => {
          setAccountId(id);
          setAccountPickerVisible(false);
        }}
        onClose={() => setAccountPickerVisible(false)}
      />

      <PickerModal
        visible={sessionPickerVisible}
        title={t('tfPickSession')}
        items={SESSION_IDS.map(id => ({
          id: id as string,
          label: sessionLabel(t, id as string),
          leftIcon: <Clock size={14} color={theme.colors.textMuted} />,
        }))}
        selectedId={session}
        onSelect={id => {
          setSession(id as any);
          setSessionPickerVisible(false);
        }}
        onClose={() => setSessionPickerVisible(false)}
        maxHeight={250}
      />
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 8, 10, 0.95)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.backgroundElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: theme.colors.borderBright,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
    maxHeight: '92%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 25,
  },
  dragHandleWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.surfaceLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    paddingBottom: theme.spacing.sm,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentBar: {
    width: 3.5,
    height: 30,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  headerTitle: {
    color: theme.colors.textPrimary,
    fontSize: 15,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.sansSemiBold,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: theme.colors.surface,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.redLight,
    fontSize: 12,
    fontFamily: theme.fonts.sans,
    flex: 1,
  },
  formScroll: {
    marginBottom: theme.spacing.md,
  },
  sectionBox: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    paddingBottom: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
    marginBottom: 5,
    marginTop: 6,
  },
  row2: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: 8,
  },
  col: {
    flex: 1,
  },
  dateRow: {
    marginBottom: 8,
  },
  dateInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
  },
  dateInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.sansMedium,
    fontVariant: ['tabular-nums'],
  },
  input: {
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.sansMedium,
  },
  textArea: {
    height: 70,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  dropdownSelector: {
    height: 44,
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownSelectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 4,
  },
  dropdownSelectedText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  directionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: 8,
  },
  directionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: theme.colors.green,
  },
  sellActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: theme.colors.red,
  },
  directionText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  whiteText: {
    color: theme.colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  pillScroll: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  pill: {
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    marginRight: 4,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 4,
  },
  toggleBtnActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  toggleText: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
  },
  rrCalcBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  rrCalcLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  rrCalcBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rrCalcValue: {
    fontSize: 13,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
  },
  rrCalcDetail: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
  },
  setupCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 12,
    padding: theme.spacing.md,
  },
  setupCardActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  setupCardText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  setupCardTimeframes: {
    color: theme.colors.greenLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emptyPlaybookHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.sans,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  screenshotBox: {
    backgroundColor: theme.colors.inputBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: 12,
    padding: theme.spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  uploadBtnText: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
  },
  previewImage: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    marginTop: 10,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 0.8,
  },

});
