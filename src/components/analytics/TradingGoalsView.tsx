import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useHaptic } from '../../hooks/useHaptic';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import type { TFunction } from '../../i18n';
import { Card } from '../ui/Card';
import { ProgressRing } from '../../screens/AnalyticsScreen';
import type { TradingGoals } from '../../features/analytics/useTradingGoals';
import type { Trade } from '../../types/domain';

interface Props {
  goals: TradingGoals;
  updateGoals: (patch: Partial<TradingGoals>) => Promise<void>;
  resetGoals: () => Promise<void>;
  closed: Trade[];
  theme: AppTheme;
  t: TFunction;
}

export const TradingGoalsView: React.FC<Props> = ({ goals, updateGoals, resetGoals, closed, theme, t }) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goals);
  const { light: hapticLight } = useHaptic();
  const s = useState(() => createGoalStyles(theme))[0];

  useEffect(() => { setDraft(goals); }, [goals]);

  // Compute current week stats
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1);
  weekStart.setHours(0, 0, 0, 0);
  const weekTrades = closed.filter(tr => new Date(tr.exit_time || tr.entry_time).getTime() >= weekStart.getTime());
  const weekPnl = weekTrades.reduce((acc, tr) => acc + (tr.pnl || 0), 0);
  const weekWins = weekTrades.filter(tr => (tr.pnl || 0) > 0).length;
  const weekWr = weekTrades.length > 0 ? (weekWins / weekTrades.length) * 100 : 0;
  const weekDays = new Set(weekTrades.map(tr => new Date(tr.entry_time).toDateString())).size;
  const weekTradesPerDay = weekDays > 0 ? weekTrades.length / weekDays : 0;

  const pnlProgress = goals.weeklyPnlTarget > 0 ? Math.min(weekPnl / goals.weeklyPnlTarget, 1.5) : 0;
  const wrProgress = goals.winRateTarget > 0 ? Math.min(weekWr / goals.winRateTarget, 1.5) : 0;
  const tradesProgress = goals.dailyTradeCount > 0 ? Math.min(weekTradesPerDay / goals.dailyTradeCount, 1.5) : 0;

  const goalItems = [
    { label: t('tgWeeklyPnl'), current: `${weekPnl >= 0 ? '+' : '-'}$${Math.abs(weekPnl).toFixed(0)}`, target: `$${goals.weeklyPnlTarget}`, progress: pnlProgress, per: t('perWeek'), icon: '💰', achieved: weekPnl >= goals.weeklyPnlTarget },
    { label: t('tgWinRate'), current: `${weekWr.toFixed(1)}%`, target: `${goals.winRateTarget}%`, progress: wrProgress, per: '', icon: '🎯', achieved: weekWr >= goals.winRateTarget },
    { label: t('tgTrades'), current: `${weekTradesPerDay.toFixed(1)}`, target: `${goals.dailyTradeCount}`, progress: tradesProgress, per: t('perDay'), icon: '📊', achieved: weekTradesPerDay >= goals.dailyTradeCount },
  ];

  const statusIcon = (achieved: boolean, prog: number) => {
    if (achieved) return <Text style={{ fontSize: 14 }}>✅</Text>;
    if (prog > 0.5) return <Text style={{ fontSize: 14 }}>🔄</Text>;
    return <Text style={{ fontSize: 14 }}>⏳</Text>;
  };

  const drawdownUnit = draft.maxDrawdownUnit;

  const [isSavingGoals, setIsSavingGoals] = useState(false);

  if (editing) {
    return (
      <>
        <Animated.View entering={FadeIn.delay(0).duration(350)}>
          <Card title={t('tgEdit')}>
            {/* Weekly P&L */}
            <View style={s.editRow}>
              <Text style={s.editLabel}>💰 {t('weeklyPnlTarget')}</Text>
              <TextInput style={s.editInput} keyboardType="decimal-pad" value={String(draft.weeklyPnlTarget)} onChangeText={(v: string) => setDraft(d => ({ ...d, weeklyPnlTarget: parseFloat(v.replace(',', '.')) || 0 }))} />
            </View>
            {/* Win Rate */}
            <View style={s.editRow}>
              <Text style={s.editLabel}>🎯 {t('winRateTarget')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TextInput style={[s.editInput, { width: 60 }]} keyboardType="decimal-pad" value={String(draft.winRateTarget)} onChangeText={(v: string) => setDraft(d => ({ ...d, winRateTarget: parseFloat(v.replace(',', '.')) || 0 }))} />
                <Text style={s.editUnit}>%</Text>
              </View>
            </View>
            {/* Max Drawdown with $ / % toggle */}
            <View style={s.editRow}>
              <Text style={s.editLabel}>📉 {t('maxDrawdownPct')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TextInput style={[s.editInput, { width: 60 }]} keyboardType="decimal-pad" value={String(draft.maxDrawdownValue)} onChangeText={(v: string) => setDraft(d => ({ ...d, maxDrawdownValue: parseFloat(v.replace(',', '.')) || 0 }))} />
                <View style={{ flexDirection: 'row', borderRadius: 6, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.cardBorder }}>
                  <TouchableOpacity style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: drawdownUnit === '$' ? theme.colors.primary : theme.colors.surface }} onPress={() => setDraft(d => ({ ...d, maxDrawdownUnit: '$' }))}>
                    <Text style={{ color: drawdownUnit === '$' ? '#fff' : theme.colors.textMuted, fontSize: 10, fontFamily: theme.fonts.monoBold }}>$</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={{ paddingHorizontal: 8, paddingVertical: 4, backgroundColor: drawdownUnit === '%' ? theme.colors.primary : theme.colors.surface }} onPress={() => setDraft(d => ({ ...d, maxDrawdownUnit: '%' }))}>
                    <Text style={{ color: drawdownUnit === '%' ? '#fff' : theme.colors.textMuted, fontSize: 10, fontFamily: theme.fonts.monoBold }}>%</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
            {/* Daily Trades */}
            <View style={s.editRow}>
              <Text style={s.editLabel}>📊 {t('dailyTradeCount')}</Text>
              <TextInput style={s.editInput} keyboardType="decimal-pad" value={String(draft.dailyTradeCount)} onChangeText={(v: string) => setDraft(d => ({ ...d, dailyTradeCount: parseInt(v, 10) || 0 }))} />
            </View>
            {/* Risk per Trade */}
            <View style={s.editRow}>
              <Text style={s.editLabel}>⚠️ {t('riskPerTrade')}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <TextInput style={[s.editInput, { width: 60 }]} keyboardType="decimal-pad" value={String(draft.riskPerTrade)} onChangeText={(v: string) => setDraft(d => ({ ...d, riskPerTrade: parseFloat(v.replace(',', '.')) || 0 }))} />
                <Text style={s.editUnit}>%</Text>
              </View>
            </View>
          </Card>
        </Animated.View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
          <TouchableOpacity
            style={[s.saveBtn, isSavingGoals && { opacity: 0.6 }]}
            onPress={async () => {
              hapticLight();
              setIsSavingGoals(true);
              try {
                await updateGoals(draft);
              } finally {
                setIsSavingGoals(false);
                setEditing(false);
              }
            }}
            disabled={isSavingGoals}
          >
            {isSavingGoals ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={s.saveBtnText}>{t('tgSave')}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={s.resetBtn}
            onPress={async () => {
              hapticLight();
              await resetGoals();
              setDraft(goals);
              setEditing(false);
            }}
            disabled={isSavingGoals}
          >
            <Text style={s.resetBtnText}>{t('tgResetBtn')}</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      {/* Summary header */}
      <Animated.View entering={FadeIn.delay(0).duration(350)}>
        <Card title={t('tgProgress')}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12 }}>
            <ProgressRing progress={pnlProgress} color={theme.colors.green} label={t('weeklyPnlTarget')} value={`${weekPnl >= 0 ? '+' : '-'}$${Math.abs(weekPnl).toFixed(0)}`} theme={theme} delay={0} />
            <ProgressRing progress={wrProgress} color={theme.colors.primaryLight} label={t('winRateTarget')} value={`${weekWr.toFixed(0)}%`} theme={theme} delay={100} />
            <ProgressRing progress={tradesProgress} color={theme.colors.cyan} label={t('dailyTradeCount')} value={`${weekTradesPerDay.toFixed(1)}`} theme={theme} delay={200} />
          </View>
        </Card>
      </Animated.View>

      {/* Goal details */}
      <Animated.View entering={FadeIn.delay(100).duration(350)}>
        <Card title={t('tradingGoals')}>
          {goalItems.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: i < goalItems.length - 1 ? 1 : 0, borderBottomColor: theme.colors.cardBorder }}>
              <Text style={{ fontSize: 20, marginRight: 10 }}>{item.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontFamily: theme.fonts.sansBold }}>{item.label}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                  <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: theme.colors.surface, overflow: 'hidden' }}>
                    <View style={{ width: `${Math.min(item.progress * 100, 100)}%`, height: '100%', borderRadius: 3, backgroundColor: item.achieved ? theme.colors.greenLight : theme.colors.primaryLight }} />
                  </View>
                  <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontFamily: theme.fonts.monoBold, marginLeft: 8 }}>{item.current} / {item.target}{item.per ? ` ${item.per}` : ''}</Text>
                </View>
              </View>
              <View style={{ marginLeft: 8 }}>{statusIcon(item.achieved, item.progress)}</View>
            </View>
          ))}
        </Card>
      </Animated.View>

      {/* Drawdown & Risk */}
      <Animated.View entering={FadeIn.delay(200).duration(350)}>
        <Card title={t('tgDrawdown')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>📉</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontFamily: theme.fonts.sansBold }}>{t('tgDrawdown')}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontFamily: theme.fonts.monoBold, marginTop: 2 }}>{goals.maxDrawdownUnit === '$' ? `$${goals.maxDrawdownValue}` : `${goals.maxDrawdownValue}%`} {t('tgDrawdownMax')}</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: theme.colors.cardBorder }}>
            <Text style={{ fontSize: 20, marginRight: 10 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontSize: 12, fontFamily: theme.fonts.sansBold }}>{t('tgRisk')}</Text>
              <Text style={{ color: theme.colors.textMuted, fontSize: 10, fontFamily: theme.fonts.monoBold, marginTop: 2 }}>{goals.riskPerTrade}% {t('tgRiskPerTrade')}</Text>
            </View>
          </View>
        </Card>
      </Animated.View>

      {/* Edit button */}
      <Animated.View entering={FadeIn.delay(300).duration(350)}>
        <TouchableOpacity style={s.editButton} onPress={() => { hapticLight(); setEditing(true); }}>
          <Text style={s.editButtonText}>{t('tgEdit')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </>
  );
};

const createGoalStyles = (theme: AppTheme) => StyleSheet.create({
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  editLabel: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  editUnit: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    minWidth: 16,
  },
  editInput: {
    width: 80,
    textAlign: 'right',
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.monoBold,
    backgroundColor: theme.colors.inputBg,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
  },
  resetBtn: {
    flex: 1,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  resetBtnText: {
    color: theme.colors.redLight,
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
  },
  editButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },
});
