import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
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
  Globe,
  ShieldAlert,
  Play,
  Square,
  Share2,
  Flame,
  Snowflake,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react-native';
import { ShareCardModal } from '../components/share/ShareCardModal';
import { TradeDetailModal } from '../components/trades/TradeDetailModal';
import { ChecklistCard } from '../components/dashboard/ChecklistCard';
import { PositionCalculator } from '../components/trades/PositionCalculator';
import { AchievementsCard } from '../components/dashboard/AchievementsCard';
import { formatCurrency } from '../utils/formatCurrency';
import { KpiCard } from '../components/ui/KpiCard';
import { StatRow } from '../components/ui/StatRow';
import { RadialGaugeSpeedometer } from '../components/charts/RadialGaugeSpeedometer';
import { PressableScale } from '../components/ui/PressableScale';

function getMarketSessions(date: Date) {
  const utcHour = date.getUTCHours();
  return [
    { key: 'sessionAsia',    name: 'Asia',     open: utcHour >= 0  && utcHour < 9  },
    { key: 'sessionLondon',  name: 'London',   open: utcHour >= 7  && utcHour < 16 },
    { key: 'sessionNewYork', name: 'New York', open: utcHour >= 12 && utcHour < 21 },
  ];
}

export const DashboardScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trades, isLoading: tradesLoading } = useTrades();
  const { accounts, isLoading: accountsLoading } = useAccounts();

  const { isLocked, lock } = useDailyLock();
  const m = usePerformanceMetrics(trades, lang);

  const [now, setNow] = useState(new Date());
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  const [sessionActive, setSessionActive] = useState(false);
  const [sessionStart, setSessionStart] = useState<Date | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
      if (sessionActive && sessionStart) {
        setSessionElapsed(Math.floor((Date.now() - sessionStart.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionActive, sessionStart]);

  const toggleSession = () => {
    if (sessionActive) {
      setSessionActive(false);
      setSessionStart(null);
      setSessionElapsed(0);
    } else {
      setSessionActive(true);
      setSessionStart(new Date());
    }
  };

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const min = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const sessionOverLimit = sessionElapsed >= 4 * 3600;
  const marketSessions = useMemo(() => getMarketSessions(now), [now]);

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
    const todayStr = new Date().toISOString().split('T')[0];
    return trades.filter(t => t.entry_time && t.entry_time.startsWith(todayStr)).length;
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

      {/* ── 1. HERO BANNER & SESSIONS OVERVIEW ── */}
      <View style={styles.heroBanner}>
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
            <TouchableOpacity
              style={styles.shareCardBtn}
              onPress={() => setShareModalVisible(true)}
              activeOpacity={0.8}
            >
              <Share2 size={13} color={theme.colors.textPrimary} />
              <Text style={styles.shareCardBtnText}>{t('sharePnl')}</Text>
            </TouchableOpacity>

            <View style={[styles.healthBadge, { backgroundColor: healthStatus.bg }]}>
              <Text style={[styles.healthText, { color: healthStatus.color }]}>
                {healthStatus.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Market Sessions Pills & Clock */}
        <View style={styles.sessionsRow}>
          <View style={styles.sessionsWrapper}>
            <Globe color={theme.colors.textMuted} size={14} style={{ marginRight: 4 }} />
            {marketSessions.map(s => (
              <View
                key={s.name}
                style={[
                  styles.sessionPill,
                  s.open ? styles.sessionOpen : styles.sessionClosed,
                ]}
              >
                <Text
                  style={[
                    styles.sessionText,
                    s.open ? styles.sessionTextOpen : styles.sessionTextClosed,
                  ]}
                >
                  {t(s.key as any)}
                </Text>
              </View>
            ))}
          </View>

          {/* Session Timer Widget */}
          <TouchableOpacity
            style={[
              styles.sessionTimerBtn,
              sessionActive ? (sessionOverLimit ? styles.timerRed : styles.timerGreen) : styles.timerNeutral,
            ]}
            onPress={toggleSession}
          >
            {sessionActive ? <Square color={theme.colors.textPrimary} size={12} /> : <Play color={theme.colors.textPrimary} size={12} />}
            <Text style={styles.sessionTimerText}>
              {sessionActive ? formatElapsed(sessionElapsed) : 'Session'}
            </Text>
            {sessionOverLimit && (
              <View style={styles.alertMiniRow}>
                <AlertTriangle size={10} color={theme.colors.gold} />
                <Text style={styles.alertMini}>4H+</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 3. LOCK GUARD ALERT (SI VERROUILLÉ) ── */}
      {isLocked && (
        <View style={styles.lockBanner}>
          <ShieldAlert color={theme.colors.redLight} size={20} />
          <View style={styles.lockContent}>
            <Text style={styles.lockTitle}>SESSION QUOTIDIENNE VERROUILLÉE</Text>
            <Text style={styles.lockDesc}>
              {lock?.lock_reason || t('lockReasonFallback')}
            </Text>
          </View>
        </View>
      )}

      {/* ── 4. KPI SUMMARY CARDS GRID ── */}
      <View style={styles.kpiGrid}>
        <KpiCard
          label={t('netPnlTotal')}
          value={formatCurrency(m.netPnL, { thousandsSeparator: true })}
          numValue={m.netPnL}
          prefix={m.netPnL >= 0 ? '+$' : '-$'}
          decimals={2}
          valueColor={isPositive ? theme.colors.greenLight : theme.colors.redLight}
          sub={`${m.totalTrades} ${t('positions')}`}
          glow={isPositive ? 'green' : 'red'}
        />
        <KpiCard
          label={t('winRateGlobal')}
          value={`${m.winRate.toFixed(1)}%`}
          numValue={m.winRate}
          suffix="%"
          decimals={1}
          valueColor={m.winRate >= 50 ? theme.colors.greenLight : theme.colors.redLight}
          glow="cyan"
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
          numValue={m.profitFactor === Infinity ? undefined : m.profitFactor}
          decimals={2}
          valueColor={theme.colors.primaryLight}
          glow="purple"
          sub={`G: ${formatCurrency(m.grossProfit, { showPlus: false, decimals: 0 })} · P: ${formatCurrency(m.grossLoss, { showPlus: false, decimals: 0 })}`}
        />
        <KpiCard
          label={t('profitLossRatio')}
          value={`${m.avgLoss !== 0 ? (m.avgWin / m.avgLoss).toFixed(2) : '1.00'}x`}
          numValue={m.avgLoss !== 0 ? m.avgWin / m.avgLoss : 1}
          suffix="x"
          decimals={2}
          valueColor={theme.colors.goldLight}
          glow="gold"
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
        <View
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
        </View>
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

      {/* ── 9. RECENT TRADES SECTION (RICH DETAILS) ── */}
      <Card title={t('lastTrades')}>
        {m.recentTrades.length === 0 ? (
          <Text style={styles.emptyText}>{t('noRecentTrades')}</Text>
        ) : (
          m.recentTrades.map((trade: Trade) => {
            const isWin = (trade.pnl || 0) > 0;
            const isLoss = (trade.pnl || 0) < 0;
            const isOpen = trade.pnl === null;
            const acc = accounts.find(a => a.id === trade.account_id);
            const isFutures = (acc as any)?.instrument_type === 'Futures';

            return (
              <PressableScale
                key={trade.id}
                style={styles.recentTradeCard}
                onPress={() => setSelectedTrade(trade)}
              >
                {/* Left Indicator Strip */}
                <View
                  style={[
                    styles.recentStrip,
                    isWin && styles.stripWin,
                    isLoss && styles.stripLoss,
                    isOpen && styles.stripOpen,
                  ]}
                />

                <View style={styles.recentCardContent}>
                  {/* Top Row: Symbol, Direction, Size, PnL */}
                  <View style={styles.recentHeaderRow}>
                    <View style={styles.recentPairWrap}>
                      <Text style={styles.recentPairText}>{trade.pair}</Text>
                      <Badge
                        label={trade.direction}
                        variant={trade.direction === 'BUY' ? 'green' : 'blue'}
                        size="sm"
                      />
                      <Text style={styles.recentLotText}>
                        {trade.size || 1} {isFutures ? t('contracts') : t('lots')}
                      </Text>
                    </View>

                    <View style={styles.recentPnlWrap}>
                      <Text
                        style={[
                          styles.recentPnlVal,
                          isWin && styles.greenText,
                          isLoss && styles.redText,
                          isOpen && styles.goldText,
                        ]}
                      >
                        {!isOpen ? formatCurrency(trade.pnl!) : t('openTradeStatus')}
                      </Text>
                      {isWin ? (
                        <ArrowUpRight size={13} color={theme.colors.greenLight} />
                      ) : isLoss ? (
                        <ArrowDownRight size={13} color={theme.colors.redLight} />
                      ) : null}
                    </View>
                  </View>

                  {/* Middle Row: Setup & R:R */}
                  <View style={styles.recentMiddleRow}>
                    {(() => {
                      const realSetups = (trade.setup_structures || []).filter(s => s !== 'BOS' && s !== 'TF');
                      if (realSetups.length > 0) {
                        return <Text style={styles.recentSetupText} numberOfLines={1}>{realSetups.join(' · ')}</Text>;
                      }
                      return null;
                    })()}
                    {trade.r_multiple !== null && (
                      <Badge
                        label={`${trade.r_multiple >= 0 ? '+' : ''}${trade.r_multiple.toFixed(1)}R`}
                        variant={trade.r_multiple > 0 ? 'gold' : trade.r_multiple < 0 ? 'red' : 'neutral'}
                        size="sm"
                        style={{ marginLeft: 'auto' }}
                      />
                    )}
                  </View>

                  {/* Footer: Account, Entry & Exit Date/Time, Result */}
                  <View style={styles.recentFooterRow}>
                    <View style={styles.recentAccDateWrap}>
                      {acc && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.recentAccName} numberOfLines={1}>{acc.name}</Text>
                          <Badge label={isFutures ? 'FUTURES' : 'CFD'} variant={isFutures ? 'gold' : 'blue'} size="sm" />
                        </View>
                      )}
                      <Text style={styles.recentDateDetails}>
                        IN: {new Date(trade.entry_time).toLocaleDateString(localeFor(lang))} {new Date(trade.entry_time).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' })}
                        {trade.exit_time && ` · OUT: ${new Date(trade.exit_time).toLocaleDateString(localeFor(lang))} ${new Date(trade.exit_time).toLocaleTimeString(localeFor(lang), { hour: '2-digit', minute: '2-digit' })}`}
                      </Text>
                    </View>
                    <Badge
                      label={trade.result || (isOpen ? 'OPEN' : 'CLOSED')}
                      variant={trade.result === 'TP' ? 'green' : trade.result === 'SL' ? 'red' : 'neutral'}
                      size="sm"
                    />
                  </View>
                </View>
              </PressableScale>
            );
          })
        )}
      </Card>

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <TradeDetailModal
          trade={selectedTrade}
          visible={!!selectedTrade}
          onClose={() => setSelectedTrade(null)}
          onEdit={() => {}}
          onDelete={() => {}}
        />
      )}

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
  sessionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sessionsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    flex: 1,
  },
  sessionPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
  },
  sessionOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  sessionClosed: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
  },
  sessionText: {
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  sessionTextOpen: {
    color: theme.colors.greenLight,
  },
  sessionTextClosed: {
    color: theme.colors.textMuted,
  },
  sessionTimerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.md,
  },
  timerGreen: {
    backgroundColor: theme.colors.primary,
  },
  timerRed: {
    backgroundColor: theme.colors.red,
  },
  timerNeutral: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
  },
  sessionTimerText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  alertMiniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  alertMini: {
    color: theme.colors.textPrimary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
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
  recentTradeCard: {
    flexDirection: 'row',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    marginBottom: theme.spacing.sm,
    overflow: 'hidden',
  },
  recentStrip: {
    width: 4,
    backgroundColor: theme.colors.primaryLight,
  },
  stripWin: {
    backgroundColor: theme.colors.green,
  },
  stripLoss: {
    backgroundColor: theme.colors.red,
  },
  stripOpen: {
    backgroundColor: theme.colors.gold,
  },
  recentCardContent: {
    flex: 1,
    padding: 10,
  },
  recentHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  recentPairWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  recentPairText: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.sansBold,
  },
  recentLotText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
  },
  recentPnlWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recentPnlVal: {
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  recentMiddleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  recentSetupText: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.sansSemiBold,
  },
  recentFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
  },
  recentAccDateWrap: {
    flex: 1,
    marginRight: 6,
  },
  recentAccName: {
    color: theme.colors.textPrimary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  recentDateDetails: {
    color: theme.colors.textMuted,
    fontSize: 8,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 2,
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
