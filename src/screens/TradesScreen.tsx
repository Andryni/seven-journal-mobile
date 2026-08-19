import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { formatCurrency } from '../utils/formatCurrency';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { localeFor, useT } from '../i18n';
import { Badge } from '../components/ui/Badge';
import { TradeFormModal } from '../components/trades/TradeFormModal';
import { TradeDetailModal } from '../components/trades/TradeDetailModal';
import { Plus, Search, ArrowUpRight, ArrowDownRight, TrendingUp } from 'lucide-react-native';

type FilterType = 'ALL' | 'WIN' | 'LOSS' | 'OPEN';

export const TradesScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { trades, deleteTrade, isLoading } = useTrades();
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['trades'] });
    setRefreshing(false);
  };

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

  const handleDeleteTrade = (id: string) => {
    Alert.alert(
      t('confirmTitle'),
      t('confirmDeleteTrade'),
      [
        { text: t('confirmNo'), style: 'cancel' },
        { text: t('confirmYes'), style: 'destructive', onPress: async () => { await deleteTrade(id); } },
      ],
    );
  };

  // Filtered & Searched Trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t: Trade) => {
      // Search filter
      const matchesSearch =
        searchQuery.trim() === '' ||
        t.pair.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.notes || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Status filter
      if (activeFilter === 'WIN') return (t.pnl || 0) > 0;
      if (activeFilter === 'LOSS') return (t.pnl || 0) < 0;
      if (activeFilter === 'OPEN') return t.pnl === null;
      return true;
    });
  }, [trades, searchQuery, activeFilter]);

  // Quick stats computed on filtered list
  const stats = useMemo(() => {
    const closed = filteredTrades.filter(t => t.pnl !== null);
    const wins = closed.filter(t => (t.pnl || 0) > 0).length;
    const wr = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    const totalPnl = closed.reduce((acc, t) => acc + (t.pnl || 0), 0);
    return { count: filteredTrades.length, wr, totalPnl };
  }, [filteredTrades]);

  const renderTradeItem = ({ item }: { item: Trade }) => {
    const isWin = (item.pnl || 0) > 0;
    const isLoss = (item.pnl || 0) < 0;
    const isOpen = item.pnl === null;

    return (
      <TouchableOpacity
        style={styles.tradeCard}
        onPress={() => handleViewTrade(item)}
        activeOpacity={0.85}
      >
        {/* Glowing Left Indicator Strip */}
        <View
          style={[
            styles.stripIndicator,
            isWin && styles.stripWin,
            isLoss && styles.stripLoss,
            isOpen && styles.stripOpen,
          ]}
        />

        <View style={styles.cardContent}>
          {/* Top Row: Symbol, Direction, PnL */}
          <View style={styles.tradeHeader}>
            <View style={styles.pairInfo}>
              <Text style={styles.pairText}>{item.pair}</Text>
              <Badge
                label={item.direction}
                variant={item.direction === 'BUY' ? 'green' : 'blue'}
                size="sm"
              />
              <Text style={styles.lotText}>{item.size || 1} {t('lots')}</Text>
            </View>

            <View style={styles.pnlWrap}>
              <Text
                style={[
                  styles.pnlText,
                  isWin && styles.winPnl,
                  isLoss && styles.lossPnl,
                  isOpen && styles.openPnl,
                ]}
              >
                {!isOpen ? formatCurrency(item.pnl!) : t('openTradeStatus')}
              </Text>
              {isWin ? (
                <ArrowUpRight size={14} color={theme.colors.greenLight} />
              ) : isLoss ? (
                <ArrowDownRight size={14} color={theme.colors.redLight} />
              ) : null}
            </View>
          </View>

          {/* Middle Row: Setup & Timeframe */}
          <View style={styles.middleRow}>
            <Text style={styles.setupText} numberOfLines={1}>
              {item.setup_structures && item.setup_structures.length > 0
                ? item.setup_structures.join(' · ')
                : item.timeframe
                ? `TF : ${item.timeframe}`
                : t('setupStandard')}
            </Text>
            {item.r_multiple !== null && (
              <Badge
                label={`${item.r_multiple >= 0 ? '+' : ''}${item.r_multiple.toFixed(1)}R`}
                variant={item.r_multiple > 0 ? 'gold' : 'neutral'}
                size="sm"
              />
            )}
          </View>

          {/* Footer: Date & Result */}
          <View style={styles.tradeFooter}>
            <Text style={styles.dateText}>
              {new Date(item.entry_time).toLocaleDateString(localeFor(lang))} · {new Date(item.entry_time).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' })}
            </Text>
            <Badge
              label={item.result || (isOpen ? 'OPEN' : 'CLOSED')}
              variant={item.result === 'TP' ? 'green' : item.result === 'SL' ? 'red' : 'neutral'}
              size="sm"
            />
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
      {/* ── 1. SCREEN HEADER ── */}
      <View style={styles.screenHeader}>
        <View>
          <Text style={styles.screenTitle}>{t('screenTitleTrades')}</Text>
          <Text style={styles.screenSubtitle}>{t('screenSubtitleTrades')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleAddTrade} activeOpacity={0.8}>
          <LinearGradient
            colors={[theme.colors.primary, theme.colors.primaryDeep]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.addBtnGrad}
          >
            <Plus color={theme.colors.textPrimary} size={16} />
            <Text style={styles.addBtnText}>{t('newTradeBtn')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── 2. QUICK STATS SUMMARY STRIP ── */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('tradesCount')}</Text>
          <Text style={styles.summaryVal}>{stats.count}</Text>
        </View>
        <View style={styles.dividerV} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('winRate')}</Text>
          <Text style={[styles.summaryVal, stats.wr >= 50 ? styles.greenText : styles.redText]}>
            {stats.wr.toFixed(1)}%
          </Text>
        </View>
        <View style={styles.dividerV} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>{t('netPnl')}</Text>
          <Text style={[styles.summaryVal, stats.totalPnl >= 0 ? styles.greenText : styles.redText]}>
            {formatCurrency(stats.totalPnl)}
          </Text>
        </View>
      </View>

      {/* ── 3. SEARCH & PILL FILTERS ── */}
      <View style={styles.searchBarWrap}>
        <Search size={14} color={theme.colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View style={styles.filterRow}>
        {(['ALL', 'WIN', 'LOSS', 'OPEN'] as FilterType[]).map(f => {
          const isActive = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {f === 'ALL' ? t('filterAll') : f === 'WIN' ? t('filterWin') : f === 'LOSS' ? t('filterLoss') : t('filterOpen')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── 4. TRADES LIST ── */}
      <FlatList
        data={filteredTrades}
        keyExtractor={item => item.id}
        renderItem={renderTradeItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <TrendingUp size={36} color={theme.colors.textDark} />
            <Text style={styles.emptyTitle}>{t('noPositionFound')}</Text>
            <Text style={styles.emptySub}>
              {searchQuery ? t('modifySearch') : t('addFirstTrade')}
            </Text>
          </View>
        }
      />

      {/* ── MODALS ── */}
      <TradeFormModal
        visible={formModalVisible}
        editingTrade={selectedTrade}
        onClose={() => setFormModalVisible(false)}
      />

      <TradeDetailModal
        visible={detailModalVisible}
        trade={selectedTrade}
        onClose={() => setDetailModalVisible(false)}
        onEdit={handleEditTrade}
        onDelete={(id: string) => handleDeleteTrade(id)}
      />
    </View>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
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
    marginBottom: theme.spacing.md,
  },
  screenTitle: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1.2,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 2,
  },
  addBtn: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  addBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },
  summaryBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  dividerV: {
    width: 1,
    height: '70%',
    backgroundColor: theme.colors.surface,
  },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  summaryVal: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
  },
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    height: 38,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.sansMedium,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: theme.spacing.md,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  filterPillActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
  },
  filterText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  filterTextActive: {
    color: theme.colors.textPrimary,
  },
  listContent: {
    paddingBottom: 40,
  },
  tradeCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  stripIndicator: {
    width: 4,
    backgroundColor: theme.colors.primaryLight,
  },
  stripWin: { backgroundColor: theme.colors.green },
  stripLoss: { backgroundColor: theme.colors.red },
  stripOpen: { backgroundColor: theme.colors.gold },
  cardContent: {
    flex: 1,
    padding: 12,
    gap: 6,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pairInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pairText: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 0.5,
  },
  lotText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
  },
  pnlWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  pnlText: {
    fontSize: 14,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  winPnl: { color: theme.colors.greenLight },
  lossPnl: { color: theme.colors.redLight },
  openPnl: { color: theme.colors.goldLight },
  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setupText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.sansMedium,
    flex: 1,
    marginRight: 8,
  },
  tradeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
    paddingTop: 6,
    marginTop: 2,
  },
  dateText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 8,
  },
  emptyTitle: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.sansBold,
  },
  emptySub: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.sans,
  },
  greenText: { color: theme.colors.greenLight },
  redText: { color: theme.colors.redLight },
});
