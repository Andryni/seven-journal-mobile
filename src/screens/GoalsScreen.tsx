import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, Dimensions,
} from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useTrades } from '../features/trades/useTrades';
import { usePerformanceMetrics } from '../features/dashboard/usePerformanceMetrics';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT, useI18nStore } from '../i18n';
import { Card } from '../components/ui/Card';
import { KpiCard } from '../components/ui/KpiCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Target, TrendingUp, Edit3, X, Check,
  AlertTriangle, Flame, Trophy,
} from 'lucide-react-native';

const screenWidth = Dimensions.get('window').width;

interface MonthlyGoal {
  pnlTarget: number;
  winRateTarget: number;
  maxTradesPerDay: number;
  maxDrawdownPercent: number;
  label: string;
}

const DEFAULT_GOAL: MonthlyGoal = {
  pnlTarget: 1000,
  winRateTarget: 60,
  maxTradesPerDay: 3,
  maxDrawdownPercent: 5,
  label: '',
};

function getStorageKey() {
  const now = new Date();
  return `seven_goals_${now.getFullYear()}_${now.getMonth()}`;
}

// ─── Progress Ring ────────────────────────────────────────────────────────────
const ProgressRing: React.FC<{
  progress: number; color: string; label: string; value: string; theme: AppTheme;
  size?: number; delay?: number;
}> = ({ progress, color, label, value, theme, size = 80, delay = 0 }) => {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(Math.max(progress, 0), 100);
  const offset = circ - (pct / 100) * circ;

  return (
    <Animated.View entering={FadeIn.delay(delay).duration(400)} style={{ alignItems: 'center', width: 90 }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={`rg-${label}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="1" />
            <Stop offset="1" stopColor={color} stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.colors.surface} strokeWidth={7} />
        <Circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={`url(#rg-${label})`} strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <SvgText
          x={size / 2} y={size / 2 + 4} textAnchor="middle"
          fill={theme.colors.textPrimary} fontSize={13} fontWeight="900"
        >
          {Math.round(pct)}%
        </SvgText>
      </Svg>
      <Text style={{ color: theme.colors.textMuted, fontSize: 8, fontFamily: theme.fonts.monoBold, marginTop: 4, letterSpacing: 0.5, textAlign: 'center' }}>
        {label}
      </Text>
      <Text style={{ color: theme.colors.textPrimary, fontSize: 10, fontFamily: theme.fonts.monoBold, marginTop: 2 }}>
        {value}
      </Text>
    </Animated.View>
  );
};

// ─── Goal Bar ─────────────────────────────────────────────────────────────────
const GoalBar: React.FC<{
  label: string; current: number; target: number; unit: string;
  color: string; theme: AppTheme; reverse?: boolean; delay?: number;
}> = ({ label, current, target, unit, color, theme, reverse = false, delay = 0 }) => {
  const pct = target > 0 ? Math.min(Math.abs(current) / target * 100, 100) : 0;
  const isGood = reverse ? current <= target : current >= target;

  return (
    <Animated.View entering={FadeIn.delay(delay).duration(400)} style={{ marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontFamily: theme.fonts.monoMedium }}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ color: isGood ? theme.colors.green : theme.colors.textPrimary, fontSize: 12, fontFamily: theme.fonts.monoBold }}>
            {current.toLocaleString('en-US', { maximumFractionDigits: 1 })}{unit}
          </Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 10 }}>/</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 11, fontFamily: theme.fonts.monoMedium }}>
            {target.toLocaleString('en-US', { maximumFractionDigits: 0 })}{unit}
          </Text>
          {isGood && <Check size={12} color={theme.colors.green} />}
        </View>
      </View>
      <View style={{ height: 7, backgroundColor: theme.colors.surface, borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ height: '100%', borderRadius: 4, width: `${pct}%`, backgroundColor: color }} />
      </View>
      <Text style={{ color: theme.colors.textMuted, fontSize: 9, fontFamily: theme.fonts.monoMedium, textAlign: 'right', marginTop: 3 }}>
        {pct.toFixed(0)}%
      </Text>
    </Animated.View>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────
