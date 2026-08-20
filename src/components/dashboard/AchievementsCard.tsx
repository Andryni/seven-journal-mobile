import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTrades } from '../../features/trades/useTrades';
import { usePerformanceMetrics } from '../../features/dashboard/usePerformanceMetrics';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT, type TFunction } from '../../i18n';
import { Card } from '../ui/Card';
import { Trophy, Lock, CheckCircle2 } from 'lucide-react-native';

// ─── Badge definitions ────────────────────────────────────────────────────────

interface BadgeDef {
  id: string;
  icon: string;
  labelKey: string;
  descKey: string;
  glowColor: string;
  check: (stats: BadgeStats) => boolean;
}

interface BadgeStats {
  totalTrades: number;
  winRate: number;
  bestStreak: number;
  currentStreak: number;
  profitFactor: number;
  netPnL: number;
  maxDrawdown: number;
  winCount: number;
  consistency: number;
  avgRMultiple: number;
}

const BADGES: BadgeDef[] = [
  { id: 'first_trade', icon: '🚀', labelKey: 'badgesFirstTrade', descKey: 'badgesFirstTradeDesc', glowColor: '#6366f1', check: (s) => s.totalTrades >= 1 },
  { id: 'ten_trades', icon: '📊', labelKey: 'badgesTenTrades', descKey: 'badgesTenTradesDesc', glowColor: '#3b82f6', check: (s) => s.totalTrades >= 10 },
  { id: 'fifty_trades', icon: '💼', labelKey: 'badgesFiftyTrades', descKey: 'badgesFiftyTradesDesc', glowColor: '#8b5cf6', check: (s) => s.totalTrades >= 50 },
  { id: 'first_win', icon: '✅', labelKey: 'badgesFirstWin', descKey: 'badgesFirstWinDesc', glowColor: '#10b981', check: (s) => s.winCount >= 1 },
  { id: 'win_rate_60', icon: '🎯', labelKey: 'badgesWR60', descKey: 'badgesWR60Desc', glowColor: '#10b981', check: (s) => s.winRate >= 60 && s.totalTrades >= 10 },
  { id: 'win_rate_70', icon: '🏹', labelKey: 'badgesWR70', descKey: 'badgesWR70Desc', glowColor: '#14b8a6', check: (s) => s.winRate >= 70 && s.totalTrades >= 20 },
  { id: 'streak_3', icon: '🔥', labelKey: 'badgesStreak3', descKey: 'badgesStreak3Desc', glowColor: '#f59e0b', check: (s) => s.bestStreak >= 3 },
  { id: 'streak_7', icon: '🌟', labelKey: 'badgesStreak7', descKey: 'badgesStreak7Desc', glowColor: '#f59e0b', check: (s) => s.bestStreak >= 7 },
  { id: 'profit_factor_2', icon: '⚡', labelKey: 'badgesPF2', descKey: 'badgesPF2Desc', glowColor: '#eab308', check: (s) => s.profitFactor >= 2 && s.totalTrades >= 10 },
  { id: 'pnl_1k', icon: '💰', labelKey: 'badgesPnl1k', descKey: 'badgesPnl1kDesc', glowColor: '#22c55e', check: (s) => s.netPnL >= 1000 },
  { id: 'pnl_10k', icon: '🏆', labelKey: 'badgesPnl10k', descKey: 'badgesPnl10kDesc', glowColor: '#fbbf24', check: (s) => s.netPnL >= 10000 },
  { id: 'iron_discipline', icon: '🛡️', labelKey: 'badgesIronDiscipline', descKey: 'badgesIronDisciplineDesc', glowColor: '#06b6d4', check: (s) => s.consistency < 15 && s.totalTrades >= 20 },
  { id: 'r_master', icon: '🧠', labelKey: 'badgesRMaster', descKey: 'badgesRMasterDesc', glowColor: '#a855f7', check: (s) => s.avgRMultiple >= 1.5 && s.totalTrades >= 15 },
];

// ─── Badge Card ──────────────────────────────────────────────────────────────

