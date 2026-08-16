import React, { useState, useEffect } from 'react';
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
import { theme } from '../../theme';
import { useTrades } from '../../features/trades/useTrades';
import { useAccounts } from '../../features/accounts/useAccounts';
import { usePlaybookSetups } from '../../features/playbook/usePlaybookSetups';
import { useUIStore } from '../../store/uiStore';
import type { Trade, TradeTimeframe, MentalState } from '../../types/domain';
import { calculateRMultiple } from '../../utils/financials';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
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
  Check,
} from 'lucide-react-native';

const TIMEFRAMES: TradeTimeframe[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
const SESSIONS = [
  { id: '', label: 'AUCUNE' },
  { id: 'Asia', label: 'ASIA' },
  { id: 'London', label: 'LONDON' },
  { id: 'New York', label: 'NEW YORK' },
  { id: 'Over Session', label: 'OVER' },
];

const MENTAL_STATES: { id: MentalState; label: string }[] = [
  { id: 'focused', label: 'FOCUSED - Calme & Structuré' },
  { id: 'anxious', label: 'ANXIOUS - Stressé / Doute' },
  { id: 'greedy', label: 'GREEDY - Trop gourmand' },
  { id: 'revenge', label: 'REVENGE - Vengeance après perte' },
  { id: 'fomo', label: 'FOMO - Peur de rater le move' },
  { id: 'tired', label: 'TIRED - Fatigué' },
];

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
      alert('Permission requise pour accéder aux images.');
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
      setErrorMsg('Session quotidienne verrouillée ! Respectez votre discipline.');
      return;
    }

    if (!accountId || !pair.trim() || !entryPrice || !stopLoss || !takeProfit || !size) {
      setErrorMsg('Veuillez renseigner tous les champs obligatoires (*).');
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
      setErrorMsg(err.message || "Erreur lors de l'enregistrement de la position.");
    }
  };

  const selectedAccount = accounts.find(a => a.id === accountId);
  const selectedSessionObj = SESSIONS.find(s => s.id === session);

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
                  {editingTrade ? 'ÉDITION DU TRADE' : 'ENREGISTRER UN NOUVEAU TRADE'}
                </Text>
                <Text style={styles.headerSubtitle}>
                  Seven Journal Terminal · Parité Web Complète
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#ffffff" size={20} />
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
              <Text style={styles.sectionTitle}>
                <Target color={theme.colors.primaryLight} size={13} style={{ marginRight: 6 }} />
                1. PARAMÈTRES PRINCIPAUX & PRIX
              </Text>

              {/* Compte & Instrument / Paire */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>COMPTE *</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setAccountPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownSelectedContent}>
                      <Wallet size={14} color={theme.colors.primaryLight} />
                      <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                        {selectedAccount?.name || 'Sélectionner...'}
                      </Text>
                    </View>
                    <ChevronDown size={14} color="#94a3b8" />
                  </TouchableOpacity>
                </View>

                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>INSTRUMENT / PAIRE *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: XAUUSD, NAS100"
                    placeholderTextColor={theme.colors.textMuted}
                    value={pair}
                    onChangeText={t => setPair(t.toUpperCase())}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

              {/* Date & Heure d'entrée cliquables avec calendrier et heure natifs */}
              <View style={styles.dateRow}>
                <Text style={styles.fieldLabel}>DATE & HEURE D'ENTRÉE *</Text>
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
                        {entryDateObj.toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <ChevronDown size={14} color="#94a3b8" />
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
                        {entryDateObj.toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <ChevronDown size={14} color="#94a3b8" />
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
                  onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                    setShowDatePicker(false);
                    if (selectedDate && event.type !== 'dismissed') {
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
                  onChange={(event: DateTimePickerEvent, selectedDate?: Date) => {
                    setShowTimePicker(false);
                    if (selectedDate && event.type !== 'dismissed') {
                      const updated = new Date(entryDateObj);
                      updated.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
                      setEntryDateObj(updated);
                    }
                  }}
                />
              )}

              {/* Direction BUY / SELL */}
              <Text style={styles.fieldLabel}>DIRECTION *</Text>
              <View style={styles.directionRow}>
                <TouchableOpacity
                  style={[styles.directionBtn, direction === 'BUY' && styles.buyActive]}
                  onPress={() => setDirection('BUY')}
                >
                  <Text style={[styles.directionText, direction === 'BUY' && styles.whiteText]}>
                    BUY / LONG
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.directionBtn, direction === 'SELL' && styles.sellActive]}
                  onPress={() => setDirection('SELL')}
                >
                  <Text style={[styles.directionText, direction === 'SELL' && styles.whiteText]}>
                    SELL / SHORT
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Timeframe & Session */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>TIMEFRAME *</Text>
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
                  <Text style={styles.fieldLabel}>SESSION *</Text>
                  <TouchableOpacity
                    style={styles.dropdownSelector}
                    onPress={() => setSessionPickerVisible(true)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.dropdownSelectedContent}>
                      <Clock size={14} color={theme.colors.primaryLight} />
                      <Text style={styles.dropdownSelectedText} numberOfLines={1}>
                        {selectedSessionObj?.label || 'AUCUNE'}
                      </Text>
                    </View>
                    <ChevronDown size={14} color="#94a3b8" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Volume & Prix d'entrée */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>VOLUME (LOTS) *</Text>
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
                  <Text style={styles.fieldLabel}>PRIX D'ENTRÉE *</Text>
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
                  <Text style={styles.fieldLabel}>STOP LOSS *</Text>
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
                  <Text style={styles.fieldLabel}>TAKE PROFIT *</Text>
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

              {/* Résultat & Prix de Sortie */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>RÉSULTAT *</Text>
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
                  <Text style={styles.fieldLabel}>PRIX DE SORTIE</Text>
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
                  <Text style={styles.fieldLabel}>RISQUE ({riskType === 'percent' ? '%' : '$'})</Text>
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
                  <Text style={styles.fieldLabel}>P&L ($) / R-MULTIPLE (LIVE)</Text>
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
                2. STRATÉGIE DU PLAYBOOK
              </Text>

              {playbookSetups.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={styles.fieldLabel}>CHOISIR VOTRE STRATÉGIE PLAYBOOK</Text>
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
                          🎯 {s.title}
                        </Text>
                        <Text style={styles.setupCardTimeframes}>
                          UT: {s.timeframes.join('/')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.emptyPlaybookHint}>
                  Aucune stratégie créée. Rendez-vous dans l'onglet Playbook pour structurer vos setups.
                </Text>
              )}
            </View>

            {/* ── SECTION 3 : SCREENSHOTS DU GRAPHIQUE ── */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>
                <ImageIcon color={theme.colors.cyanLight} size={13} style={{ marginRight: 6 }} />
                3. SCREENSHOTS DU GRAPHIQUE (AVANT & APRÈS)
              </Text>

              {/* Screenshot Avant */}
              <View style={styles.screenshotBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.fieldLabel}>SCREENSHOT AVANT LE TRADE</Text>
                  <View style={styles.flexRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, screenshotBeforeType === 'url' && styles.toggleBtnActive]}
                      onPress={() => setScreenshotBeforeType('url')}
                    >
                      <Link size={12} color="#ffffff" />
                      <Text style={styles.toggleText}>URL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, screenshotBeforeType === 'file' && styles.toggleBtnActive]}
                      onPress={() => setScreenshotBeforeType('file')}
                    >
                      <Upload size={12} color="#ffffff" />
                      <Text style={styles.toggleText}>Galerie</Text>
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
                      {screenshotBefore ? 'Modifier image avant' : 'Sélectionner image avant (Galerie)'}
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
                  <Text style={styles.fieldLabel}>SCREENSHOT APRÈS LE TRADE</Text>
                  <View style={styles.flexRow}>
                    <TouchableOpacity
                      style={[styles.toggleBtn, screenshotAfterType === 'url' && styles.toggleBtnActive]}
                      onPress={() => setScreenshotAfterType('url')}
                    >
                      <Link size={12} color="#ffffff" />
                      <Text style={styles.toggleText}>URL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.toggleBtn, screenshotAfterType === 'file' && styles.toggleBtnActive]}
                      onPress={() => setScreenshotAfterType('file')}
                    >
                      <Upload size={12} color="#ffffff" />
                      <Text style={styles.toggleText}>Galerie</Text>
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
                      {screenshotAfter ? 'Modifier image après' : 'Sélectionner image après (Galerie)'}
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
                4. ÉTAT MENTAL & NOTES
              </Text>

              <Text style={styles.fieldLabel}>PSYCHOLOGIE DU TRADER</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                {MENTAL_STATES.map(m => (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.pill, mentalState === m.id && styles.pillActive]}
                    onPress={() => setMentalState(m.id)}
                  >
                    <Text style={[styles.pillText, mentalState === m.id && styles.whiteText]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>NOTES & CONTEXTE DE MARCHÉ</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Raison d'entrée, liquidité ciblée, ressenti émotionnel..."
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
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>
                {editingTrade ? 'SAUVEGARDER LES MODIFICATIONS' : 'ENREGISTRER LA POSITION DANS LE JOURNAL'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* ── MODAL DE SÉLECTION DU COMPTE (POPUP PROPRE SANS DÉCALAGE DE FORMULAIRE) ── */}
      <Modal visible={accountPickerVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setAccountPickerVisible(false)}
        >
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>CHOISIR LE COMPTE</Text>
              <TouchableOpacity onPress={() => setAccountPickerVisible(false)}>
                <X size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {accounts.map(acc => {
                const isSelected = accountId === acc.id;
                return (
                  <TouchableOpacity
                    key={acc.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => {
                      setAccountId(acc.id);
                      setAccountPickerVisible(false);
                    }}
                  >
                    <View style={styles.pickerItemLeft}>
                      <View style={[styles.pickerDot, isSelected && styles.pickerDotActive]} />
                      <View>
                        <Text style={[styles.pickerItemName, isSelected && styles.whiteText]}>
                          {acc.name}
                        </Text>
                        <Text style={styles.pickerItemType}>
                          {acc.type.toUpperCase()} · ${acc.initial_balance.toLocaleString()} {acc.currency}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.pickerItemRight}>
                      <Text style={[styles.pickerItemBalance, isSelected && styles.whiteText]}>
                        ${acc.balance.toLocaleString()}
                      </Text>
                      {isSelected && <Check size={14} color="#10b981" style={{ marginLeft: 6 }} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── MODAL DE SÉLECTION DE SESSION ── */}
      <Modal visible={sessionPickerVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setSessionPickerVisible(false)}
        >
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>CHOISIR LA SESSION</Text>
              <TouchableOpacity onPress={() => setSessionPickerVisible(false)}>
                <X size={18} color="#ffffff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 250 }}>
              {SESSIONS.map(s => {
                const isSelected = session === s.id;
                return (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => {
                      setSession(s.id as any);
                      setSessionPickerVisible(false);
                    }}
                  >
                    <View style={styles.pickerItemLeft}>
                      <Clock size={14} color={isSelected ? theme.colors.primaryLight : '#64748b'} />
                      <Text style={[styles.pickerItemName, isSelected && styles.whiteText]}>
                        {s.label}
                      </Text>
                    </View>
                    {isSelected && <Check size={14} color="#10b981" />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 8, 10, 0.95)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#0d0f15',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderColor: 'rgba(255, 255, 255, 0.1)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
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
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
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
    fontWeight: '600',
    flex: 1,
  },
  formScroll: {
    marginBottom: theme.spacing.md,
  },
  sectionBox: {
    backgroundColor: '#12141c',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderRadius: 16,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
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
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: 12,
  },
  dateInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  input: {
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    borderRadius: 10,
    height: 44,
    paddingHorizontal: theme.spacing.md,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  textArea: {
    height: 70,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  dropdownSelector: {
    height: 44,
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
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
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  directionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: 8,
  },
  directionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  sellActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderColor: '#ef4444',
  },
  directionText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  whiteText: {
    color: '#ffffff',
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
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
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
    fontWeight: '800',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
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
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  setupCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
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
    fontWeight: '800',
  },
  setupCardTimeframes: {
    color: theme.colors.greenLight,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  emptyPlaybookHint: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  screenshotBox: {
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
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
    backgroundColor: '#12141c',
    borderColor: '#2a2f42',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  uploadBtnText: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontWeight: '800',
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
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },

  // Picker Modal Styles (Popups propres)
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  pickerModalContent: {
    backgroundColor: '#12141c',
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 10,
    marginBottom: 10,
  },
  pickerModalTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#161924',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
    marginBottom: 6,
  },
  pickerItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  pickerItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  pickerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
  },
  pickerDotActive: {
    backgroundColor: '#10b981',
  },
  pickerItemName: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '800',
  },
  pickerItemType: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  pickerItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerItemBalance: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
});
