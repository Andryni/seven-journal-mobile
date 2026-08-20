import React, { useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { X, Share2, Award, Check } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { localeFor, useT } from '../../i18n';
import type { Trade } from '../../types/domain';
import { formatCurrency } from '../../utils/formatCurrency';

interface ShareCardModalProps {
  visible: boolean;
  onClose: () => void;
  accountName?: string;
  trades: Trade[];
}

export const ShareCardModal: React.FC<ShareCardModalProps> = ({
  visible,
  onClose,
  accountName = 'Compte Principal',
  trades,
}) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const closed = trades.filter((t) => t.pnl !== null);
  const totalPnL = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = closed.filter((t) => (t.pnl || 0) > 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const totalR = closed.reduce((sum, t) => sum + (t.r_multiple || 0), 0);
  const bestTrade = closed.reduce((max, t) => ((t.pnl || 0) > max ? (t.pnl || 0) : max), 0);
  const isPositive = totalPnL >= 0;

  const handleShare = async () => {
    try {
      const text = [
        '📊 Seven Journal — Performance',
        '━━━━━━━━━━━━━━━━━━',
        `💰 Net P&L: ${formatCurrency(totalPnL, { thousandsSeparator: true })}`,
        `🎯 Win Rate: ${winRate.toFixed(1)}%`,
        `📈 Positions: ${closed.length}`,
        `⚡ Cumul R: ${totalR >= 0 ? '+' : ''}${totalR.toFixed(1)}R`,
        `🏆 Best Trade: ${formatCurrency(bestTrade, { decimals: 0 })}`,
        '━━━━━━━━━━━━━━━━━━',
        '✅ Verified by Seven Journal',
      ].join('\n');

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(text);
      }
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <View style={styles.titleRow}>
              <Award color={theme.colors.goldLight} size={18} />
              <Text style={styles.modalTitle}>{t('scSharePerformance')}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color={theme.colors.textPrimary} size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            <View style={styles.cardFrame}>
              <View style={styles.brandHeader}>
                <View style={styles.logoBadge}>
                  <Text style={styles.logoText}>SEVEN JOURNAL</Text>
                  <View style={styles.dot} />
                  <Text style={styles.subLogo}>FINTECH TERMINAL</Text>
                </View>
                <Text style={styles.dateLabel}>
                  {new Date().toLocaleDateString(localeFor(lang), {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              <Text style={styles.accountLabel}>{accountName.toUpperCase()}</Text>

              <View style={styles.pnlShowcase}>
                <Text style={styles.pnlTitle}>{t('scNetPnl')}</Text>
                <Text style={[styles.pnlAmount, isPositive ? styles.greenText : styles.redText]}>
                  {formatCurrency(totalPnL, { thousandsSeparator: true })}
                </Text>
              </View>

              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('scWinRate')}</Text>
                  <Text style={[styles.metricValue, winRate >= 50 ? styles.greenText : styles.redText]}>
                    {winRate.toFixed(0)}%
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('scPositions')}</Text>
                  <Text style={styles.metricValue}>{closed.length}</Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('scCumulR')}</Text>
                  <Text style={[styles.metricValue, totalR >= 0 ? styles.cyanText : styles.redText]}>
                    {totalR >= 0 ? '+' : ''}{totalR.toFixed(1)}R
                  </Text>
                </View>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>{t('scBestTrade')}</Text>
                  <Text style={[styles.metricValue, styles.greenText]}>
                    {formatCurrency(bestTrade, { decimals: 0 })}
                  </Text>
                </View>
              </View>

              <View style={styles.cardFooter}>
                <View style={styles.verifiedBadge}>
                  <Check size={10} color={theme.colors.green} />
                  <Text style={styles.verifiedText}>{t('scVerified')}</Text>
                </View>
                <Text style={styles.watermark}>seventracking.app</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Share2 size={16} color={theme.colors.textPrimary} />
              <Text style={styles.shareBtnText}>{t('scExportShare')}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 16,
    },
    modalContent: {
      width: '100%',
      maxHeight: '90%',
      backgroundColor: theme.colors.backgroundElevated,
      borderColor: theme.colors.cardBorderGlow,
      borderWidth: 1,
      borderRadius: 20,
      padding: 16,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.cardBorder,
      paddingBottom: 10,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    modalTitle: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontFamily: theme.fonts.sansBold,
      letterSpacing: 1,
    },
    closeBtn: {
      padding: 4,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
    },
    scrollBody: {
      alignItems: 'center',
      paddingBottom: 10,
    },
    cardFrame: {
      width: '100%',
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
      borderRadius: 16,
      padding: 20,
    },
    brandHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    logoBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    logoText: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 1.2,
    },
    dot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.colors.goldLight,
    },
    subLogo: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoMedium,
      letterSpacing: 0.8,
    },
    dateLabel: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    accountLabel: {
      color: theme.colors.goldLight,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginBottom: 12,
    },
    pnlShowcase: {
      backgroundColor: theme.colors.inputBg,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginBottom: 16,
    },
    pnlTitle: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginBottom: 4,
    },
    pnlAmount: {
      fontSize: 28,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -0.5,
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 16,
    },
    metricItem: {
      width: '48%',
      backgroundColor: theme.colors.inputBg,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: 10,
      padding: 10,
      alignItems: 'center',
    },
    metricLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    metricValue: {
      color: theme.colors.textPrimary,
      fontSize: 15,
      fontFamily: theme.fonts.monoExtraBold,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.colors.cardBorder,
      paddingTop: 12,
    },
    verifiedBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 6,
    },
    verifiedText: {
      color: theme.colors.green,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    watermark: {
      color: theme.colors.textDark,
      fontSize: 9,
      fontFamily: theme.fonts.monoMedium,
    },
    shareBtn: {
      marginTop: 16,
      width: '100%',
      height: 48,
      backgroundColor: theme.colors.primary,
      borderRadius: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    shareBtnText: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    greenText: { color: theme.colors.green },
    redText: { color: theme.colors.red },
    cyanText: { color: theme.colors.cyan },
  });
