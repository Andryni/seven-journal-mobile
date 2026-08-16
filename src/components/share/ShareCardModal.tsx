import React, { useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { X, Share2, Award, TrendingUp, Target, Shield, Check } from 'lucide-react-native';
import { theme } from '../../theme';
import type { Trade } from '../../types/domain';

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
  const viewShotRef = useRef<ViewShot>(null);

  // Compute metrics
  const closed = trades.filter(t => t.pnl !== null);
  const totalPnL = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const wins = closed.filter(t => (t.pnl || 0) > 0);
  const winRate = closed.length > 0 ? (wins.length / closed.length) * 100 : 0;
  const totalR = closed.reduce((sum, t) => sum + (t.r_multiple || 0), 0);
  const bestTrade = closed.reduce((max, t) => ((t.pnl || 0) > max ? (t.pnl || 0) : max), 0);

  const isPositive = totalPnL >= 0;

  const handleShare = async () => {
    try {
      if (viewShotRef.current?.capture) {
        const uri = await viewShotRef.current.capture();
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Partager ma performance Seven Tracking',
          });
        }
      }
    } catch (err) {
      console.error('Erreur lors du partage :', err);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={styles.titleRow}>
              <Award color={theme.colors.goldLight} size={18} />
              <Text style={styles.modalTitle}>PARTAGER MA PERFORMANCE</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#ffffff" size={18} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
            {/* The ViewShot Card that gets captured */}
            <ViewShot
              ref={viewShotRef}
              options={{ format: 'png', quality: 0.95 }}
              style={styles.cardFrame}
            >
              {/* Brand Header */}
              <View style={styles.brandHeader}>
                <View style={styles.logoBadge}>
                  <Text style={styles.logoText}>SEVEN TRACKING</Text>
                  <View style={styles.dot} />
                  <Text style={styles.subLogo}>FINTECH TERMINAL</Text>
                </View>
                <Text style={styles.dateLabel}>
                  {new Date().toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              {/* Account Label */}
              <Text style={styles.accountLabel}>{accountName.toUpperCase()}</Text>

              {/* Main P&L Showcase */}
              <View style={styles.pnlShowcase}>
                <Text style={styles.pnlTitle}>NET P&L RÉALISÉ</Text>
                <Text style={[styles.pnlAmount, isPositive ? styles.greenText : styles.redText]}>
                  {isPositive ? '+' : ''}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
              </View>

              {/* Key Metrics Grid */}
              <View style={styles.metricsGrid}>
                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>WIN RATE</Text>
                  <Text style={[styles.metricValue, winRate >= 50 ? styles.greenText : styles.redText]}>
                    {winRate.toFixed(0)}%
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>POSITIONS</Text>
                  <Text style={styles.metricValue}>{closed.length}</Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>CUMUL R</Text>
                  <Text style={[styles.metricValue, totalR >= 0 ? styles.cyanText : styles.redText]}>
                    {totalR >= 0 ? '+' : ''}{totalR.toFixed(1)}R
                  </Text>
                </View>

                <View style={styles.metricItem}>
                  <Text style={styles.metricLabel}>MEILLEUR TRADE</Text>
                  <Text style={[styles.metricValue, styles.greenText]}>
                    +${bestTrade.toFixed(0)}
                  </Text>
                </View>
              </View>

              {/* Bottom Verification Footer */}
              <View style={styles.cardFooter}>
                <View style={styles.verifiedBadge}>
                  <Check size={10} color="#10b981" />
                  <Text style={styles.verifiedText}>VERIFIED BY SEVEN JOURNAL</Text>
                </View>
                <Text style={styles.watermark}>seventracking.app</Text>
              </View>
            </ViewShot>

            {/* Action Share Button */}
            <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
              <Share2 size={16} color="#ffffff" />
              <Text style={styles.shareBtnText}>EXPORTER ET PARTAGER L'IMAGE</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
    backgroundColor: '#0d0f15',
    borderColor: 'rgba(99, 102, 241, 0.3)',
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
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollBody: {
    alignItems: 'center',
    paddingBottom: 10,
  },
  cardFrame: {
    width: '100%',
    backgroundColor: '#12141d',
    borderColor: '#1e2235',
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
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
    color: '#818cf8',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.goldLight,
  },
  subLogo: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  dateLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
  },
  accountLabel: {
    color: theme.colors.goldLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 12,
  },
  pnlShowcase: {
    backgroundColor: '#0a0c12',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  pnlTitle: {
    color: '#64748b',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  pnlAmount: {
    fontSize: 28,
    fontWeight: '900',
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
    backgroundColor: '#0a0c12',
    borderColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  metricValue: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
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
    color: '#10b981',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  watermark: {
    color: '#475569',
    fontSize: 9,
    fontWeight: '700',
  },
  shareBtn: {
    marginTop: 16,
    width: '100%',
    height: 48,
    backgroundColor: '#6366f1',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  greenText: { color: '#10b981' },
  redText: { color: '#ef4444' },
  cyanText: { color: '#06b6d4' },
});
