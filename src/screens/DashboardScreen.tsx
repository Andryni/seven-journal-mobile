import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { RootTabParamList } from '../types/navigation';
import { useTrades } from '../features/trades/useTrades';
import { useAccounts } from '../features/accounts/useAccounts';
import { useDailyLock } from '../features/guard/useDailyLock';
import { usePerformanceMetrics } from '../features/dashboard/usePerformanceMetrics';
import type { Trade } from '../types/domain';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { localeFor, useT } from '../i18n';
import { Panel, Hairline } from '../components/ui/Panel';
import { Metric } from '../components/ui/Metric';
import { Badge } from '../components/ui/Badge';
import { GlowingEquityAreaChart } from '../components/ui/GlowingEquityAreaChart';
import { BicolorBarChart } from '../components/ui/BicolorBarChart';
import { ShieldAlert, Share2, ChevronRight, BookOpen } from 'lucide-react-native';
import { MarketSessionsBar } from '../components/dashboard/MarketSessionsBar';
import { DailyRiskGauge } from '../components/dashboard/DailyRiskGauge';
import { DisciplineCard } from '../components/dashboard/DisciplineCard';
import { ChecklistCard } from '../components/dashboard/ChecklistCard';
import { EmptyState } from '../components/ui/EmptyState';
import { PressableScale } from '../components/ui/PressableScale';
import { useUIStore } from '../store/uiStore';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { formatCurrency } from '../utils/formatCurrency';
import { isSameLocalDay } from '../utils/formatDate';

/**
 * Dashboard — "Trading Desk" rebuild.
 *
 * The previous version stacked a fake live ticker, a hero gradient, an
 * achievements wall, a checklist, a position calculator, a risk gauge and a
 * sessions bar into one scroll. That reads as a feed, not a cockpit.
 *
 * This version answers, in order: how much am I up? how much risk is left
 * today? what does the curve look like? what did I just do? Everything else
 * moved to the screen where it actually belongs.
 */
