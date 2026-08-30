import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
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
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { GlowingEquityAreaChart } from '../components/ui/GlowingEquityAreaChart';
import { BicolorBarChart } from '../components/ui/BicolorBarChart';
import { LiveTickerBanner } from '../components/common/LiveTickerBanner';

import {
  Sparkles,
  ShieldAlert,
  Share2,
  Flame,
  Snowflake,
  BookOpen,
} from 'lucide-react-native';
import { MarketSessionsBar } from '../components/dashboard/MarketSessionsBar';
import { DailyRiskGauge } from '../components/dashboard/DailyRiskGauge';
import { EmptyState } from '../components/ui/EmptyState';
import { AnimatedNumber } from '../components/ui/AnimatedNumber';
import { PressableScale } from '../components/ui/PressableScale';
import { useUIStore } from '../store/uiStore';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { ChecklistCard } from '../components/dashboard/ChecklistCard';
import { PositionCalculator } from '../components/trades/PositionCalculator';
import { AchievementsCard } from '../components/dashboard/AchievementsCard';
import { formatCurrency } from '../utils/formatCurrency';
import { isSameLocalDay } from '../utils/formatDate';
import { KpiCard } from '../components/ui/KpiCard';
import { StatRow } from '../components/ui/StatRow';

export const DashboardScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();
  const { isLocked, lock } = useDailyLock();
  const m = usePerformanceMetrics(trades, lang);
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const activeAccountId = useUIStore(s => s.activeAccountId);

  const [shareModalVisible, setShareModalVisible] = useState(false);

  const activeAccount = useMemo(
    () => accounts.find(a => a.id === activeAccountId) ?? accounts[0] ?? null,
    [accounts, activeAccountId]
  );

  // Account Health
  const healthStatus = useMemo(() => {
    if (m.maxDrawdown > 12 || m.consistency.alert) {
      return { label: t('healthCritical'), color: theme.colors.redLight, bg: 'rgba(239, 68, 68, 0.15)' };
    }
    if (m.maxDrawdown > 6 || m.winRate < 40) {
      return { label: t('healthCaution'), color: theme.colors.goldLight, bg: 'rgba(245, 158, 11, 0.15)' };
    }
    return { label: t('healthExcellent'), color: theme.colors.greenLight, bg: 'rgba(16, 185, 129, 0.15)' };
  }, [m, t]);

  // Today trades count
  const todayTradesCount = useMemo(() => {
    return trades.filter(t => isSameLocalDay(t.entry_time)).length;
  }, [trades]);

  const isPositive = m.netPnL >= 0;

  if (tradesLoading || accountsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* ── 0. LIVE TICKER BANNER ANIMÉ ── */}
      <LiveTickerBanner />

      {/* ── 1. HERO BANNER — GREETING + ANIMATED NET P&L + SESSIONS ── */}
      <Animated.View entering={FadeInDown.duration(450).springify().damping(16)} style={styles.heroBanner}>
        <View style={styles.heroHeader}>
          <View>
            <View style={styles.flexRow}>
              <Text style={styles.greetingTitle}>{t('greetingTitle')}</Text>
              <Sparkles color={theme.colors.goldLight} size={16} />
            </View>
            <Text style={styles.greetingSub}>
              {todayTradesCount === 0
                ? t('greetingNoTrades')
                : t('greetingTrades', todayTradesCount)}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <PressableScale
              style={styles.shareCardBtn}
              onPress={() => setShareModalVisible(true)}
              accessibilityLabel={t('sharePnl')}
            >
              <Share2 size={13} color={theme.colors.textPrimary} />
              <Text style={styles.shareCardBtnText}>{t('sharePnl')}</Text>
            </PressableScale>

            <View style={[styles.healthBadge, { backgroundColor: healthStatus.bg }]}>
              <Text style={[styles.healthText, { color: healthStatus.color }]}>
                {healthStatus.label}
              </Text>
            </View>
          </View>
        </View>

        {/* HERO NET P&L — big terminal readout with counting animation */}
        <View style={styles.heroPnlBlock}>
          <Text style={styles.heroPnlLabel}>{t('netPnlTotal')}</Text>
          <AnimatedNumber
            value={m.netPnL}
            format={v => formatCurrency(v, { thousandsSeparator: true })}
            style={[
              styles.heroPnlValue,
              { color: isPositive ? theme.colors.greenLight : theme.colors.redLight },
            ]}
            duration={1100}
          />
        </View>

        {/* Market Sessions + Session Timer (isolated 1s clock) */}
        <MarketSessionsBar />
      </Animated.View>

      {/* ── 2. DAILY RISK GAUGE (NEW) ── */}
      <DailyRiskGauge trades={trades} account={activeAccount} />

      {/* ── 3. LOCK GUARD ALERT (SI VERROUILLÉ) ── */}
      {isLocked && (
        <Animated.View entering={FadeInUp.duration(400)} style={styles.lockBanner}>
          <ShieldAlert color={theme.colors.redLight} size={20} />
          <View style={styles.lockContent}>
            <Text style={styles.lockTitle}>SESSION QUOTIDIENNE VERROUILLÉE</Text>
            <Text style={styles.lockDesc}>
              {lock?.lock_reason || t('lockReasonFallback')}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── EMPTY STATE — first launch, no trades yet ── */}
      {m.totalTrades === 0 && (
        <Card animated delay={80}>
          <EmptyState
            icon={<BookOpen size={22} color={theme.colors.primaryLight} />}
            title={t('emptyDashTitle')}
            description={t('emptyDashDesc')}
            actionLabel={t('emptyDashCta')}
            onAction={() => navigation.navigate('Trades')}
          />
        </Card>
      )}

      {/* ── 4. KPI SUMMARY CARDS GRID ── */}
      <View style={styles.kpiGrid}>
        <KpiCard
          label={t('netPnlTotal')}
          value={formatCurrency(m.netPnL, { thousandsSeparator: true })}
          numericValue={m.netPnL}
          format={v => formatCurrency(v, { thousandsSeparator: true })}
          valueColor={isPositive ? theme.colors.greenLight : theme.colors.redLight}
          trend={isPositive ? 'up' : 'down'}
          delay={0}
          sub={`${m.totalTrades} ${t('positions')}`}
        />
        <KpiCard
          label={t('winRateGlobal')}
          value={`${m.winRate.toFixed(1)}%`}
          numericValue={m.winRate}
          format={v => `${v.toFixed(1)}%`}
          valueColor={m.winRate >= 50 ? theme.colors.greenLight : theme.colors.redLight}
          trend={m.winRate >= 50 ? 'up' : 'down'}
          delay={60}
          sub={
            <Text>
              <Text style={styles.greenText}>{m.winCount}W</Text> · <Text style={styles.redText}>{m.lossCount}L</Text>
            </Text>
          }
        />
      </View>

      <View style={styles.kpiGrid}>
        <KpiCard
          label={t('profitFactor')}
          value={m.profitFactor === Infinity ? '∞' : m.profitFactor.toFixed(2)}
          numericValue={m.profitFactor === Infinity ? 99.99 : m.profitFactor}
          format={v => (v >= 99.99 ? '∞' : v.toFixed(2))}
          valueColor={theme.colors.primaryLight}
          delay={120}
          sub={`G: ${formatCurrency(m.grossProfit, { showPlus: false, decimals: 0 })} · P: ${formatCurrency(m.grossLoss, { showPlus: false, decimals: 0 })}`}
        />
        <KpiCard
          label={t('profitLossRatio')}
          value={`${m.avgLoss !== 0 ? (m.avgWin / m.avgLoss).toFixed(2) : '1.00'}x`}
          numericValue={m.avgLoss !== 0 ? m.avgWin / m.avgLoss : 1}
          format={v => `${v.toFixed(2)}x`}
          valueColor={theme.colors.cyan}
          delay={180}
          sub={`${formatCurrency(m.avgWin, { decimals: 0 })} / ${formatCurrency(-m.avgLoss, { decimals: 0 })}`}
        />
      </View>

      {/* ── 5. COURBE D'ÉQUITÉ LIVE & P&L QUOTIDIEN BARS BICOLORE ── */}
      <Card title={t('equityLive')}>
        <GlowingEquityAreaChart
          data={m.equityCurve.length > 0 ? m.equityCurve.map(e => ({ date: e.date, value: e.pnl })) : [{ date: '0', value: 0 }]}
          height={190}
        />
      </Card>

      {m.dailyPnL.length > 0 && (
        <Card title={t('dailyPnl')}>
          <BicolorBarChart
            data={m.dailyPnL.map(d => ({
              label: d.date,
              value: d.pnl,
            }))}
            height={160}
          />
        </Card>
      )}

      {/* ── 6. STREAK TRACKER BANNER ── */}
      {m.streak.current > 0 && (
        <Animated.View
          entering={FadeInUp.duration(420).springify().damping(16)}
          style={[
            styles.streakBanner,
            m.streak.type === 'win' ? styles.streakWin : styles.streakLoss,
          ]}
        >
          <View style={styles.streakIconWrap}>
            {m.streak.type === 'win' ? (
              <Flame size={18} color={theme.colors.gold} />
            ) : (
              <Snowflake size={18} color={theme.colors.cyan} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.streakTitle}>
              {m.streak.type === 'win' ? t('winStreak') : t('lossStreak')}
            </Text>
            <Text style={[styles.streakCount, m.streak.type === 'win' ? styles.goldText : styles.redText]}>
              {m.streak.current} <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{t('consecutiveDays')}</Text>
            </Text>
          </View>
          {m.streak.best > 0 && (
            <Badge label={t('recordDays', m.streak.best)} variant="gold" />
          )}
        </Animated.View>
      )}

      {/* ── 6. CHECKLIST PRÉ-SESSION (PERSONNALISABLE & SYNCHRONISÉE) ── */}
      <ChecklistCard />

      {/* ── 6b. ACHIEVEMENTS ── */}
      <AchievementsCard />

      {/* ── 6c. POSITION CALCULATOR ── */}
      <PositionCalculator />

      {/* ── 7. DETAILED METRICS BREAKDOWN ── */}
      <Card title={t('financialMetrics')}>
        <StatRow
          label={t('bestTrade')}
          value={m.bestTrade?.pnl ? formatCurrency(m.bestTrade.pnl) : '—'}
          valueColor={theme.colors.greenLight}
        />
        <StatRow
          label={t('worstTrade')}
          value={m.worstTrade?.pnl ? formatCurrency(m.worstTrade.pnl) : '—'}
          valueColor={theme.colors.redLight}
        />
        <StatRow
          label={t('avgRMultiple')}
          value={`${m.avgRMultiple >= 0 ? '+' : ''}${m.avgRMultiple.toFixed(2)} R`}
          valueColor={m.avgRMultiple >= 0 ? theme.colors.greenLight : theme.colors.redLight}
        />
        <StatRow
          label={t('consistencyScoreKpi')}
          value={`${m.consistency.score.toFixed(1)}% ${m.consistency.alert ? '>15%' : t('conform')}`}
          valueColor={m.consistency.alert ? theme.colors.redLight : theme.colors.greenLight}
        />
        <StatRow
          label={t('maxDrawdownLabel')}
          value={formatCurrency(-m.maxDrawdown)}
          valueColor={theme.colors.redLight}
          showBorder={false}
        />
      </Card>

      {/* ── 8. PERFORMANCE MENSUELLE (100% PARITÉ WEB) ── */}
      <Card title={t('monthlyPerformance')}>
        {m.monthlyPerformance.length === 0 ? (
          <Text style={styles.emptyText}>{t('noDataAvailable')}</Text>
        ) : (
          <BicolorBarChart
            data={m.monthlyPerformance.map(e => ({
              label: e.month,
              value: e.pnl,
            }))}
            height={170}
          />
        )}
      </Card>

      {/* ── 9. RECENT TRADES SECTION ── */}
      <Card title={t('lastTrades')}>
        {m.recentTrades.length === 0 ? (
          <Text style={styles.emptyText}>{t('noRecentTrades')}</Text>
        ) : (
          m.recentTrades.map((t: Trade) => (
            <View key={t.id} style={styles.recentRow}>
              <View>
                <View style={styles.flexRow}>
                  <Text style={styles.recentPair}>{t.pair}</Text>
                  <Badge label={t.direction} variant={t.direction === 'BUY' ? 'blue' : 'gold'} />
                </View>
                <Text style={styles.recentDate}>
                  {new Date(t.entry_time).toLocaleDateString(localeFor(lang))} {new Date(t.entry_time).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              <View style={styles.alignRight}>
                <Text style={[styles.recentPnl, (t.pnl || 0) >= 0 ? styles.greenText : styles.redText]}>
                  {t.pnl !== null ? formatCurrency(t.pnl) : 'OPEN'}
                </Text>
                <Badge label={t.result} variant={t.result === 'TP' ? 'green' : t.result === 'SL' ? 'red' : 'neutral'} />
              </View>
            </View>
          ))
        )}
      </Card>

      {/* Share P&L Card Modal */}
      <ShareCardModal
        visible={shareModalVisible}
        onClose={() => setShareModalVisible(false)}
        trades={trades}
        accountName={accounts.find(a => a.id === trades[0]?.account_id)?.name || 'Compte Principal'}
      />
    </ScrollView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  shareCardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  shareCardBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  center: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 22, 31, 0.95)',
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    marginBottom: theme.spacing.md,
  },
  tickerLabel: {
    color: theme.colors.primaryLight,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    marginRight: theme.spacing.sm,
  },
  tickerScroll: {
    flex: 1,
  },
  tickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    borderRightColor: theme.colors.cardBorder,
    borderRightWidth: 1,
  },
  tickerPair: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
  },
  tickerBuy: {
    color: theme.colors.primaryLight,
    fontSize: 9,
    fontWeight: '800',
  },
  tickerSell: {
    color: theme.colors.goldLight,
    fontSize: 9,
    fontWeight: '800',
  },
  tickerR: {
    color: theme.colors.goldLight,
    fontSize: 10,
    fontWeight: '800',
  },
  heroBanner: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  greetingTitle: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontFamily: theme.fonts.sansExtraBold,
    marginRight: 6,
  },
  greetingSub: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: theme.fonts.sansMedium,
    marginTop: 2,
  },
  healthBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.full,
  },
  healthText: {
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.5,
  },
  heroPnlBlock: {
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
  },
  heroPnlLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  heroPnlValue: {
    fontSize: 34,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  lockContent: {
    flex: 1,
  },
  lockTitle: {
    color: theme.colors.redLight,
    fontSize: 12,
    fontFamily: theme.fonts.sansBold,
  },
  lockDesc: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.sans,
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  kpiLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  kpiValueLarge: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
  },
  kpiValue: {
    color: theme.colors.textPrimary,
    fontSize: 17,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
  },
  kpiSub: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.sansMedium,
    marginTop: 4,
  },
  greenText: {
    color: theme.colors.greenLight,
  },
  redText: {
    color: theme.colors.redLight,
  },
  goldText: {
    color: theme.colors.goldLight,
  },
  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  streakWin: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  streakLoss: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  streakIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  streakTitle: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },
  streakCount: {
    fontSize: 18,
    fontFamily: theme.fonts.monoExtraBold,
    fontVariant: ['tabular-nums'],
  },
  tabHeaders: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
    paddingBottom: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tabBtn: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  tabBtnActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    borderColor: theme.colors.primary,
    borderWidth: 1,
  },
  tabBtnText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
  },
  tabBtnTextActive: {
    color: theme.colors.primaryLight,
  },
  ratioBarLong: {
    backgroundColor: theme.colors.green,
    height: '100%',
  },
  ratioBarShort: {
    backgroundColor: theme.colors.primary,
    height: '100%',
  },
  ratioSub: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  breakdownLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  breakdownVal: {
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  recentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  recentPair: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.sansBold,
    marginRight: theme.spacing.sm,
  },
  recentDate: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 2,
  },
  recentPnl: {
    fontSize: 14,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.sans,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.md,
  },
  flexRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alignRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
});
