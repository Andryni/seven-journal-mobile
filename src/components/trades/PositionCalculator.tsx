import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAccounts } from '../../features/accounts/useAccounts';
import { useUIStore } from '../../store/uiStore';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Card } from '../ui/Card';
import { PickerModal } from '../ui/PickerModal';
import { Info } from 'lucide-react-native';

// ─── CFD / Forex instruments ───
type CfdInstrument = { type: 'cfd'; pip: number; contractSize: number; label: string };
type FuturesInstrument = {
  type: 'futures';
  tickSize: number;
  tickValue: number;
  pointValue: number;
  label: string;
};
type Instrument = CfdInstrument | FuturesInstrument;

const INSTRUMENTS: Record<string, Instrument> = {
  // CFD
  XAUUSD: { type: 'cfd', pip: 0.01, contractSize: 100, label: 'Or (XAUUSD)' },
  EURUSD: { type: 'cfd', pip: 0.0001, contractSize: 100000, label: 'EUR/USD' },
  GBPUSD: { type: 'cfd', pip: 0.0001, contractSize: 100000, label: 'GBP/USD' },
  USDJPY: { type: 'cfd', pip: 0.01, contractSize: 100000, label: 'USD/JPY' },
  GBPJPY: { type: 'cfd', pip: 0.01, contractSize: 100000, label: 'GBP/JPY' },
  US30: { type: 'cfd', pip: 1, contractSize: 1, label: 'US30 (Dow Jones)' },
  NAS100: { type: 'cfd', pip: 0.25, contractSize: 20, label: 'NAS100 (Nasdaq)' },
  BTCUSD: { type: 'cfd', pip: 1, contractSize: 1, label: 'Bitcoin (BTC/USD)' },
  // Futures — E-mini & Micro
  ES: { type: 'futures', tickSize: 0.25, tickValue: 12.5, pointValue: 50, label: 'ES — E-mini S&P 500' },
  MES: { type: 'futures', tickSize: 0.25, tickValue: 1.25, pointValue: 5, label: 'MES — Micro E-mini S&P 500' },
  NQ: { type: 'futures', tickSize: 0.25, tickValue: 5, pointValue: 20, label: 'NQ — E-mini Nasdaq' },
  MNQ: { type: 'futures', tickSize: 0.25, tickValue: 0.5, pointValue: 2, label: 'MNQ — Micro E-mini Nasdaq' },
  YM: { type: 'futures', tickSize: 1, tickValue: 5, pointValue: 10, label: 'YM — E-mini Dow' },
  MYM: { type: 'futures', tickSize: 1, tickValue: 0.5, pointValue: 1, label: 'MYM — Micro E-mini Dow' },
  GC: { type: 'futures', tickSize: 0.1, tickValue: 10, pointValue: 100, label: 'GC — Gold' },
  MGC: { type: 'futures', tickSize: 0.1, tickValue: 1, pointValue: 10, label: 'MGC — Micro Gold' },
};

type MarketType = 'cfd' | 'futures';

const CFD_KEYS = Object.keys(INSTRUMENTS).filter((k) => INSTRUMENTS[k].type === 'cfd');
const FUTURES_KEYS = Object.keys(INSTRUMENTS).filter((k) => INSTRUMENTS[k].type === 'futures');