const BadgeItem: React.FC<{
  badge: BadgeDef;
  unlocked: boolean;
  index: number;
  theme: AppTheme;
  t: TFunction;
}> = ({ badge, unlocked, index, theme, t }) => {
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 40).duration(350)}
      style={[
        styles.badgeCard,
        unlocked
          ? { borderColor: badge.glowColor + '40', backgroundColor: badge.glowColor + '15' }
          : styles.badgeLocked,
      ]}
    >
      {!unlocked && (
        <View style={styles.lockOverlay}>
          <Lock size={12} color={theme.colors.textMuted} />
        </View>
      )}
      <Text style={styles.badgeIcon}>{unlocked ? badge.icon : '🔒'}</Text>
      <Text style={[styles.badgeLabel, !unlocked && styles.badgeLabelLocked]} numberOfLines={1}>
        {t(badge.labelKey as any)}
      </Text>
      <Text style={[styles.badgeDesc, !unlocked && styles.badgeDescLocked]} numberOfLines={1}>
        {t(badge.descKey as any)}
      </Text>
      {unlocked && <CheckCircle2 size={12} color="#10b981" />}
    </Animated.View>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const AchievementsCard: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trades } = useTrades();
  const m = usePerformanceMetrics(trades);

  const stats: BadgeStats = useMemo(
    () => ({
      totalTrades: m.totalTrades,
      winRate: m.winRate,
      bestStreak: m.streak.best,
      currentStreak: m.streak.current,
      profitFactor: m.profitFactor,
      netPnL: m.netPnL,
      maxDrawdown: m.maxDrawdown,
      winCount: m.winCount,
      consistency: m.consistency.score,
      avgRMultiple: m.avgRMultiple,
    }),
    [m],
  );

  const results = useMemo(() => BADGES.map((b) => ({ badge: b, unlocked: b.check(stats) })), [stats]);
  const unlockedCount = results.filter((r) => r.unlocked).length;

  return (
    <Card title={t('achievementsTitle')}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Trophy size={14} color={theme.colors.goldLight} />
          <Text style={styles.headerTitle}>{t('achievementsSubtitle')}</Text>
        </View>
        <Text style={styles.headerCount}>
          <Text style={styles.headerCountActive}>{unlockedCount}</Text> / {BADGES.length}
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View
          style={[
            styles.progressFill,
            { width: `${(unlockedCount / BADGES.length) * 100}%` },
          ]}
        />
      </View>

      {/* Badge grid */}
      <View style={styles.badgeGrid}>
        {results.map(({ badge, unlocked }, i) => (
          <BadgeItem key={badge.id} badge={badge} unlocked={unlocked} index={i} theme={theme} t={t} />
        ))}
      </View>
    </Card>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    headerTitle: {
      color: theme.colors.textSecondary,
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 0.6,
    },
    headerCount: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
    },
    headerCountActive: {
      color: theme.colors.goldLight,
      fontWeight: '800',
    },
    progressBar: {
      height: 4,
      backgroundColor: theme.colors.surface,
      borderRadius: 2,
      marginBottom: 16,
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.colors.goldLight,
      borderRadius: 2,
    },
    badgeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    badgeCard: {
      width: '30%',
      minWidth: 90,
      alignItems: 'center',
      padding: 10,
      borderRadius: theme.borderRadius.lg,
      borderWidth: 1,
      gap: 4,
    },
    badgeLocked: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.cardBorder,
      opacity: 0.5,
    },
    lockOverlay: {
      position: 'absolute',
      top: 8,
      right: 8,
    },
    badgeIcon: {
      fontSize: 24,
    },
    badgeLabel: {
      color: theme.colors.textPrimary,
      fontSize: 9,
      fontWeight: '800',
      textAlign: 'center',
    },
    badgeLabelLocked: {
      color: theme.colors.textMuted,
    },
    badgeDesc: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      textAlign: 'center',
    },
    badgeDescLocked: {
      opacity: 0.5,
    },
  });
