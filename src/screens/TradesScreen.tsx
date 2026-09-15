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
import { Panel, Hairline } from '../components/ui/Panel';
import Animated, { FadeIn } from 'react-native-reanimated';
import { duration, stagger } from '../theme/motion';
import { PressableScale } from '../components/ui/PressableScale';
import { EmptyState } from '../components/ui/EmptyState';
import { useQueryClient } from '@tanstack/react-query';
import { useTrades } from '../features/trades/useTrades';
import { useUIStore } from '../store/uiStore';
import { scopeTrades, hasMixedCurrencies } from '../features/accounts/accountScope';
import type { Trade } from '../types/domain';
import { formatSize, unitForMarket, INSTRUMENTS } from '../utils/positionSizing';
import { useMoney } from '../features/accounts/useMoney';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useAccounts } from '../features/accounts/useAccounts';
import { localeFor, useT } from '../i18n';
import { Badge } from '../components/ui/Badge';
import { TradeFormModal } from '../components/trades/TradeFormModal';
import { TradeDetailModal } from '../components/trades/TradeDetailModal';
import { QuickTradeSheet } from '../components/trades/QuickTradeSheet';
import { Plus, Search, TrendingUp, Download, Upload, Zap, Info } from 'lucide-react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { parseMT4MT5Report, parseTradingViewExport, generateTradeCSV } from '../utils/importParsers';

type FilterType = 'ALL' | 'WIN' | 'LOSS' | 'OPEN';

