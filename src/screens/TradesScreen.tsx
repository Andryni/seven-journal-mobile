import React, { useState, useMemo, useRef } from 'react';
import { useHaptic } from '../hooks/useHaptic';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useQueryClient } from '@tanstack/react-query';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { formatCurrency } from '../utils/formatCurrency';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useAccounts } from '../features/accounts/useAccounts';
import { localeFor, useT } from '../i18n';
import { Badge } from '../components/ui/Badge';
import { TradeFormModal } from '../components/trades/TradeFormModal';
import { TradeDetailModal } from '../components/trades/TradeDetailModal';
import { Plus, Search, ArrowUpRight, ArrowDownRight, TrendingUp, Download, Upload, Trash2 } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { parseMT4MT5Report, parseTradingViewExport, generateTradeCSV } from '../utils/importParsers';

type FilterType = 'ALL' | 'WIN' | 'LOSS' | 'BE' | 'OPEN';

export const TradesScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { trades, createTrade, deleteTrade, isLoading } = useTrades();
  const { accounts } = useAccounts();

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const { light: hapticLight } = useHaptic();
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [sessionFilter, setSessionFilter] = useState<string>('ALL');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('ALL');

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


  // Import trades from file
  const handleImportTrades = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const content = await fetch(file.uri).then(r => r.text());

      let parsedTrades = [] as ReturnType<typeof parseMT4MT5Report>;
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".json")) {
        parsedTrades = JSON.parse(content);
      } else if (fileName.endsWith(".csv") || fileName.endsWith(".html") || fileName.endsWith(".htm")) {
        if (content.toLowerCase().includes("symbol") || content.toLowerCase().includes("ticker")) {
          parsedTrades = parseTradingViewExport(content);
        } else {
          parsedTrades = parseMT4MT5Report(content);
        }
      }

      if (parsedTrades.length > 0) {
        Alert.alert(
          t('importTitle'),
          t('importMsg', parsedTrades.length),
          [
            { text: t('confirmNo'), style: "cancel" },
            {
              text: t('importBtn'),
              onPress: async () => {
                for (const t of parsedTrades) {
                  await createTrade({
                    account_id: accounts[0]?.id || "",
                    pair: t.pair || "XAUUSD",
                    direction: t.direction || "BUY",
                    entry_price: Number(t.entry_price),
                    exit_price: t.exit_price ? Number(t.exit_price) : null,
                    stop_loss: Number(t.stop_loss),
                    take_profit: Number(t.take_profit),
                    size: Number(t.size),
                    entry_time: t.entry_time || new Date().toISOString(),
                    exit_time: t.exit_time || null,
                    pnl: t.pnl != null ? Number(t.pnl) : null,
                    r_multiple: t.r_multiple != null ? Number(t.r_multiple) : null,
                    timeframe: t.timeframe || "M5",
                    setup_structures: [],
                    setup_fvg: false,
                    setup_ob: false,
                    setup_liquidity_sweep: false,
                    bookmap_absorption: null,
                    bookmap_passive_orders: null,
                    bookmap_aggressive_orders: null,
                    bookmap_vwap_position: null,
                    mental_state: "focused",
                    cookie_jar_ref: false,
                    rule_40_percent: false,
                    screenshot_before_url: null,
                    screenshot_after_url: null,
                    notes: t.notes || null,
                    result: t.result || "OPEN",
                    session: null,
                  } as any);
                }
                Alert.alert(t('confirmTitle'), t('importSuccess', parsedTrades.length));
              },
            },
          ],
        );
      } else {
        Alert.alert(t('importTitle'), t('importEmpty'));
      }
    } catch {
      Alert.alert(t('confirmTitle'), t('importError'));
    }
  };

  // Export trades as CSV
  const handleExportCSV = async () => {
    try {
      const csv = generateTradeCSV(trades);
      const fileName = `seven_journal_${new Date().toISOString().split("T")[0]}.csv`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, csv);
      await Sharing.shareAsync(fileUri);
    } catch {
      Alert.alert(t('confirmTitle'), t('exportError'));
    }
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
      if (activeFilter === 'WIN') return t.result === 'TP' || (t.result !== 'SL' && t.result !== 'BE' && (t.pnl || 0) > 0);
      if (activeFilter === 'LOSS') return t.result === 'SL' || (t.result !== 'TP' && t.result !== 'BE' && (t.pnl || 0) < 0);
      if (activeFilter === 'BE') return t.result === 'BE' || (t.pnl !== null && Math.abs(t.pnl) < 0.01);
      if (activeFilter === 'OPEN') return t.result === 'OPEN' || t.pnl === null;

      // Session filter
      if (sessionFilter !== 'ALL') {
        const tradeSession = t.session || 'Over Session';
        if (tradeSession !== sessionFilter) return false;
      }

      // Date range filter
      if (dateRangeFilter !== 'ALL') {
        const tradeDate = new Date(t.entry_time).getTime();
        const now = Date.now();
        const msMap: Record<string, number> = { '7d': 7 * 86400000, '30d': 30 * 86400000, '90d': 90 * 86400000 };
        if (msMap[dateRangeFilter] && tradeDate < now - msMap[dateRangeFilter]) return false;
      }

      return true;
    });
  }, [trades, searchQuery, activeFilter, sessionFilter, dateRangeFilter]);

  // Quick stats computed on filtered list
  const stats = useMemo(() => {
    const closed = filteredTrades.filter(t => t.pnl !== null);
    const wins = closed.filter(t => t.result === 'TP' || (t.result !== 'SL' && t.result !== 'BE' && (t.pnl || 0) > 0)).length;
    const wr = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    const totalPnl = closed.reduce((acc, t) => acc + (t.pnl || 0), 0);
    return { count: filteredTrades.length, wr, totalPnl };
  }, [filteredTrades]);

  // ── Swipeable Row Component ──
  const SWIPE_THRESHOLD = -80;

  const SwipeableRow: React.FC<{
    children: React.ReactNode;
    onDelete: () => void;
  }> = ({ children, onDelete }) => {
    const translateX = useRef(new Animated.Value(0)).current;
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 20 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy),
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dx < 0) {
            translateX.setValue(Math.max(gestureState.dx, -120));
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx < SWIPE_THRESHOLD) {
            // Reveal delete button
            Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start();
          } else {
            // Snap back
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
          }
        },
      })
    ).current;

    return (
      <View style={{ overflow: 'hidden', marginBottom: 10 }}>
        {/* Delete background */}
        <View style={[styles.swipeDeleteBg, { position: 'absolute', right: 0, top: 0, bottom: 0, width: 80, justifyContent: 'center', alignItems: 'center', borderTopRightRadius: theme.borderRadius.md, borderBottomRightRadius: theme.borderRadius.md }]}>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }).start();
              onDelete();
            }}
            style={{ justifyContent: 'center', alignItems: 'center', flex: 1, width: 80 }}
          >
            <Trash2 size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 9, fontFamily: theme.fonts.monoBold, marginTop: 4 }}>{t('delete')}</Text>
          </TouchableOpacity>
        </View>
        {/* Foreground card */}
        <Animated.View
          style={{ transform: [{ translateX }], backgroundColor: theme.colors.card }}
          {...panResponder.panHandlers}
        >
          {children}
        </Animated.View>
      </View>
    );
  };

  const renderTradeItem = ({ item }: { item: Trade }) => {
    const isWin = (item.pnl || 0) > 0;
    const isLoss = (item.pnl || 0) < 0;
    const isOpen = item.pnl === null;

    return (
      <SwipeableRow onDelete={() => handleDeleteTrade(item.id)}>
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

          {/* Middle Row: Setup */}
          <View style={styles.middleRow}>
            {(() => {
              const realSetups = (item.setup_structures || []).filter(s => s !== 'BOS' && s !== 'TF');
              if (realSetups.length > 0) {
                return <Text style={styles.setupText} numberOfLines={1}>{realSetups.join(' · ')}</Text>;
              }
              return null;
            })()}
            {item.r_multiple !== null && (
              <Badge
                label={`${item.r_multiple >= 0 ? '+' : ''}${item.r_multiple.toFixed(1)}R`}
                variant={item.r_multiple > 0 ? 'gold' : item.r_multiple < 0 ? 'red' : 'neutral'}
                size="sm"
                style={{ marginLeft: 'auto' }}
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
      </SwipeableRow>
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
        {/* Import button */}
        <TouchableOpacity style={styles.importBtn} onPress={handleImportTrades} activeOpacity={0.8}>
          <Upload color={theme.colors.primaryLight} size={14} />
          <Text style={styles.importBtnText}>IMPORT</Text>
        </TouchableOpacity>
        {/* Export button */}
        <TouchableOpacity style={styles.exportBtn} onPress={handleExportCSV} activeOpacity={0.8}>
          <Download color={theme.colors.textSecondary} size={14} />
          <Text style={styles.exportBtnText}>CSV</Text>
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

      {/* Result Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} contentContainerStyle={{ gap: 6 }}>
        {(['ALL', 'WIN', 'LOSS', 'BE', 'OPEN'] as FilterType[]).map(f => {
          const isActive = activeFilter === f;
          return (
            <TouchableOpacity
              key={f}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => { hapticLight(); setActiveFilter(f); }}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {f === 'ALL' ? t('filterAll') : f === 'WIN' ? t('filterWin') : f === 'LOSS' ? t('filterLoss') : f === 'BE' ? 'BE' : t('filterOpen')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Session & Date Range Filters */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: theme.spacing.md }} contentContainerStyle={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {['ALL', 'Asia', 'London', 'New York', 'Over Session'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.filterPill, sessionFilter === s && styles.filterPillActive]}
            onPress={() => { hapticLight(); setSessionFilter(s); }}
          >
            <Text style={[styles.filterText, sessionFilter === s && styles.filterTextActive]}>
              {s === 'ALL' ? t('filterAll') : s === 'New York' ? 'NY' : s === 'Over Session' ? 'Over' : s}
            </Text>
          </TouchableOpacity>
        ))}
        <View style={{ width: 1, height: 16, backgroundColor: theme.colors.cardBorder, marginHorizontal: 2 }} />
        {['ALL', '7d', '30d', '90d'].map(d => (
          <TouchableOpacity
            key={d}
            style={[styles.filterPill, dateRangeFilter === d && styles.filterPillActive]}
            onPress={() => { hapticLight(); setDateRangeFilter(d); }}
          >
            <Text style={[styles.filterText, dateRangeFilter === d && styles.filterTextActive]}>
              {d === 'ALL' ? t('dateRangeAll') : d === '7d' ? t('dateRange7d') : d === '30d' ? t('dateRange30d') : t('dateRange90d')}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  importBtnText: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  exportBtnText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
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
  swipeDeleteBg: {
    backgroundColor: theme.colors.red,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
});
