import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Modal } from 'react-native';
import { ListChecks, ChevronRight, Download, Wand2, Check, Sparkles } from 'lucide-react-native';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { Panel, Hairline } from '../ui/Panel';
import { PressableScale } from '../ui/PressableScale';
import { useMoney } from '../../features/accounts/useMoney';
import { useJournalGaps } from '../../features/trades/useJournalGaps';
import { useToast } from '../../store/toastStore';
import { hapticSuccess } from '../../utils/haptics';
import { formatShortDate } from '../../utils/formatDate';
import type { GapRow } from '../../features/trades/journalGaps';
import type { Trade } from '../../types/domain';

/**
 * Missing-data card — the journal's own audit, rendered.
 *
 * The chat's `gaps` block answers "what is missing from my trades" in prose;
 * this card answers it in a list the trader can act on: every incomplete
 * trade, its missing fields as chips, worst first. A tap opens the same edit
 * form the Trades screen uses, so completing a record costs one round trip.
 *
 * When the broker bridge recorded costs the journal lacks (the ingest
 * contract stores commission/swap on every staging row), the row offers a
 * one-tap fill — explicit, confirmed by the press, never automatic. The
 * header button does the same for the WHOLE displayed scope in one press:
 * broker costs first (the scarce, authoritative part), then every R the
 * device can derive from the trades' own prices.
 *
 * Renders nothing when the journal is complete: an empty audit is good news,
 * and good news does not buy screen space.
 */