export const DashboardScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { isLocked, lockReason } = useDailyLock();
  const m = usePerformanceMetrics(trades, lang);
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const activeAccountId = useUIStore(s => s.activeAccountId);

  const [shareModalVisible, setShareModalVisible] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find(a => a.id === activeAccountId) ?? accounts[0] ?? null,
    [accounts, activeAccountId]
  );

  const todayPnL = useMemo(
    () =>
      trades
        .filter(tr => isSameLocalDay(tr.entry_time))
        .reduce((sum, tr) => sum + (tr.pnl || 0), 0),
    [trades]
  );

  const expectancy = useMemo(() => {
    if (m.closedTrades === 0) return 0;
    return m.netPnL / m.closedTrades;
  }, [m.netPnL, m.closedTrades]);

  if (tradesLoading || accountsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ── 1. HERO — the one number that matters, and nothing next to it ── */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <Text style={styles.heroLabel}>{t('netPnlTotal')}</Text>
          <PressableScale
            style={styles.shareBtn}
            onPress={() => setShareModalVisible(true)}
            accessibilityLabel={t('sharePnl')}
            hitSlop={8}
          >
            <Share2 size={13} color={theme.colors.textSecondary} strokeWidth={1.75} />
          </PressableScale>
        </View>

        <Text
          style={[
            styles.heroValue,
            { color: m.netPnL >= 0 ? theme.colors.green : theme.colors.red },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
        >
          {formatCurrency(m.netPnL, { thousandsSeparator: true })}
        </Text>

        {/* Inline secondary readout — today / open / trades */}
        <View style={styles.heroMeta}>
          <Text style={styles.heroMetaItem}>
            {t('todayLabel')}{' '}
            <Text
              style={{
                color:
                  todayPnL > 0
                    ? theme.colors.green
                    : todayPnL < 0
                    ? theme.colors.red
                    : theme.colors.textSecondary,
              }}
            >
              {formatCurrency(todayPnL)}
            </Text>
          </Text>
          <Text style={styles.heroDot}>·</Text>
          <Text style={styles.heroMetaItem}>
            {m.totalTrades} {t('positions')}
          </Text>
          {m.openTrades > 0 ? (
            <>
              <Text style={styles.heroDot}>·</Text>
              <Text style={[styles.heroMetaItem, { color: theme.colors.primary }]}>
                {m.openTrades} {t('openPositionsShort')}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      {/* ── 2. LOCK GUARD — highest-priority interrupt ── */}
      {isLocked ? (
        <View style={styles.lockBanner}>
          <ShieldAlert color={theme.colors.red} size={18} strokeWidth={1.75} />
          <View style={styles.lockContent}>
            <Text style={styles.lockTitle}>{t('sessionLockedShort')}</Text>
            <Text style={styles.lockDesc} numberOfLines={2}>
              {lockReason || t('lockReasonFallback')}
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── 3. METRIC STRIP — four numbers, no boxes, hairline-separated ── */}
      <Panel flush>
        <View style={styles.strip}>
          <Metric
            label={t('winRateGlobal')}
            value={`${m.winRate.toFixed(1)}%`}
            sub={`${m.winCount}W / ${m.lossCount}L`}
            size="small"
          />
          <View style={styles.vRule} />
          <Metric
            label={t('profitFactor')}
            value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)}
            sub={`R ${m.avgRMultiple >= 0 ? '+' : ''}${m.avgRMultiple.toFixed(2)}`}
            size="small"
            tone="accent"
          />
          <View style={styles.vRule} />
          <Metric
            label={t('expectancyShort')}
            value={formatCurrency(expectancy, { decimals: 0 })}
            sub={t('perTrade')}
            size="small"
            tone="pnl"
            pnlValue={expectancy}
          />
          <View style={styles.vRule} />
          <Metric
            label={t('maxDrawdownLabel')}
            value={formatCurrency(-m.maxDrawdown, { decimals: 0 })}
            sub={`${m.dayWinRate.toFixed(0)}% ${t('greenDaysShort')}`}
            size="small"
            tone="pnl"
            pnlValue={-m.maxDrawdown}
          />
        </View>
      </Panel>

      {/* ── 4. RISK TODAY ── */}
      <DailyRiskGauge trades={trades} account={activeAccount} />

      {/* ── 5. EMPTY STATE ── */}
      {m.totalTrades === 0 ? (
        <Panel>
          <EmptyState
            icon={<BookOpen size={22} color={theme.colors.primary} />}
            title={t('emptyDashTitle')}
            description={t('emptyDashDesc')}
            actionLabel={t('emptyDashCta')}
            onAction={() => navigation.navigate('Trades')}
          />
        </Panel>
      ) : null}

      {/* ── 6. EQUITY ── */}
      {m.equityCurve.length > 0 ? (
        <Panel title={t('equityLive')}>
          <GlowingEquityAreaChart
            data={m.equityCurve.map(e => ({ date: e.date, value: e.pnl }))}
            height={180}
          />
        </Panel>
      ) : null}

      {m.dailyPnL.length > 0 ? (
        <Panel title={t('dailyPnl')}>
          <BicolorBarChart
            data={m.dailyPnL.map(d => ({ label: d.date, value: d.pnl }))}
            height={150}
          />
        </Panel>
      ) : null}

      {/* ── 7. DISCIPLINE (replaces the achievements wall) ── */}
      {m.totalTrades > 0 ? <DisciplineCard trades={trades} /> : null}

      {/* ── 8. SESSIONS ── */}
      <MarketSessionsBar />

      {/* ── 9. PRE-SESSION CHECKLIST ── */}
      <ChecklistCard />

      {/* ── 10. RECENT TRADES — blotter preview ── */}
      <Panel
        title={t('lastTrades')}
        flush
        action={
          <PressableScale
            style={styles.viewAll}
            onPress={() => navigation.navigate('Trades')}
            accessibilityLabel={t('viewAll')}
            hitSlop={8}
          >
            <Text style={styles.viewAllText}>{t('viewAll')}</Text>
            <ChevronRight size={12} color={theme.colors.primary} strokeWidth={2} />
          </PressableScale>
        }
      >
        {m.recentTrades.length === 0 ? (
          <Text style={styles.emptyText}>{t('noRecentTrades')}</Text>
        ) : (
          m.recentTrades.map((tr: Trade, i: number) => (
            <View key={tr.id}>
              <View style={styles.blotterRow}>
                <View
                  style={[
                    styles.dirRail,
                    { backgroundColor: tr.direction === 'BUY' ? theme.colors.green : theme.colors.red },
                  ]}
                />
                <View style={styles.blotterLeft}>
                  <Text style={styles.pair}>{tr.pair}</Text>
                  <Text style={styles.time}>
                    {new Date(tr.entry_time).toLocaleDateString(localeFor(lang), {
                      day: '2-digit',
                      month: '2-digit',
                    })}{' '}
                    {new Date(tr.entry_time).toLocaleTimeString(localeFor(lang), {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={styles.blotterRight}>
                  <Text
                    style={[
                      styles.pnl,
                      {
                        color:
                          tr.pnl === null
                            ? theme.colors.textSecondary
                            : tr.pnl >= 0
                            ? theme.colors.green
                            : theme.colors.red,
                      },
                    ]}
                  >
                    {tr.pnl !== null ? formatCurrency(tr.pnl) : '—'}
                  </Text>
                  <Badge
                    label={tr.result}
                    size="sm"
                    variant={tr.result === 'TP' ? 'green' : tr.result === 'SL' ? 'red' : 'neutral'}
                  />
                </View>
              </View>
              {i < m.recentTrades.length - 1 ? <Hairline inset={16} /> : null}
            </View>
          ))
        )}
      </Panel>

      <ShareCardModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        trades={trades}
        accountName={activeAccount?.name || 'Compte Principal'}
      />
    </ScrollView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    center: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Hero
    hero: {
      marginBottom: theme.spacing.lg,
    },
    heroTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    shareBtn: {
      padding: 4,
    },
    heroValue: {
      fontSize: theme.type.hero,
      lineHeight: theme.type.hero * 1.08,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1.8,
      marginTop: 6,
    },
    heroMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 8,
      flexWrap: 'wrap',
    },
    heroMetaItem: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoMedium,
      fontVariant: ['tabular-nums'],
      letterSpacing: 0.4,
    },
    heroDot: {
      color: theme.colors.textDark,
      fontSize: theme.type.label,
    },

    // Lock
    lockBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.md,
      backgroundColor: theme.colors.redMuted,
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.red,
      borderRadius: theme.borderRadius.sm,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    lockContent: { flex: 1 },
    lockTitle: {
      color: theme.colors.red,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
    },
    lockDesc: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      marginTop: 3,
      lineHeight: 14,
    },

    // Metric strip
    strip: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    vRule: {
      width: StyleSheet.hairlineWidth,
      alignSelf: 'stretch',
      backgroundColor: theme.colors.hairline,
    },

    // View all
    viewAll: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
    },
    viewAllText: {
      color: theme.colors.primary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },

    // Blotter
    blotterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 11,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.md,
    },
    dirRail: {
      width: 2,
      height: 24,
      borderRadius: 1,
    },
    blotterLeft: { flex: 1 },
    pair: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
    time: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
      marginTop: 2,
    },
    blotterRight: { alignItems: 'flex-end', gap: 4 },
    pnl: {
      fontSize: theme.type.metricSm,
      fontFamily: theme.fonts.monoExtraBold,
      fontVariant: ['tabular-nums'],
    },
    emptyText: {
      color: theme.colors.textMuted,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.sans,
      textAlign: 'center',
      paddingVertical: theme.spacing.lg,
    },
  });