export const GoalsScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const lang = useI18nStore(s => s.lang);
  const locale = lang === 'en' ? 'en-US' : 'fr-FR';
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trades } = useTrades();
  const m = usePerformanceMetrics(trades, lang);

  const [goal, setGoal] = useState<MonthlyGoal>(DEFAULT_GOAL);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<MonthlyGoal>(DEFAULT_GOAL);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(getStorageKey());
        if (stored) setGoal(JSON.parse(stored));
      } catch { /* ignore */ }
    })();
  }, []);

  const save = () => {
    setGoal(draft);
    AsyncStorage.setItem(getStorageKey(), JSON.stringify(draft));
    setEditing(false);
  };

  // Current month stats
  const now = new Date();
  const monthName = now.toLocaleDateString(locale, { month: 'long', year: 'numeric' });

  const currentMonthPnL = useMemo(() => {
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return m.dailyPnL
      .filter(d => d.date.startsWith(monthStr) || d.date.includes(monthStr))
      .reduce((sum, d) => sum + d.pnl, 0);
  }, [m.dailyPnL]);

  const pnlPct = goal.pnlTarget > 0 ? (currentMonthPnL / goal.pnlTarget) * 100 : 0;
  const wrPct = goal.winRateTarget > 0 ? (m.winRate / goal.winRateTarget) * 100 : 0;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(350)} style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.screenTitle}>{t('goalsTitle')}</Text>
          <Text style={styles.screenSubtitle}>{monthName}</Text>
        </View>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { setDraft(goal); setEditing(true); }}
          activeOpacity={0.8}
        >
          <Edit3 size={13} color={theme.colors.primaryLight} />
          <Text style={styles.editBtnText}>{t('editGoals')}</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Progress Rings */}
      <Card title={t('goalsOverview')}>
        <View style={styles.ringsRow}>
          <ProgressRing progress={pnlPct} color={theme.colors.green} label={t('goalsPnlTarget')} value={`$${currentMonthPnL.toFixed(0)}/${goal.pnlTarget}`} theme={theme} delay={0} />
          <ProgressRing progress={wrPct} color={theme.colors.primary} label="Win Rate" value={`${m.winRate.toFixed(1)}%/${goal.winRateTarget}%`} theme={theme} delay={80} />
          <ProgressRing progress={m.streak.type === 'win' ? Math.min(m.streak.current * 20, 100) : 0} color={theme.colors.gold} label={t('goalsWinStreak')} value={`${m.streak.current}${lang === 'en' ? 'd' : 'j'} 🔥`} theme={theme} delay={160} />
          <ProgressRing
            progress={goal.maxDrawdownPercent > 0 ? Math.max(100 - (m.maxDrawdown / (goal.maxDrawdownPercent * 100)) * 100, 0) : 100}
            color={theme.colors.cyan}
            label={t('goalsDDControl')}
            value={`$${m.maxDrawdown.toFixed(0)} DD`}
            theme={theme}
            delay={240}
          />
        </View>
      </Card>

      {/* Detailed Bars */}
      <View style={styles.barsGrid}>
        <Card title={t('goalsPerformance')}>
          <GoalBar label="P&L" current={currentMonthPnL} target={goal.pnlTarget} unit="$" color={theme.colors.green} theme={theme} delay={0} />
          <GoalBar label="Win Rate" current={m.winRate} target={goal.winRateTarget} unit="%" color={theme.colors.primary} theme={theme} delay={100} />
          <GoalBar label="Profit Factor" current={m.profitFactor} target={2} unit="x" color={theme.colors.cyan} theme={theme} delay={200} />
        </Card>

        <Card title={t('goalsDiscipline')}>
          <GoalBar label="Consistency" current={100 - m.consistency.score} target={85} unit="%" color={theme.colors.gold} theme={theme} delay={0} />
          <GoalBar label={t('goalsMaxDD')} current={Math.max(0, goal.maxDrawdownPercent * 100 - m.maxDrawdown)} target={goal.maxDrawdownPercent * 100} unit="$" color="#8b5cf6" theme={theme} delay={100} />
        </Card>
      </View>

      {/* Motivational Banner */}
      <Animated.View entering={FadeIn.delay(300).duration(400)} style={styles.motivBanner}>
        <View style={styles.motivIcon}>
          {pnlPct >= 100 ? <Trophy size={24} color={theme.colors.gold} /> :
           pnlPct >= 50 ? <Flame size={24} color={theme.colors.green} /> :
           <Target size={24} color={theme.colors.primary} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.motivTitle}>
            {pnlPct >= 100 ? t('goalsAchieved') :
             pnlPct >= 50 ? t('goalsHalfway') :
             t('goalsStayDisciplined')}
          </Text>
          <Text style={styles.motivSub}>
            {currentMonthPnL >= 0 ? '+' : ''}${currentMonthPnL.toFixed(2)} / ${goal.pnlTarget}
          </Text>
        </View>
      </Animated.View>

      {/* Edit Modal */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setEditing(false)}>
          <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('goalsEditTitle')}</Text>
              <TouchableOpacity onPress={() => setEditing(false)}>
                <X size={20} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>

            {[
              { label: t('goalsLabel'), key: 'label' as const, type: 'text' },
              { label: t('goalsPnlTargetLabel'), key: 'pnlTarget' as const, type: 'number' },
              { label: t('goalsWinRateLabel'), key: 'winRateTarget' as const, type: 'number' },
              { label: t('goalsMaxTradesLabel'), key: 'maxTradesPerDay' as const, type: 'number' },
              { label: t('goalsMaxDDLabel'), key: 'maxDrawdownPercent' as const, type: 'number' },
            ].map(({ label, key, type }) => (
              <View key={key} style={{ marginBottom: 12 }}>
                <Text style={styles.modalLabel}>{label}</Text>
                <TextInput
                  style={styles.modalInput}
                  value={String((draft as any)[key])}
                  onChangeText={val => setDraft(prev => ({ ...prev, [key]: type === 'number' ? parseFloat(val) || 0 : val }))}
                  keyboardType={type === 'number' ? 'numeric' : 'default'}
                />
              </View>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditing(false)}>
                <Text style={styles.modalCancelText}>{t('goalsCancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={save}>
                <Text style={styles.modalSaveText}>{t('goalsSave')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background, paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.md },
  screenTitle: { color: theme.colors.textPrimary, fontSize: 18, fontFamily: theme.fonts.sansExtraBold, letterSpacing: 1 },
  screenSubtitle: { color: theme.colors.primaryLight, fontSize: 10, fontFamily: theme.fonts.monoMedium, marginTop: 2 },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: theme.colors.primary + '20', borderWidth: 1, borderColor: theme.colors.primary + '40', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  editBtnText: { color: theme.colors.primaryLight, fontSize: 10, fontFamily: theme.fonts.monoBold },
  ringsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, flexWrap: 'wrap', gap: 12 },
  barsGrid: { gap: theme.spacing.md, marginBottom: theme.spacing.md },
  motivBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary + '25', borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 40 },
  motivIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  motivTitle: { color: theme.colors.textPrimary, fontSize: 13, fontFamily: theme.fonts.sansBold },
  motivSub: { color: theme.colors.textMuted, fontSize: 10, fontFamily: theme.fonts.monoMedium, marginTop: 2 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: theme.colors.modalBg, borderColor: theme.colors.cardBorder, borderWidth: 1, borderRadius: 18, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: theme.colors.textPrimary, fontSize: 15, fontFamily: theme.fonts.sansBold },
  modalLabel: { color: theme.colors.textSecondary, fontSize: 10, fontFamily: theme.fonts.monoBold, letterSpacing: 0.5, marginBottom: 6 },
  modalInput: { backgroundColor: theme.colors.inputBg, borderColor: theme.colors.cardBorder, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 42, color: theme.colors.textPrimary, fontSize: 13, fontFamily: theme.fonts.monoMedium },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.cardBorder, alignItems: 'center' },
  modalCancelText: { color: theme.colors.textMuted, fontSize: 12, fontFamily: theme.fonts.sansBold },
  modalSaveBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
  modalSaveText: { color: theme.colors.textPrimary, fontSize: 12, fontFamily: theme.fonts.sansBold },
});