export const MissingDataCard: React.FC<{
  /** Already account-scoped, like every other card here. */
  trades: Trade[];
  /** Open the edit form for one trade; the screen owns the modal. */
  onEditTrade: (trade: Trade) => void;
}> = ({ trades, onEditTrade }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const {
    report,
    brokerCosts,
    applyCosts,
    fillableCount,
    fillPlanSummary,
    fillAllFromBroker,
  } = useJournalGaps();
  const { showSuccess } = useToast();
  const [filling, setFilling] = useState(false);
  // The write only ever runs from this dialog's confirm button; the card's
  // own button opens the dialog and nothing else.
  const [confirmVisible, setConfirmVisible] = useState(false);

  if (report.incomplete === 0) return null;

  const topRows = report.rows.slice(0, 8);
  const extra = report.incomplete - topRows.length;
  /**
   * Why the one-tap button is (or is not) on the card, in one boolean: the
   * button covers ONLY what the data licenses — costs the broker recorded,
   * R derivable from stored prices. When it sits at 0, the absence must be
   * explained or the demo screenshot's button reads as a bug: these trades
   * keep their SL/TP/MAE-MFE gaps and only the trader or the terminal can
   * close those. The bridge-sourced count decides between the two honest
   * sentences: "ask the terminal" (chat: request_broker_fill) or "it is
   * yours to fill".
   */
  const bridgeSourced = report.rows.filter(r => r.trade.sync_source_id != null).length;
  const manualOnly = fillableCount === 0;
  const emptyNote = manualOnly
    ? bridgeSourced > 0
      ? t('gapsFillNoneBridge').replace('{n}', String(bridgeSourced))
      : t('gapsFillNoneManual')
    : null;

  /**
   * Runs from the confirmation only. The count comes back from the write
   * loop — 0 means every fillable value was already written between the
   * dialog opening and the confirm press, which the toast still reports
   * rather than implying a write that did not happen.
   */
  const onFillAll = async () => {
    if (filling) return;
    setConfirmVisible(false);
    setFilling(true);
    try {
      const written = await fillAllFromBroker();
      hapticSuccess();
      showSuccess(t('gapsFillAllDone').replace('{n}', String(written)));
    } catch {
      // The write failures already surfaced their own toast via useTrades;
      // the button stays enabled so the press can be repeated.
    } finally {
      setFilling(false);
    }
  };

  return (
    <Panel>
      <View style={styles.header}>
        <ListChecks color={theme.colors.gold} size={14} strokeWidth={2} />
        <Text style={styles.title}>{t('gapsTitle')}</Text>
        <Text style={styles.badge}>{report.incomplete}</Text>
      </View>
      <Text style={styles.subtitle}>
        {t('gapsSubtitle').replace('{audited}', String(report.audited))}
      </Text>

      {/* The one-tap completion, above the list: it covers every incomplete
          trade the card shows, not just the visible worst rows. The press
          opens a confirmation — a batch write this size deserves the trader
          reading WHAT it is about to write before it happens. */}
      {fillableCount > 0 ? (
        <PressableScale
          style={styles.fillAllBtn}
          onPress={() => setConfirmVisible(true)}
          disabled={filling}
          accessibilityRole="button"
          accessibilityLabel={t('gapsFillAllA11y')}
        >
          <Wand2 size={12} color={theme.colors.background} strokeWidth={2} />
          <Text style={styles.fillAllText}>{t('gapsFillAll')}</Text>
          <View style={styles.fillAllCountWrap}>
            <Text style={styles.fillAllCount}>{fillableCount}</Text>
          </View>
        </PressableScale>
      ) : emptyNote ? (
        <View style={styles.fillNoneNote}>
          <Sparkles size={12} color={theme.colors.textMuted} strokeWidth={2} />
          <Text style={styles.fillNoneText}>{emptyNote}</Text>
        </View>
      ) : null}

      <Hairline />

      {topRows.map((row, i) => (
        <GapRowView
          key={row.trade.id}
          row={row}
          first={i === 0}
          brokerCost={brokerCosts.get(row.trade.id)}
          onEdit={() => onEditTrade(row.trade)}
          onFill={applyCosts}
        />
      ))}

      {extra > 0 ? <Text style={styles.more}>{t('gapsMore').replace('{n}', String(extra))}</Text> : null}

      <Text style={styles.hint}>{t('gapsHint')}</Text>

      {/* The confirmation: an exact inventory of the writes, recomputed live
          from the same plan the writes will run. Counting "costs" and "R"
          separately is the point — a total like "7 writes" hides that only
          2 trades get broker costs while 5 get derived R. */}
      <Modal
        visible={confirmVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmVisible(false)}
      >
        <PressableScale style={styles.scrim} onPress={() => setConfirmVisible(false)}>
          <PressableScale style={styles.dialog}>
            <Text style={styles.dialogTitle}>{t('gapsConfirmTitle')}</Text>
            <Text style={styles.dialogBody}>{t('gapsConfirmBody')}</Text>

            <View style={styles.dialogStats}>
              <View style={styles.dialogStat}>
                <Text style={styles.dialogStatValue}>{fillPlanSummary.trades}</Text>
                <Text style={styles.dialogStatLabel}>{t('gapsConfirmTrades')}</Text>
              </View>
              <View style={styles.dialogStatDivider} />
              <View style={styles.dialogStat}>
                <Text style={[styles.dialogStatValue, { color: theme.colors.gold }]}>
                  {fillPlanSummary.costs}
                </Text>
                <Text style={styles.dialogStatLabel}>{t('gapsConfirmCosts')}</Text>
              </View>
              <View style={styles.dialogStatDivider} />
              <View style={styles.dialogStat}>
                <Text style={[styles.dialogStatValue, { color: theme.colors.cyan }]}>
                  {fillPlanSummary.r}
                </Text>
                <Text style={styles.dialogStatLabel}>{t('gapsConfirmR')}</Text>
              </View>
            </View>

            <Text style={styles.dialogNote}>{t('gapsConfirmNote')}</Text>

            <View style={styles.dialogActions}>
              <PressableScale
                style={styles.dialogCancel}
                onPress={() => setConfirmVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('gapsConfirmCancel')}
              >
                <Text style={styles.dialogCancelText}>{t('gapsConfirmCancel')}</Text>
              </PressableScale>
              <PressableScale
                style={[styles.dialogConfirm, filling && styles.fillAllBtnBusy]}
                onPress={() => {
                  void onFillAll();
                }}
                disabled={filling}
                accessibilityRole="button"
                accessibilityLabel={t('gapsFillAllA11y')}
              >
                {filling ? (
                  <ActivityIndicator size="small" color={theme.colors.background} />
                  ) : (
                  <Check size={13} color={theme.colors.background} strokeWidth={2.5} />
                )}
                <Text style={styles.dialogConfirmText}>{t('gapsConfirmGo')}</Text>
              </PressableScale>
            </View>
          </PressableScale>
        </PressableScale>
      </Modal>
    </Panel>
  );
};

