import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAccounts } from '../../features/accounts/useAccounts';
import { useUIStore } from '../../store/uiStore';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Card } from '../ui/Card';
import { PickerModal } from '../ui/PickerModal';
import { Calculator, Info } from 'lucide-react-native';

const INSTRUMENTS: Record<string, { pip: number; contractSize: number; label: string }> = {
  XAUUSD: { pip: 0.01, contractSize: 100, label: 'Or (XAUUSD)' },
  EURUSD: { pip: 0.0001, contractSize: 100000, label: 'EUR/USD' },
  GBPUSD: { pip: 0.0001, contractSize: 100000, label: 'GBP/USD' },
  USDJPY: { pip: 0.01, contractSize: 100000, label: 'USD/JPY' },
  GBPJPY: { pip: 0.01, contractSize: 100000, label: 'GBP/JPY' },
  US30: { pip: 1, contractSize: 1, label: 'US30 (Dow Jones)' },
  NAS100: { pip: 0.25, contractSize: 20, label: 'NAS100 (Nasdaq)' },
  BTCUSD: { pip: 1, contractSize: 1, label: 'Bitcoin (BTC/USD)' },
};

const INSTRUMENT_KEYS = Object.keys(INSTRUMENTS);

export const PositionCalculator: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { accounts } = useAccounts();
  const activeAccountId = useUIStore((s: { activeAccountId: string | null }) => s.activeAccountId);

  const [instrument, setInstrument] = useState('XAUUSD');
  const [accountId, setAccountId] = useState(activeAccountId || accounts[0]?.id || '');
  const [riskType, setRiskType] = useState<'percent' | 'usd'>('percent');
  const [riskValue, setRiskValue] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');

  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [instrumentPickerVisible, setInstrumentPickerVisible] = useState(false);

  const [lotSize, setLotSize] = useState<number | null>(null);
  const [riskUsd, setRiskUsd] = useState<number | null>(null);
  const [pipValue, setPipValue] = useState<number | null>(null);
  const [slPips, setSlPips] = useState<number | null>(null);

  useEffect(() => {
    if (activeAccountId && !accountId) setAccountId(activeAccountId);
  }, [activeAccountId, accountId]);

  useEffect(() => {
    const entry = Number(entryPrice);
    const sl = Number(stopLossPrice);
    const risk = Number(riskValue);
    const acc = accounts.find((a) => a.id === accountId);
    const balance = acc ? acc.balance : 0;
    const inst = INSTRUMENTS[instrument];

    if (!inst || entry <= 0 || sl <= 0 || entry === sl || risk <= 0 || balance <= 0) {
      setLotSize(null);
      setRiskUsd(null);
      setPipValue(null);
      setSlPips(null);
      return;
    }

    const computedRiskUsd = riskType === 'percent' ? balance * (risk / 100) : risk;
    const slDistance = Math.abs(entry - sl);
    const slInPips = slDistance / inst.pip;
    const pipValuePerLot = inst.pip * inst.contractSize;
    const computedLotSize = computedRiskUsd / (slInPips * pipValuePerLot);

    setRiskUsd(computedRiskUsd);
    setSlPips(Math.round(slInPips * 10) / 10);
    setPipValue(pipValuePerLot);
    setLotSize(Math.round(computedLotSize * 100) / 100);
  }, [entryPrice, stopLossPrice, riskValue, riskType, instrument, accountId, accounts]);

  const activeAccount = accounts.find((a) => a.id === accountId);
  const riskLabel = riskType === 'percent' ? '%' : '$';

  return (
    <Card title={t('posCalcTitle')}>
      {/* Account + Instrument */}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setAccountPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerLabel}>{t('posCalcAccount')}</Text>
          <Text style={styles.pickerValue} numberOfLines={1}>
            {activeAccount ? activeAccount.name.toUpperCase() : 'Sélectionner'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setInstrumentPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={styles.pickerLabel}>{t('posCalcInstrument')}</Text>
          <Text style={styles.pickerValue} numberOfLines={1}>
            {INSTRUMENTS[instrument]?.label || instrument}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Risk Type + Value */}
      <View style={styles.row}>
        <View style={styles.riskTypeContainer}>
          <Text style={styles.fieldLabel}>{t('posCalcRiskType')}</Text>
          <View style={styles.riskTypeRow}>
            {(['percent', 'usd'] as const).map((rt) => (
              <TouchableOpacity
                key={rt}
                style={[styles.riskTypeBtn, riskType === rt && styles.riskTypeBtnActive]}
                onPress={() => setRiskType(rt)}
              >
                <Text style={[styles.riskTypeText, riskType === rt && styles.riskTypeTextActive]}>
                  {rt === 'percent' ? '%' : '$'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>VALEUR ({riskLabel})</Text>
          <TextInput
            style={styles.input}
            value={riskValue}
            onChangeText={setRiskValue}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
      </View>

      {/* Entry + SL */}
      <View style={styles.row}>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{t('posCalcEntryPrice')}</Text>
          <TextInput
            style={styles.input}
            value={entryPrice}
            onChangeText={setEntryPrice}
            keyboardType="decimal-pad"
            placeholder="2350.50"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
        <View style={styles.fieldContainer}>
          <Text style={styles.fieldLabel}>{t('posCalcStopLoss')}</Text>
          <TextInput
            style={styles.input}
            value={stopLossPrice}
            onChangeText={setStopLossPrice}
            keyboardType="decimal-pad"
            placeholder="2345.00"
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
      </View>

      {/* Result */}
      {lotSize !== null ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.resultBox}>
          <Text style={styles.resultLabel}>{t('posCalcRecommendedLot')}</Text>
          <Text style={styles.resultValue}>{lotSize.toFixed(2)}</Text>
          <Text style={styles.resultUnit}>{t('posCalcLotsUnit')}</Text>
          <View style={styles.resultRow}>
            <View style={styles.resultItem}>
              <Text style={styles.resultItemLabel}>{t('posCalcRiskUsd')}</Text>
              <Text style={[styles.resultItemValue, { color: theme.colors.redLight }]}>
                ${riskUsd?.toFixed(2)}
              </Text>
              {activeAccount && (
                <Text style={styles.resultItemSub}>
                  {((riskUsd! / activeAccount.balance) * 100).toFixed(2)}%
                </Text>
              )}
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultItemLabel}>{t('posCalcSlPips')}</Text>
              <Text style={styles.resultItemValue}>{slPips}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultItemLabel}>{t('posCalcPipValue')}</Text>
              <Text style={[styles.resultItemValue, { color: theme.colors.goldLight }]}>
                ${pipValue?.toFixed(2)}
              </Text>
            </View>
          </View>
        </Animated.View>
      ) : (
        <View style={styles.infoBox}>
          <Info size={12} color={theme.colors.textMuted} />
          <Text style={styles.infoText}>
            {t('posCalcInfoText')}
          </Text>
        </View>
      )}

      {/* Picker Modals */}
      <PickerModal
        visible={accountPickerVisible}
        onClose={() => setAccountPickerVisible(false)}
        title={t('posCalcPickAccount')}
        items={accounts.map((a) => ({
          label: `${a.name.toUpperCase()} — ${a.currency} ${a.balance.toLocaleString()}`,
          id: a.id,
        }))}
        selectedId={accountId}
        onSelect={(val) => {
          setAccountId(val);
          setAccountPickerVisible(false);
        }}
      />
      <PickerModal
        visible={instrumentPickerVisible}
        onClose={() => setInstrumentPickerVisible(false)}
        title={t('posCalcPickInstrument')}
        items={INSTRUMENT_KEYS.map((k) => ({
          label: INSTRUMENTS[k].label,
          id: k,
        }))}
        selectedId={instrument}
        onSelect={(val) => {
          setInstrument(val);
          setInstrumentPickerVisible(false);
        }}
      />
    </Card>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    pickerBtn: {
      flex: 1,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
    },
    pickerLabel: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    pickerValue: {
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
    },
    fieldContainer: {
      flex: 1,
    },
    fieldLabel: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 4,
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 8,
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontFamily: theme.fonts.mono,
    },
    riskTypeContainer: {
      flex: 1,
    },
    riskTypeRow: {
      flexDirection: 'row',
    },
    riskTypeBtn: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    riskTypeBtnActive: {
      backgroundColor: 'rgba(245, 158, 11, 0.2)',
      borderColor: theme.colors.goldLight,
    },
    riskTypeText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
    },
    riskTypeTextActive: {
      color: theme.colors.goldLight,
    },
    resultBox: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    resultLabel: {
      color: theme.colors.goldLight,
      fontSize: 8,
      fontWeight: '800',
      letterSpacing: 1,
      marginBottom: 4,
    },
    resultValue: {
      color: theme.colors.goldLight,
      fontSize: 36,
      fontFamily: theme.fonts.monoExtraBold,
    },
    resultUnit: {
      color: theme.colors.textMuted,
      fontSize: 10,
      marginBottom: 12,
    },
    resultRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      borderTopWidth: 1,
      borderTopColor: 'rgba(245, 158, 11, 0.2)',
      paddingTop: 12,
    },
    resultItem: {
      alignItems: 'center',
    },
    resultItemLabel: {
      color: theme.colors.textMuted,
      fontSize: 8,
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    resultItemValue: {
      color: theme.colors.textPrimary,
      fontSize: 13,
      fontFamily: theme.fonts.monoBold,
    },
    resultItemSub: {
      color: theme.colors.textMuted,
      fontSize: 8,
    },
    infoBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
      marginTop: theme.spacing.sm,
    },
    infoText: {
      color: theme.colors.textMuted,
      fontSize: 9,
      flex: 1,
      letterSpacing: 0.3,
    },
  });
