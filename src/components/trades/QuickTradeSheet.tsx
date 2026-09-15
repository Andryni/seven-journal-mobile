import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, ShieldCheck, ShieldAlert, ShieldX, Zap } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { useTrades } from '../../features/trades/useTrades';
import { useAccounts } from '../../features/accounts/useAccounts';
import { useDailyLock } from '../../features/guard/useDailyLock';
import { usePreTradeGuard } from '../../features/guard/usePreTradeGuard';
import { useUIStore } from '../../store/uiStore';
import { PickerModal } from '../ui/PickerModal';
import { Hairline } from '../ui/Panel';
import { formatCurrency } from '../../utils/formatCurrency';
import {
  INSTRUMENTS,
  INSTRUMENT_KEYS,
  calculatePositionSize,
  calculatePlannedRR,
  estimateRiskAtStop,
} from '../../utils/positionSizing';

interface QuickTradeSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * Quick Trade Entry — the highest-leverage retention feature.
 *
 * The full TradeFormModal asks ~20 questions. After a live session nobody
 * fills that in, so the journal goes stale and the app dies. This sheet asks
 * only what cannot be reconstructed later (instrument, direction, entry, stop,
 * target, size) and computes the rest.
 *
 * It is also risk-first: you type a risk %, not a lot size. The size is
 * derived, and the pre-trade guard checks it against what is left of today's
 * daily-loss allowance before the trade can be saved.
 */
