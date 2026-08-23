import React, { useMemo, useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { localeFor, mentalStateLabel, mistakeLabel, sessionLabel, useT } from '../../i18n';
import type { Trade } from '../../types/domain';
import { formatCurrency } from '../../utils/formatCurrency';
import { formatTradeDuration, classifyTradeStyle } from '../../utils/formatDate';
import { useTrades } from '../../features/trades/useTrades';
import { useAccounts } from '../../features/accounts/useAccounts';
import { Badge } from '../ui/Badge';
import { X, Edit3, Trash2, ExternalLink, Clock, Zap } from 'lucide-react-native';

interface TradeDetailModalProps {
  visible: boolean;
  onClose: () => void;
  trade: Trade | null;
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
}

export const TradeDetailModal: React.FC<TradeDetailModalProps> = ({
  visible,
  onClose,
  trade,
  onEdit,
  onDelete,
}) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { fetchTradeFull } = useTrades();
  const { accounts } = useAccounts();
  const [fullTrade, setFullTrade] = useState<Trade | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);

  useEffect(() => {
    if (visible && trade?.id) {
      setLoadingFull(true);
      fetchTradeFull(trade.id)
        .then((data) => { if (data) setFullTrade(data); })
        .catch(() => {}) // fallback to basic trade data
        .finally(() => setLoadingFull(false));
    } else {
      setFullTrade(null);
    }
  }, [visible, trade?.id]);

  const displayTrade = fullTrade || trade;
  if (!displayTrade) return null;

  const isWin = (displayTrade.pnl || 0) > 0;
  const isLoss = (displayTrade.pnl || 0) < 0;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleInfo}>
              <Text style={styles.pairText}>{displayTrade.pair}</Text>
              <Badge label={displayTrade.direction} variant={displayTrade.direction === 'BUY' ? 'blue' : 'gold'} />
              <Badge label={displayTrade.result} variant={displayTrade.result === 'TP' ? 'green' : displayTrade.result === 'SL' ? 'red' : 'neutral'} />
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel={t('tdCloseDetail')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X color={theme.colors.textPrimary} size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* P&L & R-Multiple Highlight */}
            <View style={styles.pnlBanner}>
              <View>
                <Text style={styles.pnlLabel}>{t('tdNetPnl')}</Text>
                <Text style={[styles.pnlValue, isWin ? styles.greenText : isLoss ? styles.redText : null]}>
                  {displayTrade.pnl !== null ? formatCurrency(displayTrade.pnl) : 'OPEN'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pnlLabel}>{t('tdRMultiple')}</Text>
                <Text style={[styles.rValue, (displayTrade.r_multiple || 0) >= 0 ? styles.greenText : styles.redText]}>
                  {displayTrade.r_multiple !== null ? `${displayTrade.r_multiple >= 0 ? '+' : ''}${displayTrade.r_multiple} R` : '—'}
                </Text>
              </View>
            </View>

            {/* Détails Exécution */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>{t('tdExecutionParams')}</Text>
              {(() => {
                const acc = accounts.find(a => a.id === displayTrade.account_id);
                if (!acc) return null;
                const isFutures = (acc as any)?.instrument_type === 'Futures';
                return (
                  <View style={styles.detailRow}>
                    <Text style={styles.label}>{t('tabAccounts') || 'Compte'}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.val, { fontWeight: '800' }]}>{acc.name}</Text>
                      <Badge
                        label={isFutures ? 'FUTURES' : 'CFD'}
                        variant={isFutures ? 'gold' : 'blue'}
                        size="sm"
                      />
                    </View>
                  </View>
                );
              })()}
              <View style={styles.detailRow}>
                <Text style={styles.label}>{t('tdEntryDate')}</Text>
                <Text style={styles.val}>{new Date(displayTrade.entry_time).toLocaleString(localeFor(lang))}</Text>
              </View>
              {displayTrade.exit_time && (
                <>
                  <View style={styles.detailRow}>
                    <Text style={styles.label}>{t('tdExitDate')}</Text>
                    <Text style={styles.val}>{new Date(displayTrade.exit_time).toLocaleString(localeFor(lang))}</Text>
                  </View>
                  {(() => {
                    const entryMs = new Date(displayTrade.entry_time).getTime();
                    const exitMs = new Date(displayTrade.exit_time).getTime();
                    const diffMins = Math.max(0, (exitMs - entryMs) / 60000);
                    const styleKey = classifyTradeStyle(diffMins);
                    const isStyleScalp = styleKey === 'scalping';
                    const isStyleIntra = styleKey === 'intraday';

                    return (
                      <>
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>{t('tdDuration')}</Text>
                          <Text style={[styles.val, { color: theme.colors.primaryLight, fontWeight: '800' }]}>
                            ⏱️ {formatTradeDuration(diffMins, lang)}
                          </Text>
                        </View>
                        <View style={styles.detailRow}>
                          <Text style={styles.label}>{t('tdTradeStyle')}</Text>
                          <Text style={[styles.val, { color: isStyleScalp ? theme.colors.cyanLight : isStyleIntra ? theme.colors.goldLight : theme.colors.purpleLight, fontWeight: '800' }]}>
                            {styleKey === 'scalping' ? t('tradeStyleScalping') : styleKey === 'intraday' ? t('tradeStyleIntraday') : t('tradeStyleSwing')}
                          </Text>
                        </View>
                      </>
                    );
                  })()}
                </>
              )}
              <View style={styles.detailRow}>
                <Text style={styles.label}>{t('tdTimeframe')}</Text>
                <Text style={styles.val}>{displayTrade.timeframe}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>{t('tdSession')}</Text>
                <Text style={styles.val}>{sessionLabel(t, displayTrade.session)}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>{t('tdVolume')}</Text>
                {(() => {
                  const acc = accounts.find(a => a.id === displayTrade.account_id);
                  const isFutures = (acc as any)?.instrument_type === 'Futures';
                  return (
                    <Text style={styles.val}>
                      {displayTrade.size} {isFutures ? t('contracts') : t('lots')}
                    </Text>
                  );
                })()}
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>{t('tdEntrySlTp')}</Text>
                <Text style={styles.val}>{displayTrade.entry_price} / {displayTrade.stop_loss} / {displayTrade.take_profit}</Text>
              </View>
              {displayTrade.exit_price && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>{t('tdExitPrice')}</Text>
                  <Text style={styles.val}>{displayTrade.exit_price}</Text>
                </View>
              )}
            </View>

            {/* Stratégie Playbook */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>{t('tdPlaybookStrategy')}</Text>
              <View style={styles.badgeRow}>
                {(() => {
                  const playbookSetups = displayTrade.setup_structures.filter(s => s !== 'BOS');
                  if (playbookSetups.length > 0) {
                    return playbookSetups.map((s, idx) => (
                      <View key={idx} style={styles.strategyPill}>
                        <Text style={styles.strategyText}>{s}</Text>
                      </View>
                    ));
                  }
                  return (
                    <Text style={styles.noStrategyText}>{t('tdNoStrategy')}</Text>
                  );
                })()}
              </View>
            </View>

            {/* Screenshots Avant & Après */}
            {(displayTrade.screenshot_before_url || displayTrade.screenshot_after_url) && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>{t('tdSetupScreenshots')}</Text>
                {displayTrade.screenshot_before_url && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={styles.miniLabel}>{t('tdChartBefore')}</Text>
                    {displayTrade.screenshot_before_url.startsWith('data:') || displayTrade.screenshot_before_url.startsWith('file:') || displayTrade.screenshot_before_url.startsWith('http') ? (
                      <Image source={{ uri: displayTrade.screenshot_before_url }} style={styles.screenshotImg} resizeMode="contain" />
                    ) : null}
                    {displayTrade.screenshot_before_url.startsWith('http') && (
                      <TouchableOpacity onPress={() => Linking.openURL(displayTrade.screenshot_before_url!)} style={styles.linkRow}>
                        <ExternalLink size={12} color={theme.colors.primaryLight} />
                        <Text style={styles.linkText}>{t('tdOpenTradingView')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {displayTrade.screenshot_after_url && (
                  <View>
                    <Text style={styles.miniLabel}>{t('tdChartAfter')}</Text>
                    {displayTrade.screenshot_after_url.startsWith('data:') || displayTrade.screenshot_after_url.startsWith('file:') || displayTrade.screenshot_after_url.startsWith('http') ? (
                      <Image source={{ uri: displayTrade.screenshot_after_url }} style={styles.screenshotImg} resizeMode="contain" />
                    ) : null}
                    {displayTrade.screenshot_after_url.startsWith('http') && (
                      <TouchableOpacity onPress={() => Linking.openURL(displayTrade.screenshot_after_url!)} style={styles.linkRow}>
                        <ExternalLink size={12} color={theme.colors.primaryLight} />
                        <Text style={styles.linkText}>{t('tdOpenTradingView')}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Psychologie, Discipline & Notes */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>{t('tdPsychologyNotes')}</Text>
              <View style={styles.detailRow}>
                <Text style={styles.label}>{t('tdMentalState')}</Text>
                <Text style={[styles.val, { color: theme.colors.goldLight }]}>
                  {mentalStateLabel(t, displayTrade.mental_state)}
                </Text>
              </View>

              {displayTrade.plan_respected !== undefined && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>{t('tdPlanRespected')}</Text>
                  <Text style={[styles.val, { color: displayTrade.plan_respected ? '#10B981' : '#EF4444', fontWeight: '800' }]}>
                    {displayTrade.plan_respected ? t('tdPlanYes') : t('tdPlanNo')}
                  </Text>
                </View>
              )}

              {displayTrade.execution_grade && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>{t('tdExecutionGrade')}</Text>
                  <Text style={[styles.val, { color: theme.colors.primaryLight, fontWeight: '800' }]}>
                    {displayTrade.execution_grade}
                  </Text>
                </View>
              )}

              {displayTrade.mistakes && displayTrade.mistakes.length > 0 && (
                <View style={{ marginTop: 8 }}>
                  <Text style={[styles.label, { marginBottom: 6 }]}>{t('tdMistakesMade')}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {displayTrade.mistakes.map((m, idx) => (
                      <View key={idx} style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#F87171', fontSize: 10, fontFamily: theme.fonts.sansSemiBold }}>
                          {mistakeLabel(t, m)}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {displayTrade.cookie_jar_ref && (
                <Text style={styles.goldText}>{t('tdCookieJar')}</Text>
              )}
              {displayTrade.rule_40_percent && (
                <Text style={styles.goldText}>{t('tdRule40')}</Text>
              )}
              {displayTrade.notes ? (
                <Text style={styles.notesText}>"{displayTrade.notes}"</Text>
              ) : null}
            </View>
          </ScrollView>

          {/* Action Buttons: Modifier / Supprimer */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => {
                onDelete(displayTrade.id);
                onClose();
              }}
            >
              <Trash2 size={16} color={theme.colors.redLight} />
              <Text style={styles.deleteText}>{t('tdDelete')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                onClose();
                onEdit(displayTrade);
              }}
            >
              <Edit3 size={16} color={theme.colors.textPrimary} />
              <Text style={styles.editText}>{t('tdEditTrade')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  content: {
    backgroundColor: theme.colors.modalBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderStrong,
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  titleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pairText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.sansBold,
  },
  closeBtn: {
    padding: 4,
  },
  scroll: {
    marginBottom: theme.spacing.md,
  },
  pnlBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  pnlLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
  },
  pnlValue: {
    fontSize: 20,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  rValue: {
    fontSize: 18,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  sectionBox: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderStrong,
    paddingBottom: 4,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: theme.fonts.monoMedium,
  },
  val: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.sansMedium,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  smcPill: {
    backgroundColor: theme.colors.modalBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  smcText: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
  },
  strategyPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: theme.colors.primary,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  strategyText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
  },
  noStrategyText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },
  miniLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    marginBottom: 4,
  },
  screenshotImg: {
    width: '100%',
    height: 160,
    backgroundColor: '#000000',
    borderRadius: theme.borderRadius.md,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  linkText: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.sansSemiBold,
  },
  notesText: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 6,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.primary,
    paddingLeft: 6,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  deleteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    height: 44,
    borderRadius: theme.borderRadius.md,
  },
  deleteText: {
    color: theme.colors.redLight,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
  },
  editBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    height: 44,
    borderRadius: theme.borderRadius.md,
  },
  editText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
  },
  greenText: { color: theme.colors.greenLight },
  redText: { color: theme.colors.redLight },
  goldText: { color: theme.colors.goldLight, fontSize: 11, fontFamily: theme.fonts.sansSemiBold, marginTop: 4 },
});
