import React, { useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Badge } from '../components/ui/Badge';
import { TradeFormModal } from '../components/trades/TradeFormModal';
import { TradeDetailModal } from '../components/trades/TradeDetailModal';
import { Plus } from 'lucide-react-native';

export const TradesScreen: React.FC = () => {
  const { trades, deleteTrade, isLoading } = useTrades();
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const handleAddTrade = () => {
    setSelectedTrade(null);
    setFormModalVisible(true);
  };

  const handleViewTrade = (t: Trade) => {
    setSelectedTrade(t);
    setDetailModalVisible(true);
  };

  const handleEditTrade = (t: Trade) => {
    setSelectedTrade(t);
    setFormModalVisible(true);
  };

  const handleDeleteTrade = async (id: string) => {
    await deleteTrade(id);
  };

  const renderTradeItem = ({ item }: { item: Trade }) => {
    const isWin = (item.pnl || 0) > 0;
    const isLoss = (item.pnl || 0) < 0;

    return (
      <TouchableOpacity
        style={styles.tradeCard}
        onPress={() => handleViewTrade(item)}
        activeOpacity={0.8}
      >
        <View style={styles.tradeHeader}>
          <View style={styles.pairInfo}>
            <Text style={styles.pairText}>{item.pair}</Text>
            <Badge
              label={item.direction}
              variant={item.direction === 'BUY' ? 'blue' : 'gold'}
            />
          </View>
          <Text
            style={[
              styles.pnlText,
              isWin && styles.winPnl,
              isLoss && styles.lossPnl,
            ]}
          >
            {item.pnl !== null ? `${item.pnl >= 0 ? '+' : ''}$${item.pnl.toFixed(2)}` : 'OPEN'}
          </Text>
        </View>

        <View style={styles.tradeFooter}>
          <Text style={styles.dateText}>
            {new Date(item.entry_time).toLocaleDateString('fr-FR')} {new Date(item.entry_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </Text>
          <View style={styles.badgeRow}>
            {item.r_multiple !== null ? (
              <Badge label={`${item.r_multiple > 0 ? '+' : ''}${item.r_multiple}R`} variant="gold" />
            ) : null}
            <Badge label={item.result} variant={item.result === 'TP' ? 'green' : item.result === 'SL' ? 'red' : 'neutral'} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>JOURNAL DES TRADES</Text>
          <Text style={styles.screenSubtitle}>{trades.length} POSITIONS ENREGISTRÉES</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddTrade}>
          <Plus color="#ffffff" size={16} />
          <Text style={styles.addBtnText}>AJOUTER</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={trades}
        keyExtractor={(item) => item.id}
        renderItem={renderTradeItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <TradeDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        trade={selectedTrade}
        onEdit={handleEditTrade}
        onDelete={handleDeleteTrade}
      />

      <TradeFormModal
        visible={formModalVisible}
        onClose={() => setFormModalVisible(false)}
        editingTrade={selectedTrade}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  screenTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 8,
    borderRadius: theme.borderRadius.md,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  tradeCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  pairInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  pairText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginRight: theme.spacing.sm,
  },
  pnlText: {
    color: theme.colors.textSecondary,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    marginLeft: 'auto',
  },
  winPnl: {
    color: theme.colors.greenLight,
  },
  lossPnl: {
    color: theme.colors.redLight,
  },
  tradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.spacing.xs,
  },
  dateText: {
    color: theme.colors.textMuted,
    fontSize: 11,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
});
