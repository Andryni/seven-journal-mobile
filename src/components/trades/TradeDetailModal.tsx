import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Linking,
} from 'react-native';
import { theme } from '../../theme';
import type { Trade } from '../../types/domain';
import { Badge } from '../ui/Badge';
import { X, Edit3, Trash2, ExternalLink, Activity, Brain, Clock, Shield } from 'lucide-react-native';

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
  if (!trade) return null;

  const isWin = (trade.pnl || 0) > 0;
  const isLoss = (trade.pnl || 0) < 0;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleInfo}>
              <Text style={styles.pairText}>{trade.pair}</Text>
              <Badge label={trade.direction} variant={trade.direction === 'BUY' ? 'blue' : 'gold'} />
              <Badge label={trade.result} variant={trade.result === 'TP' ? 'green' : trade.result === 'SL' ? 'red' : 'neutral'} />
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X color="#ffffff" size={20} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* P&L & R-Multiple Highlight */}
            <View style={styles.pnlBanner}>
              <View>
                <Text style={styles.pnlLabel}>P&L NET RÉALISÉ</Text>
                <Text style={[styles.pnlValue, isWin ? styles.greenText : isLoss ? styles.redText : null]}>
                  {trade.pnl !== null ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : 'OPEN'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.pnlLabel}>R-MULTIPLE</Text>
                <Text style={[styles.rValue, (trade.r_multiple || 0) >= 0 ? styles.greenText : styles.redText]}>
                  {trade.r_multiple !== null ? `${trade.r_multiple >= 0 ? '+' : ''}${trade.r_multiple} R` : '—'}
                </Text>
              </View>
            </View>

            {/* Détails Exécution */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>PARAMÈTRES D'EXÉCUTION</Text>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Date d'Entrée :</Text>
                <Text style={styles.val}>{new Date(trade.entry_time).toLocaleString('fr-FR')}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Timeframe :</Text>
                <Text style={styles.val}>{trade.timeframe}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Session :</Text>
                <Text style={styles.val}>{trade.session || '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Volume :</Text>
                <Text style={styles.val}>{trade.size} Lots</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.label}>Entrée / SL / TP :</Text>
                <Text style={styles.val}>{trade.entry_price} / {trade.stop_loss} / {trade.take_profit}</Text>
              </View>
              {trade.exit_price && (
                <View style={styles.detailRow}>
                  <Text style={styles.label}>Prix de Sortie :</Text>
                  <Text style={styles.val}>{trade.exit_price}</Text>
                </View>
              )}
            </View>

            {/* Stratégie Playbook */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>STRATÉGIE DU PLAYBOOK</Text>
              <View style={styles.badgeRow}>
                {(() => {
                  const playbookSetups = trade.setup_structures.filter(s => s !== 'BOS');
                  if (playbookSetups.length > 0) {
                    return playbookSetups.map((s, idx) => (
                      <View key={idx} style={styles.strategyPill}>
                        <Text style={styles.strategyText}>🎯 {s}</Text>
                      </View>
                    ));
                  }
                  return (
                    <Text style={styles.noStrategyText}>
                      Aucune stratégie spécifique associée
                    </Text>
                  );
                })()}
              </View>
            </View>

            {/* Screenshots Avant & Après */}
            {(trade.screenshot_before_url || trade.screenshot_after_url) && (
              <View style={styles.sectionBox}>
                <Text style={styles.sectionTitle}>SCREENSHOTS DU SETUP</Text>
                {trade.screenshot_before_url && (
                  <View style={{ marginBottom: 10 }}>
                    <Text style={styles.miniLabel}>Graphique Avant :</Text>
                    {trade.screenshot_before_url.startsWith('data:') || trade.screenshot_before_url.startsWith('file:') || trade.screenshot_before_url.startsWith('http') ? (
                      <Image source={{ uri: trade.screenshot_before_url }} style={styles.screenshotImg} resizeMode="contain" />
                    ) : null}
                    {trade.screenshot_before_url.startsWith('http') && (
                      <TouchableOpacity onPress={() => Linking.openURL(trade.screenshot_before_url!)} style={styles.linkRow}>
                        <ExternalLink size={12} color={theme.colors.primaryLight} />
                        <Text style={styles.linkText}>Ouvrir sur TradingView</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {trade.screenshot_after_url && (
                  <View>
                    <Text style={styles.miniLabel}>Graphique Après :</Text>
                    {trade.screenshot_after_url.startsWith('data:') || trade.screenshot_after_url.startsWith('file:') || trade.screenshot_after_url.startsWith('http') ? (
                      <Image source={{ uri: trade.screenshot_after_url }} style={styles.screenshotImg} resizeMode="contain" />
                    ) : null}
                    {trade.screenshot_after_url.startsWith('http') && (
                      <TouchableOpacity onPress={() => Linking.openURL(trade.screenshot_after_url!)} style={styles.linkRow}>
                        <ExternalLink size={12} color={theme.colors.primaryLight} />
                        <Text style={styles.linkText}>Ouvrir sur TradingView</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* Psychologie & Notes */}
            <View style={styles.sectionBox}>
              <Text style={styles.sectionTitle}>PSYCHOLOGIE & NOTES</Text>
              <View style={styles.detailRow}>
                <Text style={styles.label}>État Mental :</Text>
                <Text style={[styles.val, { textTransform: 'uppercase', color: theme.colors.goldLight }]}>
                  {trade.mental_state}
                </Text>
              </View>
              {trade.cookie_jar_ref && (
                <Text style={styles.goldText}>✓ Cookie Jar (Goggins) Appliqué</Text>
              )}
              {trade.rule_40_percent && (
                <Text style={styles.goldText}>✓ 40% Rule Appliquée</Text>
              )}
              {trade.notes ? (
                <Text style={styles.notesText}>"{trade.notes}"</Text>
              ) : null}
            </View>
          </ScrollView>

          {/* Action Buttons: Modifier / Supprimer */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => {
                onDelete(trade.id);
                onClose();
              }}
            >
              <Trash2 size={16} color={theme.colors.redLight} />
              <Text style={styles.deleteText}>SUPPRIMER</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => {
                onClose();
                onEdit(trade);
              }}
            >
              <Edit3 size={16} color="#ffffff" />
              <Text style={styles.editText}>MODIFIER LE TRADE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  content: {
    backgroundColor: '#181920',
    borderColor: '#262833',
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
    borderBottomColor: '#262833',
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  titleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pairText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '900',
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
    backgroundColor: '#121318',
    borderColor: '#262833',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  pnlLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  pnlValue: {
    fontSize: 20,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  rValue: {
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  sectionBox: {
    backgroundColor: '#121318',
    borderColor: '#262833',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
    borderBottomWidth: 1,
    borderBottomColor: '#262833',
    paddingBottom: 4,
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  val: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  smcPill: {
    backgroundColor: '#181920',
    borderColor: '#262833',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  smcText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  strategyPill: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: '#6366f1',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  strategyText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  noStrategyText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontStyle: 'italic',
  },
  miniLabel: {
    color: theme.colors.textSecondary,
    fontSize: 10,
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
    fontWeight: '700',
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
    fontWeight: '900',
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
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
  },
  greenText: { color: theme.colors.greenLight },
  redText: { color: theme.colors.redLight },
  goldText: { color: theme.colors.goldLight, fontSize: 11, fontWeight: '700', marginTop: 4 },
});