export const TradesScreen: React.FC = () => {
  const { theme } = useTheme();
  const money = useMoney();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const queryClient = useQueryClient();
  const { trades: allTrades, createTrade, deleteTrade, isLoading } = useTrades();
  const { accounts } = useAccounts();
  const activeAccountId = useUIStore(s => s.activeAccountId);

  /**
   * The blotter lists the selected account's trades.
   *
   * It listed every account's while the footer stats and useMoney() spoke for
   * the active one, so the counts and the currency disagreed with each other.
   */
  const trades = useMemo(
    () => scopeTrades(allTrades, activeAccountId),
    [allTrades, activeAccountId]
  );

  const mixedCurrencies = useMemo(
    () => hasMixedCurrencies(allTrades, accounts, activeAccountId),
    [allTrades, accounts, activeAccountId]
  );

  /** Blotter sizes carry the unit of the account that traded them. */
  const unitFor = React.useCallback(
    (trade: Trade) => {
      const acc = accounts.find(a => a.id === trade.account_id);
      if (acc?.instrument_type) return unitForMarket(acc.instrument_type);
      return INSTRUMENTS[trade.pair]?.unit ?? 'lot';
    },
    [accounts]
  );
  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [quickSheetVisible, setQuickSheetVisible] = useState(false);

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
          "Import",
          `${parsedTrades.length} trade(s) trouvé(s). Importer ?`,
          [
            { text: "Annuler", style: "cancel" },
            {
              text: "Importer",
              onPress: async () => {
                for (const t of parsedTrades) {
                  await createTrade({
                    // Import into the account being viewed, not an arbitrary
                    // first one: otherwise the rows land somewhere the trader
                    // is not looking and appear to have been dropped.
                    account_id: activeAccountId || accounts[0]?.id || "",
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
                Alert.alert("Succes", `${parsedTrades.length} trade(s) importe(s).`);
              },
            },
          ],
        );
      } else {
        Alert.alert("Import", "Aucun trade detecte dans ce fichier.");
      }
    } catch {
      Alert.alert("Erreur", "Erreur lors de l import du fichier.");
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
      Alert.alert("Erreur", "Erreur lors de l export.");
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

  /**
   * Blotter row — one trade per line, columns aligned in tabular-nums.
   * Replaces the previous 3-row "trade card": at 5 visible trades per screen
   * a journal is unusable. This fits ~11 and reads like an execution report.
   */
  const renderTradeItem = ({ item, index }: { item: Trade; index: number }) => {
    const isOpen = item.pnl === null;
    const pnlColor = isOpen
      ? theme.colors.textSecondary
      : (item.pnl || 0) >= 0
      ? theme.colors.green
      : theme.colors.red;

    return (
      <Animated.View entering={FadeIn.delay(stagger(index)).duration(duration.fast)}>
        <PressableScale
          style={styles.row}
          onPress={() => handleViewTrade(item)}
          accessibilityLabel={`${item.pair} ${item.direction}`}
          pressedScale={0.995}
        >
          {/* Direction rail — the only colour cue needed for long/short */}
          <View
            style={[
              styles.rail,
              { backgroundColor: item.direction === 'BUY' ? theme.colors.green : theme.colors.red },
            ]}
          />

          {/* Col 1 — instrument + context */}
          <View style={styles.colMain}>
            <View style={styles.pairLine}>
              <Text style={styles.pair}>{item.pair}</Text>
              <Text style={styles.dir}>{item.direction}</Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>
              {new Date(item.entry_time).toLocaleDateString(localeFor(lang), {
                day: '2-digit',
                month: '2-digit',
              })}
              {'  '}
              {new Date(item.entry_time).toLocaleTimeString(localeFor(lang), {
                hour: '2-digit',
                minute: '2-digit',
              })}
              {item.timeframe ? `  ${item.timeframe}` : ''}
              {item.size ? `  ${formatSize(item.size, unitFor(item))}` : ''}
            </Text>
          </View>

          {/* Col 2 — R multiple */}
          <Text
            style={[
              styles.colR,
              {
                color:
                  item.r_multiple === null
                    ? theme.colors.textDark
                    : item.r_multiple >= 0
                    ? theme.colors.textSecondary
                    : theme.colors.textMuted,
              },
            ]}
          >
            {item.r_multiple !== null
              ? `${item.r_multiple >= 0 ? '+' : ''}${item.r_multiple.toFixed(1)}R`
              : '—'}
          </Text>

          {/* Col 3 — P&L + outcome */}
          <View style={styles.colPnl}>
            <Text style={[styles.pnl, { color: pnlColor }]} numberOfLines={1}>
              {!isOpen ? money(item.pnl!) : t('openTradeStatus')}
            </Text>
            <Text
              style={[
                styles.result,
                {
                  color:
                    item.result === 'TP'
                      ? theme.colors.green
                      : item.result === 'SL'
                      ? theme.colors.red
                      : theme.colors.textDark,
                },
              ]}
            >
              {item.result || (isOpen ? 'OPEN' : 'CLOSED')}
            </Text>
          </View>
        </PressableScale>
        <Hairline inset={14} />
      </Animated.View>
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
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleImportTrades}
            activeOpacity={0.7}
            accessibilityLabel="Import"
            hitSlop={8}
          >
            <Upload color={theme.colors.textSecondary} size={15} strokeWidth={1.75} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleExportCSV}
            activeOpacity={0.7}
            accessibilityLabel="Export CSV"
            hitSlop={8}
          >
            <Download color={theme.colors.textSecondary} size={15} strokeWidth={1.75} />
          </TouchableOpacity>
          {/* Full form stays available, but quick entry is the primary path:
              a journal only survives if logging takes seconds. */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={handleAddTrade}
            activeOpacity={0.7}
            accessibilityLabel={t('newTradeBtn')}
            hitSlop={8}
          >
            <Plus color={theme.colors.textSecondary} size={16} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setQuickSheetVisible(true)}
            activeOpacity={0.8}
            accessibilityLabel={t('quickEntry')}
          >
            <Zap color={theme.colors.background} size={14} strokeWidth={2.5} />
            <Text style={styles.addBtnText}>{t('quickEntry')}</Text>
          </TouchableOpacity>
        </View>
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
            {money(stats.totalPnl)}
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

      {mixedCurrencies ? (
        <View style={styles.warnBanner}>
          <Info color={theme.colors.red} size={14} strokeWidth={2} />
          <Text style={styles.warnBannerText}>
            <Text style={styles.warnBannerStrong}>{t('mixedCurrencies')}</Text>
            {'  '}
            {t('mixedCurrenciesHint')}
          </Text>
        </View>
      ) : null}

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

      {/* ── 4. BLOTTER COLUMN HEADER ── */}
      {filteredTrades.length > 0 ? (
        <View style={styles.colHeader}>
          <Text style={[styles.colHeaderText, { flex: 1, marginLeft: 14 }]}>
            {t('instrument')}
          </Text>
          <Text style={[styles.colHeaderText, { width: 54, textAlign: 'right' }]}>R</Text>
          <Text style={[styles.colHeaderText, { width: 92, textAlign: 'right' }]}>P&L</Text>
        </View>
      ) : null}

      {/* ── 5. TRADES LIST ── */}
      <FlatList
        data={filteredTrades}
        keyExtractor={item => item.id}
        renderItem={renderTradeItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} colors={[theme.colors.primary]} />}
        ListEmptyComponent={
          <EmptyState
            icon={<TrendingUp size={22} color={theme.colors.primary} />}
            title={t('noPositionFound')}
            description={searchQuery ? t('modifySearch') : t('addFirstTrade')}
            actionLabel={searchQuery ? undefined : t('quickEntry')}
            onAction={searchQuery ? undefined : () => setQuickSheetVisible(true)}
          />
        }
      />

      {/* ── MODALS ── */}
      <TradeFormModal
        visible={formModalVisible}
        editingTrade={selectedTrade}
        onClose={() => setFormModalVisible(false)}
      />

      <QuickTradeSheet
        visible={quickSheetVisible}
        onClose={() => setQuickSheetVisible(false)}
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
    paddingTop: theme.spacing.lg,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header ──
  screenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  screenTitle: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.display,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: -0.6,
  },
  screenSubtitle: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoMedium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 12,
    height: 32,
    borderRadius: theme.borderRadius.sm,
  },
  addBtnText: {
    color: theme.colors.background,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },

  // ── Summary strip ──
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  summaryVal: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.metricSm,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
  },
  dividerV: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.hairline,
  },

  // ── Search & filters ──
  searchBarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.inputBg,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.md,
    height: 38,
    marginBottom: theme.spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: theme.type.body,
    fontFamily: theme.fonts.sans,
    padding: 0,
  },
  warnBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.red,
  },
  warnBannerText: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: theme.type.label,
    fontFamily: theme.fonts.sans,
    lineHeight: 17,
  },
  warnBannerStrong: {
    color: theme.colors.red,
    fontFamily: theme.fonts.monoBold,
  },
  filterRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  // Filters are underlined segments, not floating pills — closer to a
  // terminal's tab rail and far less visual noise.
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterPillActive: {
    borderBottomColor: theme.colors.primary,
  },
  filterText: {
    color: theme.colors.textMuted,
    fontSize: theme.type.label,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },
  filterTextActive: {
    color: theme.colors.primary,
  },

  // ── Blotter column header ──
  colHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.borderStrong,
  },
  colHeaderText: {
    color: theme.colors.textDark,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 1.2,
  },

  // ── Blotter row ──
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: theme.spacing.sm,
  },
  rail: {
    width: 2,
    height: 26,
    borderRadius: 1,
  },
  colMain: { flex: 1 },
  pairLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  pair: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.body,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.4,
  },
  dir: {
    color: theme.colors.textDark,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoMedium,
    letterSpacing: 0.6,
  },
  meta: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.mono,
    fontVariant: ['tabular-nums'],
    marginTop: 3,
  },
  colR: {
    width: 54,
    textAlign: 'right',
    fontSize: theme.type.label,
    fontFamily: theme.fonts.monoMedium,
    fontVariant: ['tabular-nums'],
  },
  colPnl: {
    width: 92,
    alignItems: 'flex-end',
  },
  pnl: {
    fontSize: theme.type.metricSm,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
  },
  result: {
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    marginTop: 2,
  },

  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  greenText: { color: theme.colors.green },
  redText: { color: theme.colors.red },
});
