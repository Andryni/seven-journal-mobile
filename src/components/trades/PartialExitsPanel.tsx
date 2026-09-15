import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { useMoney } from '../../features/accounts/useMoney';
import { useTradeExits } from '../../features/trades/useTradeExits';
import {
  sortedExits,
  reconcile,
  averageExitPrice,
  analyseScaleOut,
} from '../../utils/partialExits';
import type { Trade } from '../../types/domain';

/**
 * Partial exits for a trade: the list, the reconciliation, and a verdict on
 * whether scaling out helped.
 *
 * The reconciliation banner is the important part. Because `trades.pnl` stays
 * authoritative and the slices are additive, the two can disagree — and a
 * journal that silently prefers one over the other would show a number that
 * contradicts the broker statement. So a disagreement is stated plainly.
 */
export const PartialExitsPanel: React.FC<{ trade: Trade }> = ({ trade }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { exits, addExit, isAdding, deleteExit } = useTradeExits(trade.id);

  const [size, setSize] = useState('');
  const [price, setPrice] = useState('');
  const [pnl, setPnl] = useState('');

  const ordered = useMemo(() => sortedExits(exits), [exits]);
  const rec = useMemo(() => reconcile(trade, ordered), [trade, ordered]);
  const avg = useMemo(() => averageExitPrice(ordered), [ordered]);
  const analysis = useMemo(() => analyseScaleOut(trade, ordered), [trade, ordered]);

  const canAdd = Number(size) > 0 && Number(price) > 0 && !isAdding;

  const handleAdd = async () => {
    if (!canAdd) return;
    await addExit({
      trade_id: trade.id,
      size: Math.abs(Number(size)),
      price: Number(price),
      // Blank stays null: a 0 would read as a breakeven slice, which is a
      // different claim from "I did not record the money for this one".
      pnl: pnl ? Number(pnl) : null,
      exit_time: new Date().toISOString(),
      note: null,
    });
    setSize('');
    setPrice('');
    setPnl('');
  };

  const banner = (() => {
    if (rec.status === 'oversized') return t('peOversized');
    if (rec.status === 'pnl-mismatch') {
      return t('peMismatch')
        .replace('{slices}', money(rec.exitsTotal ?? 0))
        .replace('{trade}', money(rec.tradeTotal ?? 0));
    }
    if (rec.status === 'partial') {
      return t('pePartial').replace('{remaining}', String(rec.remaining));
    }
    return '';
  })();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{t('peTitle')}</Text>

      {ordered.length === 0 ? (
        <Text style={styles.hint}>{t('peEmpty')}</Text>
      ) : (
        <>
          {ordered.map(e => (
            <View key={e.id} style={styles.row}>
              <Text style={styles.rowSize}>{e.size}</Text>
              <Text style={styles.rowPrice}>@ {e.price}</Text>
              <Text
                style={[
                  styles.rowPnl,
                  (e.pnl ?? 0) >= 0 ? styles.green : styles.red,
                ]}
              >
                {e.pnl === null || e.pnl === undefined ? '—' : money(e.pnl)}
              </Text>
              <TouchableOpacity
                onPress={() => deleteExit(e.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('delete')}
              >
                <Trash2 size={13} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('peAvgPrice')}</Text>
            <Text style={styles.summaryValue}>{avg ?? '—'}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('peRemaining')}</Text>
            <Text style={styles.summaryValue}>{rec.remaining}</Text>
          </View>
        </>
      )}

      {banner ? <Text style={styles.warn}>{banner}</Text> : null}

      {analysis.scaleOutEdge !== null && (
        <Text style={styles.verdict}>
          {analysis.scaleOutEdge > 0
            ? t('peCostMoney').replace('{amount}', money(Math.abs(analysis.scaleOutEdge)))
            : t('peSavedMoney').replace('{amount}', money(Math.abs(analysis.scaleOutEdge)))}
        </Text>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={t('peSize')}
          placeholderTextColor={theme.colors.textMuted}
          value={size}
          onChangeText={setSize}
          keyboardType="decimal-pad"
          accessibilityLabel={t('peSize')}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={t('pePrice')}
          placeholderTextColor={theme.colors.textMuted}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          accessibilityLabel={t('pePrice')}
        />
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder={t('pePnlOptional')}
          placeholderTextColor={theme.colors.textMuted}
          value={pnl}
          onChangeText={setPnl}
          keyboardType="decimal-pad"
          accessibilityLabel={t('pePnlOptional')}
        />
        <TouchableOpacity
          onPress={handleAdd}
          disabled={!canAdd}
          style={[styles.addBtn, !canAdd && styles.addBtnDisabled]}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canAdd }}
          accessibilityLabel={t('peAdd')}
        >
          <Plus size={14} color={theme.colors.textPrimary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      marginTop: 10,
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    title: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.7,
      marginBottom: 10,
    },
    hint: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
      lineHeight: 13,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 4,
    },
    rowSize: {
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
      width: 42,
    },
    rowPrice: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontFamily: theme.fonts.mono,
      flex: 1,
    },
    rowPnl: { fontSize: 10, fontFamily: theme.fonts.monoBold },
    green: { color: theme.colors.green },
    red: { color: theme.colors.red },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 7,
    },
    summaryLabel: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
    },
    summaryValue: {
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
    },
    warn: {
      marginTop: 10,
      color: theme.colors.gold,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
      lineHeight: 13,
    },
    verdict: {
      marginTop: 8,
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.mono,
      lineHeight: 13,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
    },
    input: {
      backgroundColor: theme.colors.inputBg,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      paddingHorizontal: 8,
      paddingVertical: 7,
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.mono,
    },
    addBtn: {
      padding: 8,
      borderRadius: 7,
      backgroundColor: theme.colors.primary,
    },
    addBtnDisabled: { opacity: 0.4 },
  });