export const QuickTradeSheet: React.FC<QuickTradeSheetProps> = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { createTrade, trades, isCreating } = useTrades();
  const { accounts } = useAccounts();
  const { isLocked } = useDailyLock();
  const activeAccountId = useUIStore(s => s.activeAccountId);

  const account = useMemo(
    () => accounts.find(a => a.id === activeAccountId) ?? accounts[0] ?? null,
    [accounts, activeAccountId]
  );

  const [instrument, setInstrument] = useState('XAUUSD');
  const [direction, setDirection] = useState<'BUY' | 'SELL'>('BUY');
  const [entry, setEntry] = useState('');
  const [stop, setStop] = useState('');
  const [target, setTarget] = useState('');
  const [riskPct, setRiskPct] = useState('1');
  const [instrumentPickerVisible, setInstrumentPickerVisible] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEntry('');
      setStop('');
      setTarget('');
    }
  }, [visible]);

  const entryNum = Number(entry);
  const stopNum = Number(stop);
  const targetNum = Number(target);

  const sizing = useMemo(
    () =>
      calculatePositionSize({
        instrument,
        balance: account?.balance ?? 0,
        riskType: 'percent',
        riskValue: Number(riskPct),
        entryPrice: entryNum,
        stopLoss: stopNum,
      }),
    [instrument, account?.balance, riskPct, entryNum, stopNum]
  );

  const plannedRR = useMemo(
    () => calculatePlannedRR(direction, entryNum, stopNum, targetNum),
    [direction, entryNum, stopNum, targetNum]
  );

  const plannedRisk = useMemo(
    () =>
      sizing.lotSize ? estimateRiskAtStop(instrument, sizing.lotSize, entryNum, stopNum) : null,
    [instrument, sizing.lotSize, entryNum, stopNum]
  );

  const guard = usePreTradeGuard(trades, account, isLocked, plannedRisk);

  const canSave =
    !isCreating &&
    guard.status !== 'blocked' &&
    !!account &&
    entryNum > 0 &&
    stopNum > 0 &&
    !!sizing.lotSize;

  const handleSave = async () => {
    if (!canSave || !account) return;
    await createTrade({
      account_id: account.id,
      pair: instrument,
      direction,
      entry_price: entryNum,
      exit_price: null,
      stop_loss: stopNum,
      take_profit: targetNum || 0,
      size: sizing.lotSize!,
      entry_time: new Date().toISOString(),
      exit_time: null,
      pnl: null,
      r_multiple: null,
      timeframe: 'M15',
      setup_structures: [],
      setup_fvg: false,
      setup_ob: false,
      setup_liquidity_sweep: false,
      bookmap_absorption: null,
      bookmap_passive_orders: null,
      bookmap_aggressive_orders: null,
      bookmap_vwap_position: null,
      mental_state: 'focused',
      cookie_jar_ref: false,
      rule_40_percent: false,
      screenshot_before_url: null,
      screenshot_after_url: null,
      notes: null,
      result: 'OPEN',
      session: null,
    } as never);
    onClose();
  };

  const guardColor =
    guard.status === 'blocked'
      ? theme.colors.red
      : guard.status === 'warning'
      ? theme.colors.gold
      : theme.colors.green;

  const GuardIcon =
    guard.status === 'blocked' ? ShieldX : guard.status === 'warning' ? ShieldAlert : ShieldCheck;

  const guardMessage =
    guard.status === 'blocked'
      ? t('guardBlocked')
      : guard.status === 'warning'
      ? t('guardWarning')
      : t('guardOk');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitle}>
                <Zap size={14} color={theme.colors.primary} strokeWidth={2} />
                <Text style={styles.title}>{t('quickEntry')}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityLabel={t('cancel')}>
                <X size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <Hairline />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              {/* Direction — the single most important toggle */}
              <View style={styles.dirRow}>
                {(['BUY', 'SELL'] as const).map(d => {
                  const active = direction === d;
                  const c = d === 'BUY' ? theme.colors.green : theme.colors.red;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.dirBtn,
                        active && { backgroundColor: c + '1A', borderColor: c },
                      ]}
                      onPress={() => setDirection(d)}
                      activeOpacity={0.8}
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[styles.dirText, { color: active ? c : theme.colors.textMuted }]}
                      >
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Instrument */}
              <Text style={styles.label}>{t('instrument')}</Text>
              <TouchableOpacity
                style={styles.select}
                onPress={() => setInstrumentPickerVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.selectText}>{INSTRUMENTS[instrument]?.label}</Text>
              </TouchableOpacity>

              {/* Prices */}
              <View style={styles.row}>
                <View style={styles.col}>
                  <Text style={styles.label}>{t('entryPrice')}</Text>
                  <TextInput
                    style={styles.input}
                    value={entry}
                    onChangeText={setEntry}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textDark}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={[styles.label, { color: theme.colors.red }]}>SL</Text>
                  <TextInput
                    style={styles.input}
                    value={stop}
                    onChangeText={setStop}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textDark}
                  />
                </View>
                <View style={styles.col}>
                  <Text style={[styles.label, { color: theme.colors.green }]}>TP</Text>
                  <TextInput
                    style={styles.input}
                    value={target}
                    onChangeText={setTarget}
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textDark}
                  />
                </View>
              </View>

              {/* Risk % — you size by risk, never by lots */}
              <Text style={styles.label}>{t('riskPercent')}</Text>
              <View style={styles.riskRow}>
                {['0.5', '1', '1.5', '2'].map(p => {
                  const active = riskPct === p;
                  return (
                    <TouchableOpacity
                      key={p}
                      style={[styles.riskChip, active && styles.riskChipActive]}
                      onPress={() => setRiskPct(p)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.riskChipText, active && styles.riskChipTextActive]}>
                        {p}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TextInput
                  style={[styles.input, styles.riskInput]}
                  value={riskPct}
                  onChangeText={setRiskPct}
                  keyboardType="decimal-pad"
                />
              </View>

              {/* Derived readout */}
              <View style={styles.readout}>
                <View style={styles.readoutItem}>
                  <Text style={styles.readoutLabel}>{t('suggestedSize')}</Text>
                  <Text style={styles.readoutValue}>
                    {sizing.lotSize !== null ? `${sizing.lotSize}` : '—'}
                  </Text>
                </View>
                <View style={styles.vRule} />
                <View style={styles.readoutItem}>
                  <Text style={styles.readoutLabel}>{t('riskLabel')}</Text>
                  <Text style={[styles.readoutValue, { color: theme.colors.red }]}>
                    {plannedRisk !== null ? formatCurrency(-plannedRisk, { decimals: 0 }) : '—'}
                  </Text>
                </View>
                <View style={styles.vRule} />
                <View style={styles.readoutItem}>
                  <Text style={styles.readoutLabel}>R:R</Text>
                  <Text
                    style={[
                      styles.readoutValue,
                      {
                        color:
                          plannedRR === null
                            ? theme.colors.textMuted
                            : plannedRR >= 2
                            ? theme.colors.green
                            : plannedRR >= 1
                            ? theme.colors.gold
                            : theme.colors.red,
                      },
                    ]}
                  >
                    {plannedRR !== null ? `${plannedRR.toFixed(2)}` : '—'}
                  </Text>
                </View>
              </View>

              {/* Pre-trade guard */}
              <View style={[styles.guard, { borderLeftColor: guardColor }]}>
                <GuardIcon size={16} color={guardColor} strokeWidth={1.75} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.guardTitle, { color: guardColor }]}>
                    {t('preTradeGuard')}
                  </Text>
                  <Text style={styles.guardMsg}>{guardMessage}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.guardLabel}>{t('riskRemaining')}</Text>
                  <Text style={[styles.guardValue, { color: guardColor }]}>
                    {formatCurrency(guard.remaining, { decimals: 0 })}
                  </Text>
                </View>
              </View>
            </ScrollView>

            {/* Footer */}
            <Hairline />
            <View style={styles.footer}>
              <Text style={styles.footerHint}>{t('completeLater')}</Text>
              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={handleSave}
                disabled={!canSave}
                activeOpacity={0.85}
              >
                <Text style={[styles.saveText, !canSave && { color: theme.colors.textDark }]}>
                  {t('save')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      <PickerModal
        visible={instrumentPickerVisible}
        title={t('posCalcPickInstrument')}
        items={INSTRUMENT_KEYS.map(k => ({ id: k, label: INSTRUMENTS[k].label }))}
        selectedId={instrument}
        onSelect={id => {
          setInstrument(id);
          setInstrumentPickerVisible(false);
        }}
        onClose={() => setInstrumentPickerVisible(false)}
      />
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'flex-end',
    },
    sheetWrap: { justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.colors.modalBg,
      borderTopLeftRadius: theme.borderRadius.xl,
      borderTopRightRadius: theme.borderRadius.xl,
      maxHeight: '92%',
      borderTopWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
    },
    headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.4,
    },
    body: { padding: theme.spacing.lg, gap: theme.spacing.sm },

    dirRow: { flexDirection: 'row', gap: theme.spacing.sm, marginBottom: theme.spacing.sm },
    dirBtn: {
      flex: 1,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    dirText: {
      fontSize: theme.type.title,
      fontFamily: theme.fonts.monoExtraBold,
      letterSpacing: 1.6,
    },

    label: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
      marginBottom: 5,
      marginTop: 6,
    },
    select: {
      height: 40,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: theme.borderRadius.sm,
    },
    selectText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoMedium,
    },
    row: { flexDirection: 'row', gap: theme.spacing.sm },
    col: { flex: 1 },
    input: {
      height: 40,
      paddingHorizontal: theme.spacing.md,
      backgroundColor: theme.colors.inputBg,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: theme.borderRadius.sm,
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },

    riskRow: { flexDirection: 'row', gap: theme.spacing.xs, alignItems: 'center' },
    riskChip: {
      flex: 1,
      height: 36,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    riskChipActive: {
      backgroundColor: theme.colors.primaryMuted,
      borderColor: theme.colors.primary,
    },
    riskChipText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
    },
    riskChipTextActive: { color: theme.colors.primary },
    riskInput: { width: 62, height: 36, textAlign: 'center', paddingHorizontal: 4 },

    readout: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.borderRadius.sm,
      paddingVertical: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    readoutItem: { flex: 1, alignItems: 'center' },
    readoutLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginBottom: 4,
    },
    readoutValue: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.metric,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    vRule: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: theme.colors.hairline,
    },

    guard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.surface,
      borderLeftWidth: 2,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
      marginTop: theme.spacing.md,
    },
    guardTitle: {
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
    },
    guardMsg: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 2,
    },
    guardLabel: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    guardValue: {
      fontSize: theme.type.metricSm,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },

    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    footerHint: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      flex: 1,
    },
    saveBtn: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 24,
      height: 42,
      borderRadius: theme.borderRadius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: { backgroundColor: theme.colors.surfaceLight },
    saveText: {
      color: theme.colors.background,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoExtraBold,
      letterSpacing: 1,
    },
  });
