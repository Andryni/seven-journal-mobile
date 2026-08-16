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
import { MENTAL_STATE_LABELS } from '../../types/domain';
import { calculateRMultiple } from '../../utils/financials';
import {
  X,
  Check,
  AlertCircle,
  Image as ImageIcon,
  Upload,
  Link,
  Target,
  Brain,
  Layers,
  Sparkles,
} from 'lucide-react-native';

const TIMEFRAMES: TradeTimeframe[] = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
const SESSIONS = [
  { id: '', label: 'AUCUNE' },
  { id: 'Asia', label: 'ASIA SESSION' },
  { id: 'London', label: 'LONDON SESSION' },
  { id: 'New York', label: 'NEW YORK SESSION' },
  { id: 'Over Session', label: 'OVER SESSION' },
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
  const [pair, setPair] = useState('XAUUSD');
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 16));
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

  // Section 2: Strategy & Setup
  const [selectedSetupTitle, setSelectedSetupTitle] = useState('');
  const [bos, setBos] = useState(false);
  const [ob, setOb] = useState(false);
  const [fvg, setFvg] = useState(false);
  const [liquiditySweep, setLiquiditySweep] = useState(false);

  // Section 3: Screenshots (URL or Local Pick)
  const [screenshotBefore, setScreenshotBefore] = useState('');
  const [screenshotAfter, setScreenshotAfter] = useState('');
  const [screenshotBeforeType, setScreenshotBeforeType] = useState<'url' | 'file'>('url');
  const [screenshotAfterType, setScreenshotAfterType] = useState<'url' | 'file'>('url');

  // Section 4: Mental State & Notes
  const [mentalState, setMentalState] = useState<MentalState>('focused');
  const [cookieJar, setCookieJar] = useState(false);
  const [rule40, setRule40] = useState(false);
  const [notes, setNotes] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingTrade) {
      setAccountId(editingTrade.account_id);
      setPair(editingTrade.pair);
      setEntryDate(editingTrade.entry_time.slice(0, 16));
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
      setBos(editingTrade.setup_structures.includes('BOS'));
      setOb(editingTrade.setup_ob);
      setFvg(editingTrade.setup_fvg);
      setLiquiditySweep(editingTrade.setup_liquidity_sweep);
      setScreenshotBefore(editingTrade.screenshot_before_url || '');
      setScreenshotAfter(editingTrade.screenshot_after_url || '');
      setMentalState(editingTrade.mental_state);
      setCookieJar(editingTrade.cookie_jar_ref);
      setRule40(editingTrade.rule_40_percent);
      setNotes(editingTrade.notes || '');
    } else {
      resetForm();
    }
  }, [editingTrade, visible]);

  const resetForm = () => {
    setAccountId(activeAccountId || (accounts[0]?.id ?? ''));
    setPair('XAUUSD');
    setEntryDate(new Date().toISOString().slice(0, 16));
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
    setBos(false);
    setOb(false);
    setFvg(false);
    setLiquiditySweep(false);
    setScreenshotBefore('');
    setScreenshotAfter('');
    setMentalState('focused');
    setCookieJar(false);
    setRule40(false);
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
    if (bos) setupStructures.push('BOS');
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
      entry_time: entryDate ? new Date(entryDate).toISOString() : new Date().toISOString(),
      exit_time: exit ? new Date().toISOString() : null,
      pnl: finalPnl,
      r_multiple: finalR,
      timeframe,
      setup_structures: setupStructures,
      setup_fvg: fvg,
      setup_ob: ob,
      setup_liquidity_sweep: liquiditySweep,
      bookmap_absorption: null,
      bookmap_passive_orders: null,
      bookmap_aggressive_orders: null,
      bookmap_vwap_position: null,
      mental_state: mentalState,
      cookie_jar_ref: cookieJar,
      rule_40_percent: rule40,
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

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          <View style={styles.dragIndicatorWrapper}>
            <View style={styles.dragIndicator} />
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

              {/* Compte & Paire */}
              <View style={styles.row2}>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>COMPTE *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                    {accounts.map(acc => (
                      <TouchableOpacity
                        key={acc.id}
                        style={[styles.accountPill, accountId === acc.id && styles.accountPillActive]}
                        onPress={() => setAccountId(acc.id)}
                      >
                        <Text style={[styles.accountPillText, accountId === acc.id && styles.whiteText]}>
                          {acc.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                <View style={styles.col}>
                  <Text style={styles.fieldLabel}>INSTRUMENT / PAIRE *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="ex: XAUUSD, NAS100, EURUSD"
                    placeholderTextColor={theme.colors.textMuted}
                    value={pair}
                    onChangeText={t => setPair(t.toUpperCase())}
                    autoCapitalize="characters"
                  />
                </View>
              </View>

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
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
                    {SESSIONS.map(s => (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.pill, session === s.id && styles.pillActive]}
                        onPress={() => setSession(s.id as any)}
                      >
                        <Text style={[styles.pillText, session === s.id && styles.whiteText]}>{s.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
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

            {/* ── SECTION 2 : STRATÉGIE & SETUP PLAYBOOK ── */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>
                <Layers color={theme.colors.greenLight} size={13} style={{ marginRight: 6 }} />
                2. STRATÉGIE & SETUP DU PLAYBOOK
              </Text>

              {playbookSetups.length > 0 ? (
                <View style={{ gap: 6, marginBottom: 12 }}>
                  <Text style={styles.fieldLabel}>CHOISIR UNE STRATÉGIE DU PLAYBOOK</Text>
                  {playbookSetups.map(s => {
                    const isSelected = selectedSetupTitle === s.title;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.setupCard, isSelected && styles.setupCardActive]}
                        onPress={() => {
                          setSelectedSetupTitle(isSelected ? '' : s.title);
                          setBos(true);
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
              ) : null}

              <Text style={styles.fieldLabel}>CONFIRMATIONS SMC / ICT</Text>
              <View style={styles.checkboxGrid}>
                <TouchableOpacity
                  style={[styles.checkboxItem, bos && styles.checkboxActive]}
                  onPress={() => setBos(!bos)}
                >
                  <View style={[styles.box, bos && styles.boxChecked]}>
                    {bos ? <Check color="#ffffff" size={12} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>BOS (Break of Structure)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.checkboxItem, ob && styles.checkboxActive]}
                  onPress={() => setOb(!ob)}
                >
                  <View style={[styles.box, ob && styles.boxChecked]}>
                    {ob ? <Check color="#ffffff" size={12} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>Order Block (OB)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.checkboxItem, fvg && styles.checkboxActive]}
                  onPress={() => setFvg(!fvg)}
                >
                  <View style={[styles.box, fvg && styles.boxChecked]}>
                    {fvg ? <Check color="#ffffff" size={12} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>Fair Value Gap (FVG)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.checkboxItem, liquiditySweep && styles.checkboxActive]}
                  onPress={() => setLiquiditySweep(!liquiditySweep)}
                >
                  <View style={[styles.box, liquiditySweep && styles.boxChecked]}>
                    {liquiditySweep ? <Check color="#ffffff" size={12} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>Liquidity Sweep</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── SECTION 3 : SCREENSHOTS GRAPHIQUES AVANT & APRÈS ── */}
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
                <Brain color={theme.colors.goldLight} size={13} style={{ marginRight: 6 }} />
                4. PSYCHOLOGIE & FRAMEWORKS MENTAUX
              </Text>

              <Text style={styles.fieldLabel}>ÉTAT MENTAL</Text>
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

              <View style={styles.row2}>
                <TouchableOpacity
                  style={[styles.checkboxItem, cookieJar && styles.checkboxActive, { flex: 1 }]}
                  onPress={() => setCookieJar(!cookieJar)}
                >
                  <View style={[styles.box, cookieJar && styles.boxChecked]}>
                    {cookieJar ? <Check color="#ffffff" size={12} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>Cookie Jar (Goggins)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.checkboxItem, rule40 && styles.checkboxActive, { flex: 1 }]}
                  onPress={() => setRule40(!rule40)}
                >
                  <View style={[styles.box, rule40 && styles.boxChecked]}>
                    {rule40 ? <Check color="#ffffff" size={12} /> : null}
                  </View>
                  <Text style={styles.checkboxLabel}>40% Rule</Text>
                </TouchableOpacity>
              </View>

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
    borderColor: '#1e2130',
    borderWidth: 1,
    padding: theme.spacing.lg,
    paddingTop: 12,
    maxHeight: '92%',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  dragIndicatorWrapper: {
    alignItems: 'center',
    marginBottom: 16,
  },
  dragIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#262833',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2130',
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  accentBar: {
    width: 3,
    height: 28,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
    marginRight: 10,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  headerSubtitle: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    backgroundColor: '#181920',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262833',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: {
    color: theme.colors.redLight,
    fontSize: 13,
    flex: 1,
  },
  formScroll: {
    marginBottom: 16,
  },
  sectionBox: {
    backgroundColor: '#11131a',
    borderColor: '#1e2130',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e2130',
    paddingBottom: 8,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
    marginTop: 8,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  col: {
    flex: 1,
  },
  input: {
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    borderRadius: 10,
    height: 46,
    paddingHorizontal: 16,
    color: '#ffffff',
    fontSize: 13,
  },
  textArea: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  directionRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  directionBtn: {
    flex: 1,
    height: 46,
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.5)',
  },
  sellActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.5)',
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
    gap: 8,
  },
  pillScroll: {
    flexDirection: 'row',
  },
  pill: {
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: theme.colors.primary,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  accountPill: {
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  accountPillActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  accountPillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: theme.colors.primary,
  },
  toggleText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
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
    padding: 12,
  },
  setupCardActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: theme.colors.primary,
  },
  setupCardText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  setupCardTimeframes: {
    color: theme.colors.greenLight,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  checkboxGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    width: '48%',
  },
  checkboxActive: {
    borderColor: theme.colors.primary,
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    backgroundColor: '#181920',
  },
  boxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxLabel: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  screenshotBox: {
    backgroundColor: '#0a0c12',
    borderColor: '#1e2130',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
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
    backgroundColor: '#0a0c12',
    borderColor: '#262833',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    marginTop: 8,
  },
  uploadBtnText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '800',
  },
  previewImage: {
    width: '100%',
    height: 140,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#1e2130',
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