/** Chips are named, not iconised: a legend would cost more than it explains. */
function GapRowView({
  row,
  first,
  brokerCost,
  onEdit,
  onFill,
}: {
  row: GapRow;
  first: boolean;
  brokerCost?: { commission: number; swap: number };
  onEdit: () => void;
  onFill: (tradeId: string, commission: number, swap: number) => Promise<void>;
}) {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const money = useMoney();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trade, gaps } = row;

  const chips: { key: string; label: string; accent: boolean }[] = [];
  if (gaps.r) {
    // The one gap the app can close itself deserves its own colour: it is
    // the chip the chat action also fills, so the two surfaces stay linked.
    chips.push({ key: 'r', label: t(gaps.rFillable ? 'gapsChipRAuto' : 'gapsChipR'), accent: gaps.rFillable });
  }
  if (gaps.stop) chips.push({ key: 'sl', label: t('gapsChipStop'), accent: false });
  if (gaps.target) chips.push({ key: 'tp', label: t('gapsChipTarget'), accent: false });
  if (gaps.exit) chips.push({ key: 'ex', label: t('gapsChipExit'), accent: false });
  if (gaps.costs) chips.push({ key: 'co', label: t('gapsChipCosts'), accent: false });
  if (gaps.excursions) chips.push({ key: 'ex2', label: t('gapsChipExc'), accent: false });
  if (gaps.notes) chips.push({ key: 'no', label: t('gapsChipNotes'), accent: false });

  return (
    <View style={[styles.row, !first && styles.rowBordered]}>
      <PressableScale
        style={styles.rowMain}
        onPress={onEdit}
        accessibilityRole="button"
        accessibilityLabel={`${trade.pair} ${formatShortDate(trade.entry_time, lang)}`}
      >
        <View style={styles.rowHead}>
          <Text style={styles.pair}>{trade.pair}</Text>
          <Text style={styles.date}>{formatShortDate(trade.entry_time, lang)}</Text>
          <ChevronRight size={12} color={theme.colors.textMuted} strokeWidth={2} />
        </View>
        <View style={styles.chipWrap}>
          {chips.map(c => (
            <View
              key={c.key}
              style={[styles.chip, c.accent && styles.chipAccent]}
            >
              <Text style={[styles.chipText, c.accent && styles.chipTextAccent]}>{c.label}</Text>
            </View>
          ))}
        </View>
      </PressableScale>

      {brokerCost && gaps.costs ? (
        <PressableScale
          style={styles.fillBtn}
          onPress={() => {
            void onFill(trade.id, brokerCost.commission, brokerCost.swap);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('gapsFillA11y')}
        >
          <Download size={11} color={theme.colors.primary} strokeWidth={2} />
          <Text style={styles.fillBtnText}>
            {t('gapsFill').replace('{c}', money(brokerCost.commission)).replace('{s}', money(brokerCost.swap))}
          </Text>
        </PressableScale>
      ) : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: 4,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.1,
      flex: 1,
    },
    badge: {
      color: theme.colors.gold,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.gold, 0.4),
      borderRadius: 8,
      paddingHorizontal: 7,
      paddingVertical: 1,
      overflow: 'hidden',
      fontVariant: ['tabular-nums'],
    },
    subtitle: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginBottom: 8,
    },
    row: {
      paddingVertical: 10,
    },
    rowBordered: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.hairline,
    },
    rowMain: { gap: 7 },
    rowHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    pair: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
      flex: 1,
    },
    date: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
    },
    chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
    chip: {
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
      borderRadius: 5,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    chipAccent: {
      borderColor: withAlpha(theme.colors.primary, 0.45),
      backgroundColor: withAlpha(theme.colors.primary, 0.1),
    },
    chipText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
    },
    chipTextAccent: {
      color: theme.colors.primaryLight,
      fontFamily: theme.fonts.monoBold,
    },
    fillBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 5,
      marginTop: 7,
      paddingHorizontal: 9,
      paddingVertical: 5,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.primary, 0.35),
      backgroundColor: withAlpha(theme.colors.primary, 0.08),
    },
    fillBtnText: {
      color: theme.colors.primaryLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.3,
    },
    more: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      paddingVertical: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.hairline,
    },
    fillAllBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      marginVertical: 10,
      paddingVertical: 10,
      borderRadius: 9,
      backgroundColor: theme.colors.primary,
    },
    fillNoneNote: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 7,
      marginVertical: 10,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    fillNoneText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      lineHeight: 16,
      flex: 1,
    },
    fillAllBtnBusy: { opacity: 0.7 },
    fillAllText: {
      color: theme.colors.background,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    fillAllCountWrap: {
      minWidth: 20,
      alignItems: 'center',
      paddingHorizontal: 6,
      paddingVertical: 1,
      borderRadius: 9,
      backgroundColor: withAlpha(theme.colors.background, 0.2),
    },
    fillAllCount: {
      color: theme.colors.background,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    hint: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      paddingTop: 6,
    },

    // Confirmation dialog — same native transparent Modal pattern as the
    // trade detail: centred card over a scrim, no bottom-sheet measurement
    // risk inside a ScrollView.
    scrim: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.72)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 28,
    },
    dialog: {
      width: '100%',
      maxWidth: 340,
      backgroundColor: theme.colors.modalBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      paddingHorizontal: 18,
      paddingTop: 18,
      paddingBottom: 14,
    },
    dialogTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.4,
    },
    dialogBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
      lineHeight: 18,
      marginTop: 7,
    },
    dialogStats: {
      flexDirection: 'row',
      alignItems: 'stretch',
      marginTop: 14,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      paddingVertical: 11,
    },
    dialogStat: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
    },
    dialogStatDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.colors.hairline,
    },
    dialogStatValue: {
      color: theme.colors.textPrimary,
      fontSize: 20,
      fontFamily: theme.fonts.monoBold,
      fontVariant: ['tabular-nums'],
    },
    dialogStatLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.4,
      textAlign: 'center',
    },
    dialogNote: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      lineHeight: 15,
      marginTop: 11,
    },
    dialogActions: {
      flexDirection: 'row',
      gap: 9,
      marginTop: 15,
    },
    dialogCancel: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 11,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    dialogCancelText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    dialogConfirm: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 11,
      borderRadius: 9,
      backgroundColor: theme.colors.primary,
    },
    dialogConfirmText: {
      color: theme.colors.background,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
  });
