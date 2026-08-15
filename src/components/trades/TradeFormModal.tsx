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
} from 'react-native';
import { theme } from '../../theme';
import { useTrades } from '../../features/trades/useTrades';
import { useAccounts } from '../../features/accounts/useAccounts';
import { useUIStore } from '../../store/uiStore';
import type { Trade, TradePair, TradeDirection, TradeTimeframe, MentalState } from '../../types/domain';
import { TRADE_PAIRS, MENTAL_STATE_LABELS } from '../../types/domain';
import { calculateRMultiple } from '../../utils/financials';
import { X, Check, AlertCircle } from 'lucide-react-native';

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
  const activeAccountId = useUIStore((state: { activeAccountId: string | null }) => state.activeAccountId);
  const isDailySessionLocked = useUIStore((state: { isDailySessionLocked: boolean }) => state.isDailySessionLocked);

  const [accountId, setAccountId] = useState(activeAccountId || (accounts[0]?.id ?? ''));
  const [pair, setPair] = useState<TradePair>('XAUUSD');
  const [direction, setDirection] = useState<TradeDirection>('BUY');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [size, setSize] = useState('1');
  const [timeframe, setTimeframe] = useState<TradeTimeframe>('M5');
  const [session, setSession] = useState<'Asia' | 'London' | 'New York' | 'Over Session' | ''>('London');
  const [result, setResult] = useState<'TP' | 'SL' | 'BE' | 'OPEN'>('OPEN');
  const [mentalState, setMentalState] = useState<MentalState>('focused');
  const [notes, setNotes] = useState('');

  // Confirmations SMC
  const [bos, setBos] = useState(false);
  const [ob, setOb] = useState(false);
  const [fvg, setFvg] = useState(false);
  const [liquiditySweep, setLiquiditySweep] = useState(false);

  // Auto-calculated fields
  const [manualPnl, setManualPnl] = useState('');
  const [manualRMultiple, setManualRMultiple] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (editingTrade) {
      setAccountId(editingTrade.account_id);
      setPair(editingTrade.pair as TradePair);
      setDirection(editingTrade.direction);
      setEntryPrice(editingTrade.entry_price.toString());
      setExitPrice(editingTrade.exit_price ? editingTrade.exit_price.toString() : '');
      setStopLoss(editingTrade.stop_loss.toString());
      setTakeProfit(editingTrade.take_profit.toString());
      setSize(editingTrade.size.toString());
      setTimeframe(editingTrade.timeframe);
      setSession(editingTrade.session || '');
      setResult(editingTrade.result);
      setMentalState(editingTrade.mental_state);
      setNotes(editingTrade.notes || '');
      setBos(editingTrade.setup_structures.includes('BOS'));
      setOb(editingTrade.setup_ob);
      setFvg(editingTrade.setup_fvg);
      setLiquiditySweep(editingTrade.setup_liquidity_sweep);
      setManualPnl(editingTrade.pnl !== null ? editingTrade.pnl.toString() : '');
      setManualRMultiple(editingTrade.r_multiple !== null ? editingTrade.r_multiple.toString() : '');
    } else {
      resetForm();
    }
  }, [editingTrade, visible]);

  const resetForm = () => {
    setAccountId(activeAccountId || (accounts[0]?.id ?? ''));
    setPair('XAUUSD');
    setDirection('BUY');
    setEntryPrice('');
    setExitPrice('');
    setStopLoss('');
    setTakeProfit('');
    setSize('1');
    setTimeframe('M5');
    setSession('London');
    setResult('OPEN');
    setMentalState('focused');
    setNotes('');
    setBos(false);
    setOb(false);
    setFvg(false);
    setLiquiditySweep(false);
    setManualPnl('');
    setManualRMultiple('');
    setErrorMsg('');
  };

  // Live Auto-Calculation for R & PnL
  useEffect(() => {
    const entry = Number(entryPrice);
    const sl = Number(stopLoss);
    const tp = Number(takeProfit);
    const exit = exitPrice ? Number(exitPrice) : null;

    if (!isNaN(entry) && !isNaN(sl) && entry > 0 && sl > 0 && entry !== sl) {
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
        
        // Approximate standard contract P&L estimate
        const lot = Number(size) || 1;
        const pnl = direction === 'BUY' 
          ? ((exit ?? tp) - entry) * lot * 100 
          : (entry - (exit ?? tp)) * lot * 100;
        setManualPnl(pnl.toFixed(2));
      }
    }
  }, [entryPrice, stopLoss, takeProfit, exitPrice, direction, result, size]);

  const handleSubmit = async () => {
    setErrorMsg('');

    if (isDailySessionLocked && !editingTrade) {
      setErrorMsg('Session quotidienne verrouillée ! Respectez votre discipline.');
      return;
    }

    if (!accountId || !pair || !entryPrice || !stopLoss || !takeProfit || !size) {
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

    const tradePayload = {
      account_id: accountId,
      pair,
      direction,
      entry_price: entry,
      exit_price: exit,
      stop_loss: sl,
      take_profit: tp,
      size: lotSize,
      entry_time: editingTrade?.entry_time || new Date().toISOString(),
      exit_time: exit ? (editingTrade?.exit_time || new Date().toISOString()) : null,
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
      cookie_jar_ref: false,
      rule_40_percent: false,
      screenshot_before_url: null,
      screenshot_after_url: null,
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
      setErrorMsg(err.message || 'Erreur lors de l\'enregistrement de la position.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>
                {editingTrade ? 'MODIFIER LA POSITION' : 'NOUVEAU TRADE'}
              </Text>
              <Text style={styles.headerSubtitle}>Seven Journal Terminal</Text>
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
            {/* Direction BUY / SELL */}
            <View style={styles.directionRow}>
              <TouchableOpacity
                style={[
                  styles.directionBtn,
                  direction === 'BUY' && styles.buyActive,
                ]}
                onPress={() => setDirection('BUY')}
              >
                <Text
                  style={[
                    styles.directionText,
                    direction === 'BUY' && styles.whiteText,
                  ]}
                >
                  ACHAT / BUY
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.directionBtn,
                  direction === 'SELL' && styles.sellActive,
                ]}
                onPress={() => setDirection('SELL')}
              >
                <Text
                  style={[
                    styles.directionText,
                    direction === 'SELL' && styles.whiteText,
                  ]}
                >
                  VENTE / SELL
                </Text>
              </TouchableOpacity>
            </View>

            {/* Instrument Pair */}
            <Text style={styles.fieldLabel}>INSTRUMENT / PAIRE *</Text>
            <View style={styles.pillRow}>
              {TRADE_PAIRS.map((p: TradePair) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.pill, pair === p && styles.pillActive]}
                  onPress={() => setPair(p)}
                >
                  <Text style={[styles.pillText, pair === p && styles.pillTextActive]}>
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Prix Entrée & SL */}
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
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
              <View style={styles.inputCol}>
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
            </View>

            {/* Take Profit & Lots */}
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
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
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>LOTS / CONTRATS *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1.00"
                  placeholderTextColor={theme.colors.textMuted}
                  value={size}
                  onChangeText={setSize}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Résultat */}
            <Text style={styles.fieldLabel}>RÉSULTAT DU TRADE</Text>
            <View style={styles.pillRow}>
              {(['OPEN', 'TP', 'SL', 'BE'] as const).map((res) => (
                <TouchableOpacity
                  key={res}
                  style={[styles.pill, result === res && styles.pillActive]}
                  onPress={() => setResult(res)}
                >
                  <Text style={[styles.pillText, result === res && styles.pillTextActive]}>
                    {res}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SMC Setup Checklist */}
            <Text style={styles.fieldLabel}>CONFIRMATIONS SMC</Text>
            <View style={styles.checkboxGrid}>
              <TouchableOpacity
                style={[styles.checkboxItem, bos && styles.checkboxActive]}
                onPress={() => setBos(!bos)}
              >
                <View style={[styles.box, bos && styles.boxChecked]}>
                  {bos ? <Check color="#ffffff" size={12} /> : null}
                </View>
                <Text style={styles.checkboxLabel}>BOS / Cassure</Text>
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

            {/* P&L et R-Multiple calculés */}
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>P&L ($)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textMuted}
                  value={manualPnl}
                  onChangeText={setManualPnl}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={styles.inputCol}>
                <Text style={styles.fieldLabel}>R-MULTIPLE</Text>
                <TextInput
                  style={styles.input}
                  placeholder="2.5R"
                  placeholderTextColor={theme.colors.textMuted}
                  value={manualRMultiple}
                  onChangeText={setManualRMultiple}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Notes */}
            <Text style={styles.fieldLabel}>NOTES & PSYCHOLOGIE</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Raison d'entrée, contexte de marché..."
              placeholderTextColor={theme.colors.textMuted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />
          </ScrollView>

          {/* Action Button */}
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={isCreating || isUpdating}
          >
            {isCreating || isUpdating ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitText}>
                {editingTrade ? 'SAUVEGARDER LES MODIFICATIONS' : 'ENREGISTRER LA POSITION'}
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
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.card,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    padding: theme.spacing.xl,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
  },
  headerSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
  },
  closeBtn: {
    padding: theme.spacing.xs,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  errorText: {
    color: theme.colors.redLight,
    fontSize: 12,
    flex: 1,
  },
  formScroll: {
    marginBottom: theme.spacing.md,
  },
  directionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  directionBtn: {
    flex: 1,
    height: 44,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buyActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.25)',
    borderColor: theme.colors.primary,
  },
  sellActive: {
    backgroundColor: 'rgba(245, 158, 11, 0.25)',
    borderColor: theme.colors.gold,
  },
  directionText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontWeight: '800',
  },
  whiteText: {
    color: '#ffffff',
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  pill: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  pillTextActive: {
    color: '#ffffff',
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  inputCol: {
    flex: 1,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    height: 44,
    paddingHorizontal: theme.spacing.md,
    color: '#ffffff',
    fontSize: 13,
  },
  textArea: {
    height: 70,
    paddingTop: theme.spacing.sm,
  },
  checkboxGrid: {
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  checkboxActive: {
    borderColor: theme.colors.primaryLight,
  },
  box: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: theme.colors.textMuted,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  boxChecked: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  checkboxLabel: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  submitText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1,
  },
});
