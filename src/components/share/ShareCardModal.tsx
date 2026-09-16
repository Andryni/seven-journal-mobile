import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { X, Share2, Download, Check, TrendingUp } from 'lucide-react-native';
import { withAlpha } from '../../theme';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { localeFor, useT } from '../../i18n';
import type { TranslationKey } from '../../i18n/translations';
import type { Trade } from '../../types/domain';
import { useMoney } from '../../features/accounts/useMoney';
import { PressableScale } from '../ui/PressableScale';
import { Sparkline } from '../ui/Sparkline';
import { useShareCard } from '../../features/share/useShareCard';
import {
  selectTrades,
  computeShareStats,
  periodLabel,
  type SharePeriod,
} from '../../utils/shareScope';

interface ShareCardModalProps {
  visible: boolean;
  onClose: () => void;
  accountName?: string;
  trades: Trade[];
  /**
   * When opened from a single trade, that trade becomes the default subject
   * and the "this trade" option is offered.
   */
  trade?: Trade | null;
}

const PERIODS: { id: SharePeriod; labelKey: TranslationKey }[] = [
  { id: 'trade', labelKey: 'shareScopeTrade' },
  { id: 'day', labelKey: 'shareScopeDay' },
  { id: 'week', labelKey: 'shareScopeWeek' },
  { id: 'month', labelKey: 'shareScopeMonth' },
  { id: 'all', labelKey: 'shareScopeAll' },
];

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  visible,
  onClose,
  accountName = 'Seven Journal',
  trades,
  trade = null,
}) => {
  const { theme } = useTheme();
  const money = useMoney();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { cardRef, busy, savedAt, share, saveToGallery } = useShareCard();

  // A card opened from one trade defaults to that trade; otherwise to the day.
  const [period, setPeriod] = useState<SharePeriod>(trade ? 'trade' : 'day');

  const options = useMemo(
    () => (trade ? PERIODS : PERIODS.filter(p => p.id !== 'trade')),
    [trade]
  );

  const scoped = useMemo(
    () => selectTrades(trades, period, { tradeId: trade?.id ?? null }),
    [trades, period, trade]
  );

  const stats = useMemo(() => computeShareStats(scoped), [scoped]);

  const subtitle = useMemo(
    () => periodLabel(period, localeFor(lang), new Date(), trade),
    [period, lang, trade]
  );

  const isPositive = stats.netPnl >= 0;
  const accent = isPositive ? theme.colors.green : theme.colors.red;
  const isEmpty = stats.trades.length === 0;
  const single = period === 'trade' && stats.trades.length === 1 ? stats.trades[0] : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('scSharePerformance')}</Text>
            <PressableScale onPress={onClose} hitSlop={12} accessibilityLabel={t('cancel')}>
              <X color={theme.colors.textSecondary} size={18} />
            </PressableScale>
          </View>

          {/* Scope selector — what the card covers. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scopeRow}
          >
            {options.map(opt => {
              const active = period === opt.id;
              return (
                <PressableScale
                  key={opt.id}
                  onPress={() => setPeriod(opt.id)}
                  style={[styles.scopeChip, active && styles.scopeChipActive]}
                  accessibilityRole="button"
                  accessibilityLabel={t(opt.labelKey)}
                >
                  <Text style={[styles.scopeText, active && styles.scopeTextActive]}>
                    {t(opt.labelKey)}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
            {/* ── The card itself. Everything inside this View is captured. ── */}
            <View ref={cardRef} collapsable={false} style={styles.card}>
              <View style={[styles.cardGlow, { backgroundColor: accent }]} />

              <View style={styles.cardHead}>
                <View style={styles.brandRow}>
                  <Image
                    source={require('../../assets/seven_tracking_logo.png')}
                    style={styles.brandMark}
                    resizeMode="contain"
                  />
                  <View>
                    <Text style={styles.brandName}>SEVEN JOURNAL</Text>
                    <Text style={styles.brandAccount} numberOfLines={1}>
                      {accountName.toUpperCase()}
                    </Text>
                  </View>
                </View>
                {subtitle ? <Text style={styles.cardDate}>{subtitle}</Text> : null}
              </View>

              {isEmpty ? (
                <View style={styles.emptyBlock}>
                  <Text style={styles.emptyText}>{t('shareNoTrades')}</Text>
                </View>
              ) : (
                <>
                  <View style={styles.pnlBlock}>
                    <Text style={styles.pnlLabel}>
                      {single ? single.pair : t('scNetPnl')}
                    </Text>
                    <Text
                      style={[styles.pnlValue, { color: accent }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.5}
                    >
                      {money(stats.netPnl, { thousandsSeparator: true })}
                    </Text>
                    {stats.equity.length > 1 ? (
                      <Sparkline
                        data={stats.equity}
                        baseline={0}
                        width={220}
                        height={44}
                        strokeWidth={2}
                      />
                    ) : null}
                  </View>

                  {/* A single trade and a period tell different stories, so
                      they get different figures rather than one generic grid
                      padded with blanks. */}
                  <View style={styles.statGrid}>
                    {single ? (
                      <>
                        <Stat
                          styles={styles}
                          label={t('scSide')}
                          value={single.direction}
                          color={theme.colors.textPrimary}
                        />
                        <Stat
                          styles={styles}
                          label="R"
                          value={`${(single.r_multiple ?? 0) >= 0 ? '+' : ''}${(
                            single.r_multiple ?? 0
                          ).toFixed(2)}`}
                          color={(single.r_multiple ?? 0) >= 0 ? theme.colors.green : theme.colors.red}
                        />
                        <Stat
                          styles={styles}
                          label={t('scTimeframe')}
                          value={single.timeframe || '—'}
                          color={theme.colors.textPrimary}
                        />
                      </>
                    ) : (
                      <>
                        <Stat
                          styles={styles}
                          label={t('scWinRate')}
                          value={`${stats.winRate.toFixed(0)}%`}
                          color={stats.winRate >= 50 ? theme.colors.green : theme.colors.red}
                        />
                        <Stat
                          styles={styles}
                          label={t('scPositions')}
                          value={String(stats.trades.length)}
                          color={theme.colors.textPrimary}
                        />
                        <Stat
                          styles={styles}
                          label={t('scCumulR')}
                          value={`${stats.totalR >= 0 ? '+' : ''}${stats.totalR.toFixed(1)}R`}
                          color={stats.totalR >= 0 ? theme.colors.cyan : theme.colors.red}
                        />
                      </>
                    )}
                  </View>

                  {!single && stats.bestStreak > 1 ? (
                    <View style={styles.streakRow}>
                      <TrendingUp size={11} color={theme.colors.green} strokeWidth={2} />
                      <Text style={styles.streakText}>
                        {t('shareStreak').replace('{n}', String(stats.bestStreak))}
                      </Text>
                    </View>
                  ) : null}
                </>
              )}

              <View style={styles.cardFoot}>
                <View style={styles.verified}>
                  <Check size={9} color={theme.colors.green} strokeWidth={2.5} />
                  <Text style={styles.verifiedText}>{t('scVerified')}</Text>
                </View>
                <Text style={styles.watermark}>seventracking.app</Text>
              </View>
            </View>

            {/* ── Actions ── */}
            <View style={styles.actions}>
              <PressableScale
                style={[styles.action, styles.actionGhost, isEmpty && styles.actionDisabled]}
                onPress={() => !isEmpty && saveToGallery(period)}
                disabled={isEmpty || busy !== null}
                accessibilityRole="button"
                accessibilityLabel={t('shareSaveImage')}
              >
                {busy === 'saving' ? (
                  <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                ) : savedAt ? (
                  <Check size={15} color={theme.colors.green} strokeWidth={2.5} />
                ) : (
                  <Download size={15} color={theme.colors.textSecondary} strokeWidth={1.9} />
                )}
                <Text style={styles.actionGhostText}>
                  {savedAt ? t('shareSaved') : t('shareSaveImage')}
                </Text>
              </PressableScale>

              <PressableScale
                style={[styles.action, styles.actionPrimary, isEmpty && styles.actionDisabled]}
                onPress={() => !isEmpty && share(period)}
                disabled={isEmpty || busy !== null}
                accessibilityRole="button"
                accessibilityLabel={t('scExportShare')}
              >
                {busy === 'sharing' ? (
                  <ActivityIndicator size="small" color={theme.colors.background} />
                ) : (
                  <Share2 size={15} color={theme.colors.background} strokeWidth={2} />
                )}
                <Text style={styles.actionPrimaryText}>{t('scExportShare')}</Text>
              </PressableScale>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const Stat: React.FC<{
  styles: ReturnType<typeof createStyles>;
  label: string;
  value: string;
  color: string;
}> = ({ styles, label, value, color }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
  </View>
);

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: withAlpha(theme.colors.scrim, 0.86),
      justifyContent: 'center',
      padding: 16,
    },
    sheet: {
      backgroundColor: theme.colors.backgroundElevated,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: 18,
      maxHeight: '92%',
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 15,
      paddingBottom: 11,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },

    scopeRow: { paddingHorizontal: 14, paddingBottom: 12, gap: 7 },
    scopeChip: {
      paddingHorizontal: 13,
      paddingVertical: 7,
      borderRadius: 7,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    scopeChipActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '1A',
    },
    scopeText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    scopeTextActive: { color: theme.colors.primary },

    body: { paddingHorizontal: 14, paddingBottom: 16 },

    // ── The exported card ──
    card: {
      backgroundColor: theme.colors.background,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      padding: 18,
      overflow: 'hidden',
    },
    cardGlow: {
      position: 'absolute',
      top: -70,
      right: -50,
      width: 180,
      height: 180,
      borderRadius: 90,
      opacity: 0.1,
    },
    cardHead: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
    brandMark: { width: 22, height: 22 },
    brandName: {
      color: theme.colors.textPrimary,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.1,
    },
    brandAccount: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.6,
      marginTop: 2,
    },
    cardDate: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.6,
    },

    pnlBlock: { alignItems: 'center', marginBottom: 20 },
    pnlLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginBottom: 6,
    },
    pnlValue: {
      fontSize: 42,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: -1,
      marginBottom: 6,
    },

    statGrid: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
      paddingTop: 14,
    },
    stat: { flex: 1, alignItems: 'center' },
    statLabel: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.7,
      marginBottom: 4,
    },
    statValue: { fontSize: 15, fontFamily: theme.fonts.monoBold },

    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      marginTop: 13,
    },
    streakText: {
      color: theme.colors.green,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },

    emptyBlock: { paddingVertical: 34, alignItems: 'center' },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.mono,
      textAlign: 'center',
    },

    cardFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
    },
    verified: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    verifiedText: {
      color: theme.colors.green,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    watermark: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      letterSpacing: 0.6,
    },

    actions: { flexDirection: 'row', gap: 9, marginTop: 14 },
    action: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 13,
      borderRadius: 10,
    },
    actionGhost: {
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    actionGhostText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    actionPrimary: { backgroundColor: theme.colors.primary },
    actionPrimaryText: {
      color: theme.colors.background,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    actionDisabled: { opacity: 0.4 },
  });
