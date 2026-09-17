import React, { useState, useMemo, useCallback } from 'react';
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
  ScrollView,
} from 'react-native';
import { Hairline } from '../components/ui/Panel';
import Animated, { FadeIn } from 'react-native-reanimated';
import { duration, stagger } from '../theme/motion';
import { PressableScale } from '../components/ui/PressableScale';
import { X } from 'lucide-react-native';
import { withAlpha } from '../theme';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { useTrades } from '../features/trades/useTrades';
import { useRefresh } from '../features/data/useRefresh';
import { useUIStore } from '../store/uiStore';
import { scopeTrades, hasMixedCurrencies } from '../features/accounts/accountScope';
import { collectTags, filterTrades } from '../utils/tradeTags';
import type { Trade } from '../types/domain';
import { useMoney } from '../features/accounts/useMoney';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useAccounts } from '../features/accounts/useAccounts';
import { useT } from '../i18n';
import { TradeFormModal } from '../components/trades/TradeFormModal';
import { TradeDetailModal } from '../components/trades/TradeDetailModal';
import { TradeBlotterRow } from '../components/trades/TradeBlotterRow';
import { QuickTradeSheet } from '../components/trades/QuickTradeSheet';
import { Plus, Search, TrendingUp, Download, Upload, Zap, Info, Images } from 'lucide-react-native';
import { ScreenshotGallery } from '../components/trades/ScreenshotGallery';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { parseMT4MT5Report, parseTradingViewExport, generateTradeCSV } from '../utils/importParsers';
import { detectSession, detectTimeframe } from '../utils/sessionDetect';

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

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const { refreshing, onRefresh } = useRefresh();
  const [quickSheetVisible, setQuickSheetVisible] = useState(false);
  const [galleryVisible, setGalleryVisible] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  /**
   * Drill-down from an analytics bar (see uiStore.TradesDrill). The chip
   * stays active until dismissed; a later drill replaces it.
   */
  const tradesDrill = useUIStore(s => s.tradesDrill);
  const setTradesDrill = useUIStore(s => s.setTradesDrill);
  const clearDrill = useCallback(() => setTradesDrill(null), [setTradesDrill]);

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(x => x !== tag) : [...prev, tag]
    );
  }, []);


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
        {
          text: t('confirmYes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTrade(id);
            } catch {
              /* reported by useTrades' onError */
            }
          },
        },
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
          t('importFound', parsedTrades.length),
          [
            { text: t('confirmNo'), style: "cancel" },
            {
              text: t('importConfirm'),
              onPress: async () => {
                const targetAccount = activeAccountId || accounts[0]?.id;
                if (!targetAccount) {
                  Alert.alert(t('importTitle'), t('importNoAccount'));
                  return;
                }

                // Import each row independently. A single malformed row used
                // to reject the loop, skipping every remaining trade while
                // still reporting success for the full count.
                const results = await Promise.allSettled(
                  parsedTrades.map(row => {
                    const entryTime = row.entry_time || new Date().toISOString();
                    return createTrade({
                      account_id: targetAccount,
                      pair: row.pair || "XAUUSD",
                      direction: row.direction || "BUY",
                      entry_price: Number(row.entry_price),
                      exit_price: row.exit_price ? Number(row.exit_price) : null,
                      stop_loss: Number(row.stop_loss),
                      take_profit: Number(row.take_profit),
                      size: Number(row.size),
                      entry_time: entryTime,
                      exit_time: row.exit_time || null,
                      pnl: row.pnl != null ? Number(row.pnl) : null,
                      // Costs recovered from the broker report. Without these
                      // the import silently produced a cost-free book.
                      commission: Number(row.commission ?? 0),
                      swap: Number(row.swap ?? 0),
                      r_multiple: row.r_multiple != null ? Number(row.r_multiple) : null,
                      // Inferred from hold time rather than defaulted to M5:
                      // stamping every imported trade with one timeframe made
                      // the timeframe breakdown a single meaningless bar.
                      timeframe:
                        row.timeframe ||
                        detectTimeframe(entryTime, row.exit_time || null) ||
                        "M15",
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
                      notes: row.notes || null,
                      result: row.result || "OPEN",
                      // Derived from the entry timestamp. Left null, analytics
                      // bucket it as 'Over Session', which wrongly suggests the
                      // trader works outside the main sessions.
                      session: detectSession(entryTime),
                    } as any);
                  })
                );

                const imported = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.length - imported;

                Alert.alert(
                  t('importTitle'),
                  failed === 0
                    ? t('importDone', imported)
                    : t('importPartial', imported, failed)
                );
              },
            },
          ],
        );
      } else {
        Alert.alert(t('importTitle'), t('importNone'));
      }
    } catch {
      Alert.alert(t('errorTitle'), t('importError'));
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
      Alert.alert(t('errorTitle'), t('exportError'));
    }
  };
  /**
   * Every tag in use, so the filter bar offers what actually exists rather
   * than a fixed vocabulary the trader never chose.
   */
  const availableTags = useMemo(() => collectTags(trades), [trades]);

  // Filtering is delegated to the tested engine so the screen and any other
  // consumer of a filter can never drift apart.
  const filteredTrades = useMemo(
    () =>
      filterTrades(trades, {
        query: searchQuery,
        tags: selectedTags,
        tagMode: 'all',
        outcome:
          activeFilter === 'WIN'
            ? 'win'
            : activeFilter === 'LOSS'
            ? 'loss'
            : activeFilter === 'OPEN'
            ? 'open'
            : 'all',
        // The analytics drill-down, when one is armed. setup rides the text
        // query (titles live in free-text notes); weekdays use their
        // Monday-first index; holding buckets their "min-max" minutes.
        ...(tradesDrill
          ? tradesDrill.kind === 'pair'
            ? { query: tradesDrill.value }
            : tradesDrill.kind === 'timeframe'
            ? { timeframes: [tradesDrill.value] }
            : tradesDrill.kind === 'session'
            ? { sessions: [tradesDrill.value] }
            : tradesDrill.kind === 'mental'
            ? { mentalStates: [tradesDrill.value] }
            : tradesDrill.kind === 'weekday'
            ? {
                weekdays: [
                  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(
                    tradesDrill.value
                  ),
                ].filter(i => i >= 0),
              }
            : tradesDrill.kind === 'holding'
            ? { holdingRanges: [tradesDrill.value] }
            : tradesDrill.kind === 'setup'
            ? { query: tradesDrill.value }
            : {}
          : {}),
      }),
    [trades, searchQuery, activeFilter, selectedTags, tradesDrill]
  );

  // Quick stats computed on filtered list
  const stats = useMemo(() => {
    const closed = filteredTrades.filter(t => t.pnl !== null);
    const wins = closed.filter(t => (t.pnl || 0) > 0).length;
    const wr = closed.length > 0 ? (wins / closed.length) * 100 : 0;
    const totalPnl = closed.reduce((acc, t) => acc + (t.pnl || 0), 0);
    return { count: filteredTrades.length, wr, totalPnl };
  }, [filteredTrades]);

  /**
   * Blotter row — one trade per line. The row itself lives in
   * TradeBlotterRow so the Dashboard's recent-trades preview renders the
   * exact same execution-report line, not a diverging look-alike.
   */
  const renderTradeItem = ({ item, index }: { item: Trade; index: number }) => (
    <Animated.View entering={FadeIn.delay(stagger(index)).duration(duration.fast)}>
      <TradeBlotterRow trade={item} onPress={handleViewTrade} />
      <Hairline inset={14} />
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={styles.container} accessibilityLabel={t('loading')}>
        <SkeletonRows rows={8} />
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
          {/* Pattern-training gallery: every attached chart in one grid. */}
          <PressableScale
            style={styles.iconBtn}
            onPress={() => setGalleryVisible(true)}
            accessibilityLabel={t('galleryOpen')}
          >
            <Images color={theme.colors.textSecondary} size={15} strokeWidth={1.75} />
          </PressableScale>
          <PressableScale
            style={styles.iconBtn}
            onPress={handleImportTrades}
            accessibilityLabel="Import"
          >
            <Upload color={theme.colors.textSecondary} size={15} strokeWidth={1.75} />
          </PressableScale>
          <PressableScale
            style={styles.iconBtn}
            onPress={handleExportCSV}
            accessibilityLabel="Export CSV"
          >
            <Download color={theme.colors.textSecondary} size={15} strokeWidth={1.75} />
          </PressableScale>
          {/* Logging moved to the global FAB: here the label was clipped by
              the icon buttons and the target was under 44px. */}
          <PressableScale
            style={styles.iconBtn}
            onPress={handleAddTrade}
            accessibilityLabel={t('newTradeBtn')}
          >
            <Plus color={theme.colors.textSecondary} size={16} strokeWidth={2} />
          </PressableScale>
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

      {/* Active analytics drill-down. One chip, one tap to leave: the bar in
          Analytics narrowed this list, so the way back must be as obvious as
          the way in. */}
      {tradesDrill ? (
        <View style={styles.drillChipRow}>
          <View style={[styles.drillChip, { borderColor: withAlpha(theme.colors.primary, 0.5) }]}>
            <Text style={[styles.drillChipText, { color: theme.colors.primaryLight }]} numberOfLines={1}>
              {t('drillActiveFilter', tradesDrill.label)}
            </Text>
            <PressableScale
              onPress={clearDrill}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('filterClear')}
            >
              <X size={14} color={theme.colors.primaryLight} />
            </PressableScale>
          </View>
        </View>
      ) : null}

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

      {availableTags.length > 0 && (
        <View style={styles.tagBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tagBarContent}
          >
            {availableTags.map(({ tag, count }) => {
              const active = selectedTags.includes(tag);
              return (
                <PressableScale
                  key={tag}
                  onPress={() => toggleTag(tag)}
                  style={[styles.tagFilter, active && styles.tagFilterActive]}
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${t('tfTags')} ${tag}`}
                >
                  <Text style={[styles.tagFilterText, active && styles.tagFilterTextActive]}>
                    {tag} {count}
                  </Text>
                </PressableScale>
              );
            })}
          </ScrollView>
          {selectedTags.length > 0 && (
            <PressableScale
              onPress={() => setSelectedTags([])}
              style={styles.tagClear}
              accessibilityLabel={t('filterClear')}
            >
              <Text style={styles.tagClearText}>{t('filterClear')}</Text>
            </PressableScale>
          )}
        </View>
      )}

      <View style={styles.filterRow}>
        {(['ALL', 'WIN', 'LOSS', 'OPEN'] as FilterType[]).map(f => {
          const isActive = activeFilter === f;
          return (
            <PressableScale
              key={f}
              style={[styles.filterPill, isActive && styles.filterPillActive]}
              onPress={() => setActiveFilter(f)}
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={f === 'ALL' ? t('filterAll') : f === 'WIN' ? t('filterWin') : f === 'LOSS' ? t('filterLoss') : t('filterOpen')}
            >
              <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                {f === 'ALL' ? t('filterAll') : f === 'WIN' ? t('filterWin') : f === 'LOSS' ? t('filterLoss') : t('filterOpen')}
              </Text>
            </PressableScale>
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

      <ScreenshotGallery
        visible={galleryVisible}
        onClose={() => setGalleryVisible(false)}
        trades={trades}
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
  drillChipRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  drillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'transparent',
    maxWidth: '100%',
  },
  drillChipText: {
    fontSize: theme.type.label,
    fontFamily: theme.fonts.monoBold,
    flexShrink: 1,
  },
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
  tagBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
    gap: 8,
  },
  tagBarContent: { gap: 6, paddingRight: 4 },
  tagFilter: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.surface,
  },
  tagFilterActive: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.surfaceLight,
  },
  tagFilterText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.mono,
  },
  tagFilterTextActive: {
    color: theme.colors.primary,
    fontFamily: theme.fonts.monoBold,
  },
  tagClear: { paddingVertical: 4, paddingHorizontal: 6 },
  tagClearText: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
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

  listContent: {
    paddingBottom: theme.spacing.xxl,
  },
  greenText: { color: theme.colors.green },
  redText: { color: theme.colors.red },
});
