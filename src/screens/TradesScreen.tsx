import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Badge } from '../components/ui/Badge';
import { Plus } from 'lucide-react-native';

export const TradesScreen: React.FC = () => {
  const { trades, isLoading } = useTrades();

  const renderTradeItem = ({ item }: { item: Trade }) => {
    const isWin = (item.pnl || 0) > 0;
    const isLoss = (item.pnl || 0) < 0;

    return (
      <View style={styles.tradeCard}>
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
      </View>
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
        <Text style={styles.screenTitle}>JOURNAL DES TRADES</Text>
        <Text style={styles.screenSubtitle}>{trades.length} POSITIONS ENREGISTRÉES</Text>
      </View>

      <FlatList
        data={trades}
        keyExtractor={(item) => item.id}
        renderItem={renderTradeItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
