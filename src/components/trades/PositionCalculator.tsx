import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAccounts } from '../../features/accounts/useAccounts';
import { useUIStore } from '../../store/uiStore';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Card } from '../ui/Card';
import { PickerModal } from '../ui/PickerModal';
import { Calculator, Info } from 'lucide-react-native';
/**
 * Instrument specs and sizing math come from the shared engine.
 * This file used to carry its own copy of the table, and the two had already
 * drifted: XAUUSD was pip 0.01 here vs 0.1 in utils/positionSizing, so the
 * calculator and the quick-entry sheet returned lot sizes differing by 10x
 * for the same trade.
 */
import {
  INSTRUMENTS,
  calculatePositionSize,
  instrumentsForMarket,
  normalizeMarket,
  defaultInstrumentFor,
  formatSize,
} from '../../utils/positionSizing';
import type { SizeUnit } from '../../utils/positionSizing';
import { currencySymbol } from '../../utils/formatCurrency';
import { useSizeUnitLabel } from '../../features/accounts/useMarket';

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

  const [size, setSize] = useState<number | null>(null);
  const [sizeUnit, setSizeUnit] = useState<SizeUnit>('lot');
  const [belowMinimum, setBelowMinimum] = useState(false);
  const [riskUsd, setRiskUsd] = useState<number | null>(null);
  const [actualRisk, setActualRisk] = useState<number | null>(null);
  const [tickValue, setTickValue] = useState<number | null>(null);
  const [stopTicks, setStopTicks] = useState<number | null>(null);

  useEffect(() => {
    if (activeAccountId && !accountId) setAccountId(activeAccountId);
  }, [activeAccountId, accountId]);

  useEffect(() => {
    const acc = accounts.find((a) => a.id === accountId);
    const result = calculatePositionSize({
      instrument,
      balance: acc ? acc.balance : 0,
      riskType,
      riskValue: Number(riskValue),
      entryPrice: Number(entryPrice),
      stopLoss: Number(stopLossPrice),
    });

    setSize(result.size);
    setSizeUnit(result.unit);
    setBelowMinimum(result.belowMinimum);
    setRiskUsd(result.riskAmount);
    setActualRisk(result.actualRisk);
    setTickValue(result.tickValue);
    setStopTicks(result.stopTicks);
  }, [entryPrice, stopLossPrice, riskValue, riskType, instrument, accountId, accounts]);

  const activeAccount = accounts.find((a) => a.id === accountId);
  const market = normalizeMarket(activeAccount?.instrument_type);
  const availableInstruments = useMemo(() => instrumentsForMarket(market), [market]);
  const unitLabel = useSizeUnitLabel(sizeUnit);

  // Keep the instrument inside the selected account's market.
  useEffect(() => {
    if (!availableInstruments.includes(instrument)) {
      setInstrument(defaultInstrumentFor(market));
    }
  }, [availableInstruments, instrument, market]);
  const sym = currencySymbol(activeAccount?.currency);
  const riskLabel = riskType === 'percent' ? '%' : sym;

  return (
    <Card title={t('posCalcTitle')}>
      {/* Account + Instrument */}
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.pickerBtn}
          onPress={() => setAccountPickerVisible(true)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={t('posCalcAccount')}
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
          accessibilityRole="button"
          accessibilityLabel={t('posCalcInstrument')}
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
                accessibilityRole="radio"
                accessibilityState={{ selected: riskType === rt }}
                accessibilityLabel={rt}
              >
                <Text style={[styles.riskTypeText, riskType === rt && styles.riskTypeTextActive]}>
                  {rt === 'percent' ? '%' : sym}
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
      {size !== null ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.resultBox}>
          <Text style={styles.resultLabel}>{t('posCalcRecommendedLot')}</Text>
          <Text style={styles.resultValue}>{formatSize(size, sizeUnit)}</Text>
          <Text style={styles.resultUnit}>{unitLabel}</Text>
          <View style={styles.resultRow}>
            <View style={styles.resultItem}>
              <Text style={styles.resultItemLabel}>{t('posCalcRiskUsd')}</Text>
              <Text style={[styles.resultItemValue, { color: theme.colors.redLight }]}>
                {sym}{actualRisk?.toFixed(2)}
              </Text>
              {/* A zero balance renders "Infinity%" -- a blown or freshly
                  created account is exactly when this screen gets opened. */}
              {activeAccount && activeAccount.balance > 0 && (
                <Text style={styles.resultItemSub}>
                  {((actualRisk! / activeAccount.balance) * 100).toFixed(2)}%
                </Text>
              )}
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultItemLabel}>{t('stopTicksLabel')}</Text>
              <Text style={styles.resultItemValue}>{stopTicks}</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={styles.resultItemLabel}>{t('tickValueLabel')}</Text>
              <Text style={[styles.resultItemValue, { color: theme.colors.goldLight }]}>
                {sym}{tickValue?.toFixed(2)}
              </Text>
            </View>
          </View>
          {/* Whole-contract rounding means the position often risks less than
              asked. Showing only the budget would overstate the exposure. */}
          {actualRisk !== null && riskUsd !== null && actualRisk < riskUsd - 0.01 && (
            <Text style={styles.roundedNote}>
              {t('roundedDown')} · {t('posCalcRiskUsd')} {sym}{riskUsd.toFixed(2)}
            </Text>
          )}
        </Animated.View>
      ) : belowMinimum ? (
        <View style={styles.infoBox}>
          <Info size={12} color={theme.colors.gold} />
          <Text style={[styles.infoText, { color: theme.colors.gold }]}>
            {t('belowMinSize')} — {t('belowMinSizeHint')}
          </Text>
        </View>
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
          label: `${a.name.toUpperCase()} — ${currencySymbol(a.currency)}${a.balance.toLocaleString()}`,
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
        items={availableInstruments.map((k) => ({
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
      fontFamily: theme.fonts.monoBold,
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
      fontFamily: theme.fonts.monoBold,
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
      backgroundColor: withAlpha(theme.colors.gold, 0.2),
      borderColor: theme.colors.goldLight,
    },
    riskTypeText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
    },
    riskTypeTextActive: {
      color: theme.colors.goldLight,
    },
    resultBox: {
      backgroundColor: withAlpha(theme.colors.gold, 0.1),
      borderColor: withAlpha(theme.colors.gold, 0.3),
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.lg,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    resultLabel: {
      color: theme.colors.goldLight,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginBottom: 4,
    },
    resultValue: {
      color: theme.colors.goldLight,
      fontSize: 36,
      fontFamily: theme.fonts.monoExtraBold,
    },
    roundedNote: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      textAlign: 'center',
      marginTop: 6,
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
      borderTopColor: withAlpha(theme.colors.gold, 0.2),
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