export const PositionCalculator: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { accounts } = useAccounts();
  const activeAccountId = useUIStore((s: { activeAccountId: string | null }) => s.activeAccountId);

  const [marketType, setMarketType] = useState<MarketType>('cfd');
  const [instrument, setInstrument] = useState('XAUUSD');
  const [accountId, setAccountId] = useState(activeAccountId || accounts[0]?.id || '');
  const [riskType, setRiskType] = useState<'percent' | 'usd'>('percent');
  const [riskValue, setRiskValue] = useState('1');
  const [entryPrice, setEntryPrice] = useState('');
  const [stopLossPrice, setStopLossPrice] = useState('');

  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const [instrumentPickerVisible, setInstrumentPickerVisible] = useState(false);

  // Results
  const [lotSize, setLotSize] = useState<number | null>(null);
  const [contracts, setContracts] = useState<number | null>(null);
  const [riskUsd, setRiskUsd] = useState<number | null>(null);
  const [pipValue, setPipValue] = useState<number | null>(null);
  const [slPips, setSlPips] = useState<number | null>(null);
  const [slTicks, setSlTicks] = useState<number | null>(null);
  const [slPoints, setSlPoints] = useState<number | null>(null);
  const [minRiskUsd, setMinRiskUsd] = useState<number | null>(null);
  const [riskTooLow, setRiskTooLow] = useState(false);

  // Switch instrument list when market type changes
  useEffect(() => {
    setInstrument(marketType === 'cfd' ? 'XAUUSD' : 'ES');
  }, [marketType]);

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
      setContracts(null);
      setRiskUsd(null);
      setPipValue(null);
      setSlPips(null);
      setSlTicks(null);
      setSlPoints(null);
      setMinRiskUsd(null);
      setRiskTooLow(false);
      return;
    }

    const computedRiskUsd = riskType === 'percent' ? balance * (risk / 100) : risk;
    const slDistance = Math.abs(entry - sl);

    setRiskUsd(computedRiskUsd);
    setSlPoints(Math.round(slDistance * 100) / 100);

    if (inst.type === 'cfd') {
      const slInPips = slDistance / inst.pip;
      const pipValuePerLot = inst.pip * inst.contractSize;
      const computedLotSize = computedRiskUsd / (slInPips * pipValuePerLot);
      setSlPips(Math.round(slInPips * 10) / 10);
      setSlTicks(null);
      setPipValue(pipValuePerLot);
      setLotSize(Math.round(computedLotSize * 100) / 100);
      setContracts(null);
    } else {
      // Futures: ticks = slDistance / tickSize, value per tick = tickValue
      const slInTicks = slDistance / inst.tickSize;
      const riskPerContract = slInTicks * inst.tickValue;
      const computedContracts = computedRiskUsd / riskPerContract;
      const minRisk = riskPerContract; // minimum risk for 1 contract
      setSlTicks(Math.round(slInTicks * 10) / 10);
      setSlPips(null);
      setPipValue(inst.tickValue);
      setMinRiskUsd(Math.round(minRisk * 100) / 100);
      if (computedContracts < 1) {
        // Risk too small for even 1 contract
        setRiskTooLow(true);
        setContracts(null);
      } else {
        setRiskTooLow(false);
        setContracts(Math.round(computedContracts));
      }
      setLotSize(null);
    }
  }, [entryPrice, stopLossPrice, riskValue, riskType, instrument, accountId, accounts]);

  const activeAccount = accounts.find((a) => a.id === accountId);
  const riskLabel = riskType === 'percent' ? '%' : '$';
  const currentInst = INSTRUMENTS[instrument];
  const isFutures = currentInst?.type === 'futures';

  const instrumentKeys = marketType === 'cfd' ? CFD_KEYS : FUTURES_KEYS;

  return (
    <Card title={t('posCalcTitle')}>
      {/* Market Type Toggle */}
      <View style={styles.row}>
        <View style={styles.marketTypeContainer}>
          <Text style={styles.fieldLabel}>{t('posCalcMarketType')}</Text>
          <View style={styles.marketTypeRow}>
            {(['cfd', 'futures'] as const).map((mt) => (
              <TouchableOpacity
                key={mt}
                style={[styles.marketTypeBtn, marketType === mt && styles.marketTypeBtnActive]}
                onPress={() => setMarketType(mt)}
              >
                <Text style={[styles.marketTypeText, marketType === mt && styles.marketTypeTextActive]}>
                  {mt === 'cfd' ? 'CFD' : 'FUTURES'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

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
            {currentInst?.label || instrument}
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
            placeholder={isFutures ? '5200.00' : '2350.50'}
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
            placeholder={isFutures ? '5180.00' : '2345.00'}
            placeholderTextColor={theme.colors.textMuted}
          />
        </View>
      </View>

      {/* Result */}
      {lotSize !== null || contracts !== null || riskTooLow ? (
        <Animated.View entering={FadeIn.duration(400)} style={styles.resultBox}>
          {/* Risk too low for Futures */}
          {riskTooLow && isFutures && minRiskUsd !== null && (
            <View style={styles.warningBox}>
              <Text style={styles.warningTitle}>⚠️ {t('posCalcRiskTooLow')}</Text>
              <Text style={styles.warningText}>
                {t('posCalcRiskTooLowMsg')} ${minRiskUsd.toFixed(2)} {t('posCalcRiskTooLowWith')}
              </Text>
              <Text style={styles.warningSuggestion}>
                {t('posCalcRiskSuggestion')} ${minRiskUsd.toFixed(2)} {t('posCalcRiskOrMore')}
              </Text>
            </View>
          )}

          {/* Normal result */}
          {!riskTooLow && (
            <View style={{ alignItems: 'center' }}>
              <Text style={styles.resultLabel}>
                {isFutures ? t('posCalcRecommendedContracts') : t('posCalcRecommendedLot')}
              </Text>
              <Text style={styles.resultValue}>
                {isFutures ? contracts : lotSize?.toFixed(2)}
              </Text>
              <Text style={styles.resultUnit}>
                {isFutures ? t('posCalcContractsUnit') : t('posCalcLotsUnit')}
              </Text>
            </View>
          )}

          {/* Instrument info for Futures */}
          {isFutures && currentInst.type === 'futures' && (
            <View style={styles.futuresInfoRow}>
              <View style={styles.futuresInfoItem}>
                <Text style={styles.futuresInfoLabel}>TICK</Text>
                <Text style={styles.futuresInfoValue}>{currentInst.tickSize}</Text>
              </View>
              <View style={styles.futuresInfoItem}>
                <Text style={styles.futuresInfoLabel}>TICK VAL</Text>
                <Text style={styles.futuresInfoValue}>${currentInst.tickValue}</Text>
              </View>
              <View style={styles.futuresInfoItem}>
                <Text style={styles.futuresInfoLabel}>POINT VAL</Text>
                <Text style={styles.futuresInfoValue}>${currentInst.pointValue}</Text>
              </View>
            </View>
          )}

          {/* Details row — always shown when we have data */}
          {riskUsd !== null && (
            <View style={styles.resultRow}>
              <View style={styles.resultItem}>
                <Text style={styles.resultItemLabel}>{t('posCalcRiskUsd')}</Text>
                <Text style={[styles.resultItemValue, { color: theme.colors.redLight }]}>
                  ${riskUsd?.toFixed(2)}
                </Text>
                {activeAccount && (
                  <Text style={styles.resultItemSub}>
                    {((riskUsd / activeAccount.balance) * 100).toFixed(2)}%
                  </Text>
                )}
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultItemLabel}>
                  {isFutures ? t('posCalcSlTicks') : t('posCalcSlPips')}
                </Text>
                <Text style={styles.resultItemValue}>
                  {isFutures ? slTicks : slPips}
                </Text>
              </View>
              <View style={styles.resultItem}>
                <Text style={styles.resultItemLabel}>
                  {isFutures ? t('posCalcTickValue') : t('posCalcPipValue')}
                </Text>
                <Text style={[styles.resultItemValue, { color: theme.colors.goldLight }]}>
                  ${pipValue?.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
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
        items={instrumentKeys.map((k) => ({
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
    marketTypeContainer: {
      flex: 1,
    },
    marketTypeRow: {
      flexDirection: 'row',
    },
    marketTypeBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    marketTypeBtnActive: {
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderColor: theme.colors.primary,
    },
    marketTypeText: {
      color: theme.colors.textMuted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    marketTypeTextActive: {
      color: theme.colors.primaryLight,
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
      marginBottom: 8,
    },
    futuresInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      width: '100%',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.sm,
      marginBottom: 10,
    },
    futuresInfoItem: {
      alignItems: 'center',
    },
    futuresInfoLabel: {
      color: theme.colors.textMuted,
      fontSize: 7,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 2,
    },
    futuresInfoValue: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
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
    warningBox: {
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.35)',
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      padding: theme.spacing.md,
      width: '100%',
      marginBottom: theme.spacing.sm,
    },
    warningTitle: {
      color: theme.colors.redLight,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    warningText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: theme.fonts.sans,
      marginBottom: 4,
    },
    warningSuggestion: {
      color: theme.colors.goldLight,
      fontSize: 11,
      fontFamily: theme.fonts.sansSemiBold,
    },
  });
