import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  RefreshControl,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { usePlaybook, usePlaybookSetups } from '../features/playbook/usePlaybook';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMoney } from '../features/accounts/useMoney';
import type { PlaybookSetup } from '../features/playbook/usePlaybook';
import { useTrades } from '../features/trades/useTrades';
import { CandleLoader } from '../components/ui/CandleLoader';
import { useRefresh } from '../features/data/useRefresh';
import { useUIStore } from '../store/uiStore';
import { scopeTrades } from '../features/accounts/accountScope';
import type { Trade } from '../types/domain';
import { withAlpha } from '../theme';
import { useTheme } from '../theme';
import { localDayKey } from '../utils/formatDate';
import type { AppTheme } from '../theme';
import type { TFunction } from '../i18n';
import { useT } from '../i18n';
import { Card } from '../components/ui/Card';
import { DisciplineTab } from '../components/playbook/DisciplineTab';
import { Badge } from '../components/ui/Badge';
import {
  BookOpen,
  Target,
  Brain,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  ShieldCheck,
  AlertTriangle,
  Flame,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Panel } from '../components/ui/Panel';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonPanels } from '../components/ui/Skeleton';
import {
  statsForDay,
  mistakeCosts,
  disciplineStreak,
  disciplineGrid,
  mentalVsPnl,
} from '../features/playbook/debriefInsights';
import { Sparkline } from '../components/ui/Sparkline';
import {
  computeAllSetupEdges,
  computeUnattributed,
  computeConfluence,
  tradeMatchesSetup,
  MIN_SAMPLE,
} from '../features/playbook/setupAttribution';

/** Ranking modes. Expectancy leads because it is the only one that is money. */
const SORT_MODES = [
  { id: 'expectancy' as const, labelKey: 'sortByExpectancy' },
  { id: 'winRate' as const, labelKey: 'sortByWinRate' },
  { id: 'volume' as const, labelKey: 'sortByVolume' },
];
type SortMode = (typeof SORT_MODES)[number]['id'];

const COMMON_MISTAKES = ['revenge', 'fomo', 'early_cut', 'over_size', 'no_sl', 'chasing'] as const;

const PLAYBOOK_RULES = ['wait_m15', 'session_only', 'tp_1r', 'no_news', 'journal_before', 'risk_managed'] as const;

function mistakeLabel(t: TFunction, id: string): string {
  switch (id) {
    case 'revenge': return t('mistakeRevenge');
    case 'fomo': return t('mistakeFomo');
    case 'early_cut': return t('mistakeEarlyCut');
    case 'over_size': return t('mistakeOverSize');
    case 'no_sl': return t('mistakeNoSl');
    case 'chasing': return t('mistakeChasing');
    default: return id;
  }
}

function ruleLabel(t: TFunction, id: string): string {
  switch (id) {
    case 'wait_m15': return t('ruleWaitM15');
    case 'session_only': return t('ruleSessionOnly');
    case 'tp_1r': return t('ruleTp1r');
    case 'no_news': return t('ruleNoNews');
    case 'journal_before': return t('ruleJournalBefore');
    case 'risk_managed': return t('ruleRiskManaged');
    default: return id;
  }
}

// Émotions : ids stables stockés en DB (compat : anciennes valeurs FR acceptées à la lecture)
const EMOTION_IDS = ['calm', 'confident', 'anxious', 'euphoric', 'frustrated', 'tired'] as const;

/** localDayKey() inverse: parses YYYY-MM-DD into a local Date at midnight. */
function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}

function emotionLabel(t: TFunction, id: string): string {
  switch (id) {
    case 'calm': return t('emotionCalm');
    case 'confident': return t('emotionConfident');
    case 'anxious': return t('emotionAnxious');
    case 'euphoric': return t('emotionEuphoric');
    case 'frustrated': return t('emotionFrustrated');
    case 'tired': return t('emotionTired');
    default: return id;
  }
}

// Convertit une valeur stockée (id stable OU ancien libellé FR) vers l'id stable
function emotionIdFromStored(value: string | null | undefined): string {
  switch (value) {
    case 'calm': case 'Calme': return 'calm';
    case 'confident': case 'Confiant': return 'confident';
    case 'anxious': case 'Anxieux': return 'anxious';
    case 'euphoric': case 'Euphorique': return 'euphoric';
    case 'frustrated': case 'Frustré': return 'frustrated';
    case 'tired': case 'Fatigué': return 'tired';
    default: return 'calm';
  }
}

/*
 * Mini R-distribution inside a setup card. RDistributionChart is built for a
 * full-width card; at this size the read needed is coarser — a compact bin
 * count with the same green/red language.
 */
const RDistributionMini: React.FC<{ setup: PlaybookSetup; trades: Trade[] }> = ({
  setup,
  trades,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { t } = useT();

  const rs = useMemo(
    () =>
      trades
        .filter(tr => tr.r_multiple !== null && tradeMatchesSetup(tr, setup))
        .map(tr => tr.r_multiple as number),
    [trades, setup]
  );
  if (rs.length < 3) return null;

  const bins = [-Infinity, -2, -1, 0, 1, 2, Infinity];
  const counts = bins.slice(0, -1).map((lo, i) => {
    const hi = bins[i + 1];
    return rs.filter(r => r > lo && r <= hi).length;
  });
  const max = Math.max(...counts, 1);
  const labels = ['≤-2R', '-2/-1', '-1/0', '0/+1', '+1/+2', '≥+2R'];

  return (
    <View style={styles.rDistWrap}>
      <Text style={styles.rDistTitle}>{t('setupRDist')}</Text>
      <View style={styles.rDistRow}>
        {counts.map((c, i) => {
          const negativeBin = i < 3;
          const color = c === 0
            ? theme.colors.surfaceLight
            : negativeBin
              ? theme.colors.red
              : theme.colors.green;
          return (
            <View key={i} style={styles.rDistCol}>
              <View style={styles.rDistBarTrack}>
                <View
                  style={[styles.rDistBar, { height: Math.max((c / max) * 34, c > 0 ? 3 : 0), backgroundColor: color }]}
                />
              </View>
              <Text style={[styles.rDistCount, c === 0 && styles.rDistMuted]}>{c}</Text>
              <Text style={styles.rDistLabel}>{labels[i]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

export const PlaybookScreen: React.FC = () => {
  const { theme } = useTheme();
  const money = useMoney();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { debriefs, isLoading: debriefsLoading, saveDebrief, isSaving, deleteDebrief } = usePlaybook();
  const { setups, isLoading: setupsLoading, saveSetup, deleteSetup } = usePlaybookSetups();
  const { trades: allTrades } = useTrades();
  const { refreshing, onRefresh } = useRefresh();
  const activeAccountId = useUIStore(s => s.activeAccountId);

  /**
   * Setup performance is per account, like every other P&L in the app: a
   * setup's edge on a funded account says nothing about a demo account, and
   * money() here is bound to the active account's currency.
   */
  const trades = useMemo(
    () => scopeTrades(allTrades, activeAccountId),
    [allTrades, activeAccountId]
  );

  const [activeTab, setActiveTab] = useState<'setups' | 'debrief' | 'discipline'>('setups');

  // Debrief Form State
  const [selectedDate, setSelectedDate] = useState(() => localDayKey());
  const [debriefPickerVisible, setDebriefPickerVisible] = useState(false);
  const [editingDebriefId, setEditingDebriefId] = useState<string | null>(null);
  const [marketSentiment, setMarketSentiment] = useState('');
  const [htfAnalysis, setHtfAnalysis] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [objectiveTomorrow, setObjectiveTomorrow] = useState('');
  const [mentalScore, setMentalScore] = useState<number>(8);
  const [dayRating, setDayRating] = useState<number | null>(7);
  const [emotionBefore, setEmotionBefore] = useState('calm');
  const [committedMistakes, setCommittedMistakes] = useState<string[]>([]);
  const [rulesFollowed, setRulesFollowed] = useState<string[]>([]);

  // Setup Modal State
  const [setupSearch, setSetupSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('expectancy');
  const [setupFilterTimeframe, setSetupFilterTimeframe] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [editingSetup, setEditingSetup] = useState<PlaybookSetup | null>(null);
  const [setupTitle, setSetupTitle] = useState('');
  const [setupDesc, setSetupDesc] = useState('');
  const [setupTimeframes, setSetupTimeframes] = useState('M5, M15');
  const [setupRules, setSetupRules] = useState('');
  const [setupTags, setSetupTags] = useState('#Forex, #Indices');

  const openAddSetup = () => {
    setEditingSetup(null);
    setSetupTitle('');
    setSetupDesc('');
    setSetupTimeframes('M5, M15');
    setSetupRules('');
    setSetupTags('#Forex, #Indices');
    setRulesLines(['']);
    setSetupModalVisible(true);
  };

  const openEditSetup = (s: PlaybookSetup) => {
    setEditingSetup(s);
    setSetupTitle(s.title);
    setSetupDesc(s.description || '');
    setSetupTimeframes(s.timeframes.join(', '));
    setSetupRules(s.validation_rules.join('\n'));
    setSetupTags(s.tags.join(', '));
    // A stored rule may still carry an old hand-typed "1." prefix; the
    // editor adds its own numbering, so strip it on load.
    setRulesLines(
      s.validation_rules.length > 0
        ? s.validation_rules.map(r => r.replace(/^\s*\d+\.\s*/, ''))
        : ['']
    );
    setSetupModalVisible(true);
  };

  // ── Auto-numbered rules editor ──
  // One line per rule, numbered by position. "Enter" adds the next row, the
  // numbering follows on its own, and empty trailing lines are dropped on
  // save — the trader types rules, not list formatting.
  const [rulesLines, setRulesLines] = useState<string[]>(['']);
  const setRulesLineAt = useCallback((index: number) => (text: string) => {
    setRulesLines(prev => {
      // Typing a newline inside a row is the same gesture as "next rule".
      const parts = text.split('\n');
      if (parts.length > 1) {
        const next = [...prev];
        next.splice(index, 1, ...parts);
        return next.filter((l, i) => l.trim() !== '' || i < index + parts.length - 1);
      }
      const next = [...prev];
      next[index] = text;
      return next;
    });
  }, []);
  const addRulesLine = useCallback(() => {
    setRulesLines(prev => {
      // Enter on the last row grows the list; on a middle row it is just a
      // dismiss-keyboard guard, so nothing changes.
      const trimmedLast = prev[prev.length - 1]?.trim() !== '';
      return trimmedLast ? [...prev, ''] : prev;
    });
  }, []);
  const removeRulesLineAt = useCallback(
    (index: number) => () =>
      setRulesLines(prev =>
        prev.length <= 1 ? [''] : prev.filter((_, i) => i !== index)
      ),
    []
  );

  const handleSaveSetup = async () => {
    if (!setupTitle.trim()) {
      alert(t('setupNameRequired'));
      return;
    }
    const payload = {
      title: setupTitle.trim(),
      description: setupDesc.trim() || null,
      timeframes: setupTimeframes.split(',').map(s => s.trim()).filter(Boolean),
      validation_rules: rulesLines.map(s => s.trim()).filter(Boolean),
      tags: setupTags.split(',').map(s => s.trim()).filter(Boolean),
      image_url: null,
    };
    if (editingSetup) {
      await saveSetup({ id: editingSetup.id, ...payload });
    } else {
      await saveSetup(payload);
    }
    setSetupModalVisible(false);
  };

  const handleSaveDailyDebrief = async () => {
    await saveDebrief({
      id: editingDebriefId ?? undefined,
      date: selectedDate,
      market_sentiment: marketSentiment || null,
      htf_analysis: htfAnalysis || null,
      htf_image_url: null,
      lessons_learned: lessonsLearned || null,
      objective_tomorrow: objectiveTomorrow || null,
      mental_score: mentalScore,
      day_rating: dayRating,
      emotion_before: emotionBefore || null,
      mistakes_committed: committedMistakes,
      rules_followed: rulesFollowed,
    });
    setEditingDebriefId(null);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const loadDebrief = (d: (typeof debriefs)[number]) => {
    setEditingDebriefId(d.id);
    setSelectedDate(d.date);
    setMarketSentiment(d.market_sentiment || '');
    setHtfAnalysis(d.htf_analysis || '');
    setLessonsLearned(d.lessons_learned || '');
    setObjectiveTomorrow(d.objective_tomorrow || '');
    setMentalScore(d.mental_score ?? 8);
    setDayRating(d.day_rating ?? 7);
    setEmotionBefore(emotionIdFromStored(d.emotion_before));
    setCommittedMistakes(d.mistakes_committed || []);
    setRulesFollowed(d.rules_followed || []);
  };

  const handleDeleteDebrief = (id: string) => {
    Alert.alert(
      t('confirmTitle'),
      t('confirmDeleteDebrief'),
      [
        { text: t('confirmNo'), style: 'cancel' },
        {
          text: t('confirmYes'),
          style: 'destructive',
          onPress: async () => {
            await deleteDebrief(id);
            if (editingDebriefId === id) {
              setEditingDebriefId(null);
            }
          },
        },
      ],
    );
  };

  /**
   * Setup edges come from the attribution module, which is unit-tested. The
   * previous inline matcher credited setups for trades they had nothing to do
   * with (substring matches, and a lone setup capturing everything), so the
   * win rates shown here were not measuring the setups at all.
   */
  const setupEdges = useMemo(
    () => computeAllSetupEdges(setups, trades),
    [setups, trades]
  );
  const adherence = useMemo(
    () => computeUnattributed(setups, trades),
    [setups, trades]
  );
  const confluence = useMemo(() => computeConfluence(trades), [trades]);

  // ── Debrief-side derived data (pure helpers, unit-tested) ──
  const dayStats = useMemo(
    () => statsForDay(trades, selectedDate),
    [trades, selectedDate]
  );
  const costs = useMemo(() => mistakeCosts(debriefs, trades), [debriefs, trades]);
  const streak = useMemo(() => disciplineStreak(debriefs), [debriefs]);
  const grid = useMemo(() => disciplineGrid(debriefs, trades, 8), [debriefs, trades]);
  const mentalMirror = useMemo(() => mentalVsPnl(debriefs, trades), [debriefs, trades]);

  // Débriefings triés par date décroissante (plus récent en premier)
  // Filtered setups
  const rankedSetups = useMemo(() => {
    const filtered = setupEdges.filter(({ setup: st }) => {
      const q = setupSearch.toLowerCase();
      if (q && !st.title.toLowerCase().includes(q) && !(st.description || '').toLowerCase().includes(q)) return false;
      if (setupFilterTimeframe && !st.timeframes.some(tf => tf.toLowerCase() === setupFilterTimeframe.toLowerCase())) return false;
      return true;
    });
    // Untraded setups always sink to the bottom: they have no edge to rank,
    // and a 0 would otherwise sit above every losing setup.
    return [...filtered].sort((a, b) => {
      if (a.count === 0 && b.count === 0) return a.setup.title.localeCompare(b.setup.title);
      if (a.count === 0) return 1;
      if (b.count === 0) return -1;
      if (sortMode === 'winRate') return b.winRate - a.winRate;
      if (sortMode === 'volume') return b.count - a.count;
      return b.expectancy - a.expectancy;
    });
  }, [setupEdges, setupSearch, setupFilterTimeframe, sortMode]);

  // Discipline analytics
  const mistakesAnalytics = useMemo(() => {
    const counts: Record<string, number> = {};
    COMMON_MISTAKES.forEach(m => counts[m] = 0);
    debriefs.forEach(d => {
      (d.mistakes_committed || []).forEach(mId => {
        counts[mId] = (counts[mId] || 0) + 1;
      });
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0) || 1;
    return COMMON_MISTAKES.map(m => ({
      id: m, label: mistakeLabel(t, m),
      count: counts[m] || 0,
      pct: Math.round(((counts[m] || 0) / total) * 100)
    })).sort((a, b) => b.count - a.count);
  }, [debriefs, t]);

  // Auto-load existing debrief for selected date
  useEffect(() => {
    if (!editingDebriefId && selectedDate) {
      const existing = debriefs.find(d => d.date === selectedDate);
      if (existing) {
        loadDebrief(existing);
      }
    }
  }, [selectedDate, debriefs]);

  const sortedDebriefs = useMemo(() => {
    return [...debriefs].sort((a, b) => b.date.localeCompare(a.date));
  }, [debriefs]);

  if (debriefsLoading || setupsLoading) {
    // Panel placeholders instead of a spinner: the header and tabs below
    // render for real, and each tab's panels settle into their own slots.
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.screenTitle}>{t('screenTitlePlaybook')}</Text>
            <Text style={styles.screenSubtitle}>{t('screenSubtitlePlaybook')}</Text>
          </View>
        </View>
        <View style={styles.tabsRow}>
          {(['setups', 'debrief', 'discipline'] as const).map(id => (
            <View key={id} style={[styles.tabBtn, activeTab === id && styles.tabBtnActive]}>
              <Text style={[styles.tabBtnText, activeTab === id && styles.tabBtnTextActive]}>
                {id === 'setups' ? t('myStrategies') : id === 'debrief' ? t('dailyDebrief') : t('disciplineMatrix')}
              </Text>
            </View>
          ))}
        </View>
        <SkeletonPanels count={activeTab === 'setups' ? 4 : 3} rowsPerPanel={4} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.colors.primary}
          colors={[theme.colors.primary]}
          progressBackgroundColor={theme.colors.card}
        />
      }
    >
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>{t('screenTitlePlaybook')}</Text>
          <Text style={styles.screenSubtitle}>{t('screenSubtitlePlaybook')}</Text>
        </View>
      </View>

      {/* TABS */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'setups' && styles.tabBtnActive]}
          onPress={() => setActiveTab('setups')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'setups' }}
        >
          <Target color={activeTab === 'setups' ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
          <Text style={[styles.tabBtnText, activeTab === 'setups' && styles.tabBtnTextActive]}>
            {t('myStrategies')} ({setups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'debrief' && styles.tabBtnActive]}
          onPress={() => setActiveTab('debrief')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'debrief' }}
        >
          <BookOpen color={activeTab === 'debrief' ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
          <Text style={[styles.tabBtnText, activeTab === 'debrief' && styles.tabBtnTextActive]}>
            {t('dailyDebrief')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'discipline' && styles.tabBtnActive]}
          onPress={() => setActiveTab('discipline')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'discipline' }}
        >
          <Brain color={activeTab === 'discipline' ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
          <Text style={[styles.tabBtnText, activeTab === 'discipline' && styles.tabBtnTextActive]}>
            {t('disciplineMatrix')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1 : MES STRATÉGIES PLAYBOOK ──
          Rebuilt around one question: which setup actually pays? The list is
          therefore ranked by expectancy by default, not by creation order, and
          every card leads with money-per-trade rather than win rate (a 70% win
          rate on -0.3R is a losing strategy). */}
      {activeTab === 'setups' && (
        <View style={styles.tabContent}>
          {/* Adherence banner — the number a playbook should open with. */}
          {adherence.total > 0 && (
            <Animated.View entering={FadeInDown.duration(320)}>
              <Panel>
                <View style={styles.adherenceHead}>
                  <ShieldCheck size={16} color={theme.colors.primaryLight} />
                  <Text style={styles.adherenceTitle}>{t('planAdherence')}</Text>
                  <Text style={styles.adherencePct}>{adherence.adherencePct.toFixed(0)}%</Text>
                </View>
                <View style={styles.adherenceBarTrack}>
                  <View
                    style={[
                      styles.adherenceBarFill,
                      { width: `${Math.min(adherence.adherencePct, 100)}%` },
                    ]}
                  />
                </View>
                <View style={styles.adherenceRow}>
                  <View style={styles.adherenceCell}>
                    <Text style={styles.adherenceLabel}>{t('onPlanTrades')}</Text>
                    <Text style={styles.adherenceVal}>{adherence.onPlan}</Text>
                    <Text
                      style={[
                        styles.adherenceSub,
                        adherence.onPlanPnl >= 0 ? styles.greenText : styles.redText,
                      ]}
                    >
                      {money(adherence.onPlanPnl, { decimals: 0 })}
                    </Text>
                  </View>
                  <View style={styles.adherenceDivider} />
                  <View style={styles.adherenceCell}>
                    <Text style={styles.adherenceLabel}>{t('offPlanTrades')}</Text>
                    <Text style={styles.adherenceVal}>{adherence.offPlan}</Text>
                    <Text
                      style={[
                        styles.adherenceSub,
                        adherence.offPlanPnl >= 0 ? styles.greenText : styles.redText,
                      ]}
                    >
                      {money(adherence.offPlanPnl, { decimals: 0 })}
                    </Text>
                  </View>
                </View>
                <Text style={styles.adherenceHint}>{t('adherenceHint')}</Text>
              </Panel>
            </Animated.View>
          )}

          <TouchableOpacity
            style={styles.addSetupBtn}
            onPress={openAddSetup}
            accessibilityRole="button"
            accessibilityLabel={t('addNewStrategy')}
          >
            <Plus size={16} color={theme.colors.textPrimary} />
            <Text style={styles.addSetupText}>{t('addNewStrategy')}</Text>
          </TouchableOpacity>

          {setups.length > 1 && (
            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>{t('sortLabel')}</Text>
              {SORT_MODES.map(mode => (
                <TouchableOpacity
                  key={mode.id}
                  style={[styles.sortBtn, sortMode === mode.id && styles.sortBtnActive]}
                  onPress={() => setSortMode(mode.id)}
                >
                  <Text
                    style={[
                      styles.sortBtnText,
                      sortMode === mode.id && styles.sortBtnTextActive,
                    ]}
                  >
                    {t(mode.labelKey as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {rankedSetups.length === 0 ? (
            <EmptyState
              icon={<Target size={22} color={theme.colors.primaryLight} />}
              title={t('noStrategy')}
            />
          ) : (
            rankedSetups.map((edge, idx) => {
              const { setup: st } = edge;
              const positive = edge.expectancy >= 0;
              const accent = edge.count === 0
                ? theme.colors.textMuted
                : positive
                  ? theme.colors.green
                  : theme.colors.red;
              return (
                <Animated.View
                  key={st.id}
                  entering={FadeInDown.delay(idx * 60).duration(320)}
                >
                  <View style={[styles.setupCard, { borderLeftColor: accent, borderLeftWidth: 3 }]}>
                    <View style={styles.setupHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={styles.setupTitleRow}>
                          <Text style={styles.setupTitle} numberOfLines={1}>{st.title}</Text>
                          {/* Rank badges only make sense once a setup has a
                              trustworthy sample behind it. */}
                          {edge.count >= MIN_SAMPLE && idx === 0 && (
                            <Badge label={t('bestSetup')} variant="green" />
                          )}
                        </View>
                        {st.description ? (
                          <Text style={styles.setupDesc} numberOfLines={2}>{st.description}</Text>
                        ) : null}
                      </View>
                      <View style={styles.setupActions}>
                        <TouchableOpacity
                          onPress={() => openEditSetup(st)}
                          style={styles.iconBtn}
                          accessibilityRole="button"
                          accessibilityLabel={t('a11yEditSetup', st.title)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Edit3 size={16} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => deleteSetup(st.id)}
                          style={styles.iconBtn}
                          accessibilityRole="button"
                          accessibilityLabel={t('a11yDeleteSetup', st.title)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={16} color={theme.colors.redLight} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {edge.count === 0 ? (
                      <View style={styles.setupEmpty}>
                        <Text style={styles.setupEmptyTitle}>{t('noTradesForSetup')}</Text>
                        <Text style={styles.setupEmptyHint}>{t('noTradesForSetupHint')}</Text>
                      </View>
                    ) : (
                      <>
                        {/* Headline: expectancy + the shape of its equity. */}
                        <View style={styles.edgeRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.edgeLabel}>{t('expectancyPerTrade')}</Text>
                            <Text style={[styles.edgeValue, { color: accent }]}>
                              {money(edge.expectancy, { decimals: 2 })}
                            </Text>
                            <Text style={styles.edgeSub}>
                              {edge.count} trades · {money(edge.pnl, { decimals: 0 })}
                              {edge.openCount > 0 ? ` · ${t('setupOpenTrades', edge.openCount)}` : ''}
                            </Text>
                          </View>
                          {edge.equity.length >= 2 && (
                            <Sparkline data={edge.equity} baseline={0} width={92} height={36} />
                          )}
                        </View>

                        <View style={styles.edgeStats}>
                          <View style={styles.edgeStat}>
                            <Text style={styles.edgeStatLabel}>WR</Text>
                            <Text
                              style={[
                                styles.edgeStatVal,
                                edge.winRate >= 50 ? styles.greenText : styles.redText,
                              ]}
                            >
                              {edge.winRate.toFixed(0)}%
                            </Text>
                          </View>
                          <View style={styles.edgeStat}>
                            <Text style={styles.edgeStatLabel}>PF</Text>
                            <Text style={styles.edgeStatVal}>
                              {/* 0 means "no losses yet", which is not a profit
                                  factor of zero. A dash is the honest glyph. */}
                              {edge.profitFactor > 0 ? edge.profitFactor.toFixed(2) : '—'}
                            </Text>
                          </View>
                          <View style={styles.edgeStat}>
                            <Text style={styles.edgeStatLabel}>R</Text>
                            <Text style={styles.edgeStatVal}>
                              {edge.avgR >= 0 ? '+' : ''}{edge.avgR.toFixed(2)}
                            </Text>
                          </View>
                          <View style={styles.edgeStat}>
                            <Text style={styles.edgeStatLabel}>W/L/BE</Text>
                            <Text style={styles.edgeStatVal}>
                              {edge.wins}/{edge.losses}/{edge.breakeven}
                            </Text>
                          </View>
                        </View>

                        {/* How the setup wins, not only that it wins: a
                            many-small-gains shape and a lottery-ticket shape
                            can share the same avg R. */}
                        <RDistributionMini setup={edge.setup} trades={trades} />

                        {edge.lowConfidence && (
                          <View style={styles.warnRow}>
                            <AlertTriangle size={12} color={theme.colors.gold} />
                            <Text style={styles.warnText}>
                              {t('lowSampleWarn')} — {t('lowSampleHint', MIN_SAMPLE)}
                            </Text>
                          </View>
                        )}
                      </>
                    )}

                    {st.validation_rules.length > 0 && (
                      <View style={styles.rulesBlock}>
                        {st.validation_rules.map((rule, i) => (
                          <View key={i} style={styles.ruleItemRow}>
                            <Text style={styles.ruleItemNum}>{i + 1}.</Text>
                            <Text style={styles.ruleItem}>{rule}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    <View style={styles.tagWrap}>
                      {st.timeframes.map(tf => (
                        <Badge key={tf} label={tf} variant="blue" />
                      ))}
                      {st.tags.map(tg => (
                        <Badge key={tg} label={tg} variant="neutral" />
                      ))}
                    </View>
                  </View>
                </Animated.View>
              );
            })
          )}

          {/* Confluence performance — what the FVG/OB/sweep flags are worth.
              These used to be (mis)used to attribute trades to setups; here
              they answer their own question instead. */}
          {confluence.some(c => c.count > 0) && (
            <Animated.View entering={FadeInDown.delay(200).duration(320)}>
              <Card title={t('confluenceTitle')}>
                {confluence.map(c => (
                  <View key={c.id} style={styles.confRow}>
                    <Text style={styles.confLabel}>
                      {c.id === 'fvg'
                        ? t('confluenceFvg')
                        : c.id === 'ob'
                          ? t('confluenceOb')
                          : t('confluenceSweep')}
                    </Text>
                    {c.count === 0 ? (
                      <Text style={styles.confMuted}>{t('playbookNoData')}</Text>
                    ) : (
                      <View style={styles.confVals}>
                        <Text style={styles.confCount}>{c.count}</Text>
                        <Text
                          style={[
                            styles.confWr,
                            c.winRate >= 50 ? styles.greenText : styles.redText,
                          ]}
                        >
                          {c.winRate.toFixed(0)}%
                        </Text>
                        <Text
                          style={[
                            styles.confPnl,
                            c.pnl >= 0 ? styles.greenText : styles.redText,
                          ]}
                        >
                          {money(c.pnl, { decimals: 0 })}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
                <Text style={styles.adherenceHint}>{t('confluenceHint')}</Text>
              </Card>
            </Animated.View>
          )}
        </View>
      )}

      {/* ── TAB 2 : DÉBRIEFING JOURNALIER ── */}
      {activeTab === 'debrief' && (
        <View style={styles.tabContent}>
          {/* The day as the journal recorded it, above the form: you write the
              debrief looking at what actually happened, not at memory. */}
          <Card title={t('debriefDayStats')}>
            {dayStats.count === 0 ? (
              <Text style={styles.dayStatsEmpty}>{t('debriefNoTradesDay')}</Text>
            ) : (
              <View style={styles.dayStatsRow}>
                <View style={styles.dayStat}>
                  <Text style={styles.dayStatVal}>{dayStats.count}</Text>
                  <Text style={styles.dayStatLabel}>{t('tradesCount')}</Text>
                </View>
                <View style={styles.dayStat}>
                  <Text
                    style={[
                      styles.dayStatVal,
                      { color: dayStats.pnl >= 0 ? theme.colors.green : theme.colors.red },
                    ]}
                  >
                    {money(dayStats.pnl, { decimals: 2 })}
                  </Text>
                  <Text style={styles.dayStatLabel}>P&L</Text>
                </View>
                <View style={styles.dayStat}>
                  <Text style={styles.dayStatVal}>
                    {dayStats.count > 0
                      ? `${Math.round((dayStats.wins / dayStats.count) * 100)}%`
                      : '—'}
                  </Text>
                  <Text style={styles.dayStatLabel}>{t('winRate')}</Text>
                </View>
                <View style={styles.dayStat}>
                  <Text style={styles.dayStatVal}>
                    {dayStats.avgR !== null
                      ? `${dayStats.avgR >= 0 ? '+' : ''}${dayStats.avgR.toFixed(2)}R`
                      : '—'}
                  </Text>
                  <Text style={styles.dayStatLabel}>R MOY.</Text>
                </View>
              </View>
            )}
          </Card>

          <Card title={t('debriefTitle')}>
            {/* Date picker, not a raw YYYY-MM-DD text input: typing an
                unparseable date silently wrote a debrief no calendar view
                could ever find. */}
            <Text style={styles.fieldLabel}>{t('debriefDate')}</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setDebriefPickerVisible(true)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t('debriefDate')}
            >
              <Text style={styles.debriefDateText}>{selectedDate}</Text>
            </TouchableOpacity>
            {debriefPickerVisible && (
              <DateTimePicker
                value={parseDayKey(selectedDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                themeVariant="dark"
                onDismiss={() => setDebriefPickerVisible(false)}
                onValueChange={(_e: any, d?: Date) => {
                  setDebriefPickerVisible(false);
                  if (d) setSelectedDate(localDayKey(d));
                }}
              />
            )}

            <Text style={styles.fieldLabel}>{t('marketSentiment')}</Text>
            <TextInput
              style={styles.input}
              value={marketSentiment}
              onChangeText={setMarketSentiment}
              placeholder={t('phMarketSentiment')}
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={styles.fieldLabel}>{t('htfAnalysis')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={htfAnalysis}
              onChangeText={setHtfAnalysis}
              placeholder={t('phHtfAnalysis')}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={2}
            />

            <View style={styles.scoreRow}>
              <View style={styles.scoreCol}>
                <Text style={styles.fieldLabel}>{t('mentalScore')}</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setMentalScore(m => Math.max(1, m - 1))}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11yDecMentalScore')}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{mentalScore}/10</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setMentalScore(m => Math.min(10, m + 1))}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11yIncMentalScore')}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.scoreCol}>
                <Text style={styles.fieldLabel}>{t('dayRating')}</Text>
                <View style={styles.stepper}>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setDayRating(r => (r === null ? 7 : Math.max(1, r - 1)))}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11yDecDayRating')}
                  >
                    <Text style={styles.stepperBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.stepperValue}>{dayRating ?? '—'}/10</Text>
                  <TouchableOpacity
                    style={styles.stepperBtn}
                    onPress={() => setDayRating(r => (r === null ? 1 : Math.min(10, r + 1)))}
                    accessibilityRole="button"
                    accessibilityLabel={t('a11yIncDayRating')}
                  >
                    <Text style={styles.stepperBtnText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <Text style={styles.fieldLabel}>{t('emotionBefore')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {EMOTION_IDS.map(id => (
                <TouchableOpacity
                  key={id}
                  style={[styles.pill, emotionBefore === id && styles.pillActive]}
                  onPress={() => setEmotionBefore(id)}
                >
                  <Text style={[styles.pillText, emotionBefore === id && styles.whiteText]}>
                    {emotionLabel(t, id)}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>{t('lessonsLearned')}</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={lessonsLearned}
              onChangeText={setLessonsLearned}
              placeholder={t('phLessonsLearned')}
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>{t('objectiveTomorrow')}</Text>
            <TextInput
              style={styles.input}
              value={objectiveTomorrow}
              onChangeText={setObjectiveTomorrow}
              placeholder={t('phObjectiveTomorrow')}
              placeholderTextColor={theme.colors.textMuted}
            />

            {/* Mistakes and rules belong to the debrief record that is being
                written here. They used to sit on the Discipline tab, which has
                no save button, so every tick was silently discarded unless the
                user happened to come back and save a debrief afterwards. */}
            <Text style={styles.fieldLabel}>{t('mistakesCard')}</Text>
            <View style={styles.chipWrap}>
              {COMMON_MISTAKES.map(id => {
                const isChecked = committedMistakes.includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.checkChip, isChecked && styles.checkChipRed]}
                    onPress={() =>
                      setCommittedMistakes(prev =>
                        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                  >
                    <Text style={[styles.checkChipText, isChecked && styles.redText]}>
                      {mistakeLabel(t, id)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>{t('rulesCard')}</Text>
            <View style={styles.chipWrap}>
              {PLAYBOOK_RULES.map(id => {
                const isChecked = rulesFollowed.includes(id);
                return (
                  <TouchableOpacity
                    key={id}
                    style={[styles.checkChip, isChecked && styles.checkChipGreen]}
                    onPress={() =>
                      setRulesFollowed(prev =>
                        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                      )
                    }
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isChecked }}
                  >
                    <Text style={[styles.checkChipText, isChecked && styles.greenText]}>
                      {ruleLabel(t, id)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, isSaving && styles.saveBtnDisabled]}
              onPress={handleSaveDailyDebrief}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.colors.textPrimary} />
              ) : (
                <Text style={styles.saveBtnText}>
                  {editingDebriefId ? t('updateDebrief') : t('saveDebrief')}
                </Text>
              )}
            </TouchableOpacity>
            {saveSuccess && (
              <View style={styles.saveSuccess}>
                <Check size={14} color={theme.colors.green} />
                <Text style={styles.saveSuccessText}>{t('debriefSaved')}</Text>
              </View>
            )}
          </Card>

          {/* Historique des débriefings */}
          <Card
            title={t('debriefHistory', sortedDebriefs.length)}
            headerAction={
              sortedDebriefs.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setEditingDebriefId(null);
                    setSelectedDate(localDayKey());
                    setMarketSentiment('');
                    setHtfAnalysis('');
                    setLessonsLearned('');
                    setObjectiveTomorrow('');
                    setMentalScore(8);
                    setDayRating(7);
                    setEmotionBefore('calm');
                    setCommittedMistakes([]);
                    setRulesFollowed([]);
                  }}
                  style={styles.newDebriefBtn}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11yNewDebrief')}
                >
                  <Plus size={12} color={theme.colors.primaryLight} />
                  <Text style={styles.newDebriefText}>{t('newDebrief')}</Text>
                </TouchableOpacity>
              ) : undefined
            }
          >
            {sortedDebriefs.length === 0 ? (
              <Text style={styles.emptyText}>{t('noDebriefYet')}</Text>
            ) : (
              sortedDebriefs.map(d => (
                <View key={d.id} style={styles.debriefRow}>
                  <View style={styles.debriefMain}>
                    <View style={styles.debriefTopRow}>
                      <Text style={styles.debriefDate}>{d.date}</Text>
                      <View style={styles.debriefScores}>
                        {d.mental_score !== null && d.mental_score !== undefined && (
                          <Badge label={`${t('mentalBadge')} ${d.mental_score}/10`} variant="blue" size="sm" />
                        )}
                        {d.day_rating !== null && d.day_rating !== undefined && (
                          <Badge label={`${t('noteBadge')} ${d.day_rating}/10`} variant="gold" size="sm" />
                        )}
                      </View>
                    </View>
                    {d.market_sentiment ? (
                      <Text style={styles.debriefSentiment} numberOfLines={2}>
                        {d.market_sentiment}
                      </Text>
                    ) : null}
                    {d.lessons_learned ? (
                      <Text style={styles.debriefLessons} numberOfLines={2}>
                        {d.lessons_learned}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.debriefActions}>
                    <TouchableOpacity
                      onPress={() => loadDebrief(d)}
                      style={styles.iconBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Modifier le débriefing du ${d.date}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Edit3 size={15} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteDebrief(d.id)}
                      style={styles.iconBtn}
                      accessibilityRole="button"
                      accessibilityLabel={`Supprimer le débriefing du ${d.date}`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={15} color={theme.colors.redLight} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </Card>
        </View>
      )}


      {activeTab === 'discipline' && (
        <DisciplineTab
          streak={streak}
          mistakesAnalytics={mistakesAnalytics}
          costs={costs}
          grid={grid}
          mentalMirror={mentalMirror}
          money={money}
          mistakeLabel={mistakeLabel}
        />
      )}

      {/* Modal Ajout / Modification Stratégie.
          Validation rules are numbered as you type: every new line gets the
          next "1. 2. 3." prefix automatically, so the saved list reads as an
          ordered checklist everywhere it is shown. A hand-typed prefix is
          stripped on save — the display adds its own. */}
      <Modal visible={setupModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderRow}>
                  <View style={styles.modalAccentBar} />
                  <Text style={styles.modalTitle}>
                    {editingSetup ? t('editSetup') : t('newSetup')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSetupModalVisible(false)}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11yCloseSetupForm')}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={20} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.fieldLabel}>{t('setupTitleLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('phSetupTitle')}
                  placeholderTextColor={theme.colors.textMuted}
                  value={setupTitle}
                  onChangeText={setSetupTitle}
                />

                <Text style={styles.fieldLabel}>{t('setupTimeframesLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="M5, M15, H1"
                  placeholderTextColor={theme.colors.textMuted}
                  value={setupTimeframes}
                  onChangeText={setSetupTimeframes}
                />

                <Text style={styles.fieldLabel}>{t('setupRulesLabel')}</Text>
                <View style={styles.rulesEditor}>
                  {rulesLines.map((line, i) => (
                    <View key={i} style={styles.rulesLineRow}>
                      <Text style={[styles.ruleNum, !line.trim() && styles.ruleNumEmpty]}>{i + 1}.</Text>
                      <TextInput
                        style={styles.ruleLineInput}
                        value={line}
                        placeholder={i === 0 ? t('phSetupRules') : undefined}
                        placeholderTextColor={theme.colors.textMuted}
                        onChangeText={setRulesLineAt(i)}
                        onSubmitEditing={addRulesLine}
                        blurOnSubmit={false}
                        returnKeyType="next"
                        accessibilityLabel={`${t('setupRulesLabel')} ${i + 1}`}
                      />
                      {rulesLines.length > 1 ? (
                        <TouchableOpacity
                          onPress={removeRulesLineAt(i)}
                          style={styles.ruleRemoveBtn}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`${t('setupRulesLabel')}: ${i + 1}`}
                        >
                          <X size={12} color={theme.colors.textMuted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  ))}
                </View>
                <Text style={styles.fieldHint}>{t('setupRulesAutoHint')}</Text>

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSetup}>
                  <Text style={styles.saveBtnText}>{t('saveSetup')}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

const createStyles = (theme: AppTheme) => StyleSheet.create({
  // ── Debrief: the day in numbers ──
  dayStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  dayStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  dayStatVal: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.metricSm,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  dayStatLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.mono,
    letterSpacing: 0.5,
  },
  dayStatsEmpty: {
    color: theme.colors.textMuted,
    fontSize: theme.type.label,
    fontFamily: theme.fonts.sans,
  },
  // ── Discipline: streak ──
  // ── Discipline: mistake cost ──
  // ── Discipline: 8-week grid ──
  // ── Setup: mini R distribution ──
  rDistWrap: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.hairline,
  },
  rDistTitle: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 1,
    marginBottom: 6,
  },
  rDistRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rDistCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  rDistBarTrack: {
    height: 34,
    justifyContent: 'flex-end',
  },
  rDistBar: {
    width: 18,
    borderRadius: 2,
  },
  rDistCount: {
    color: theme.colors.textPrimary,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
  },
  rDistMuted: {
    color: theme.colors.textMuted,
  },
  rDistLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.mono,
  },
  adherenceHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adherenceTitle: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 1,
  },
  adherencePct: {
    color: theme.colors.textPrimary,
    fontSize: 20,
    fontFamily: theme.fonts.sansExtraBold,
    fontVariant: ['tabular-nums'],
  },
  adherenceBarTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.colors.cardBorder,
    marginTop: 10,
    overflow: 'hidden',
  },
  adherenceBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: theme.colors.primary,
  },
  adherenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  adherenceCell: {
    flex: 1,
    alignItems: 'center',
  },
  adherenceDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: theme.colors.cardBorder,
  },
  adherenceLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
    letterSpacing: 0.8,
  },
  adherenceVal: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: theme.fonts.sansBold,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  adherenceSub: {
    fontSize: 11,
    fontFamily: theme.fonts.monoMedium,
    fontVariant: ['tabular-nums'],
  },
  adherenceHint: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.sans,
    marginTop: 10,
    lineHeight: 14,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: theme.spacing.sm,
  },
  sortLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },
  sortBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.card,
  },
  sortBtnActive: {
    borderColor: theme.colors.primary,
    backgroundColor: withAlpha(theme.colors.primary, 0.18),
  },
  sortBtnText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  sortBtnTextActive: {
    color: theme.colors.textPrimary,
  },
  setupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  setupEmpty: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.cardBorder,
  },
  setupEmptyTitle: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: theme.fonts.sansBold,
  },
  setupEmptyHint: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.sans,
    marginTop: 2,
  },
  edgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  edgeLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.8,
  },
  edgeValue: {
    fontSize: 22,
    fontFamily: theme.fonts.sansExtraBold,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  edgeSub: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    fontVariant: ['tabular-nums'],
    marginTop: 1,
  },
  edgeStats: {
    flexDirection: 'row',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.cardBorder,
  },
  edgeStat: {
    flex: 1,
    alignItems: 'center',
  },
  edgeStatLabel: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
  },
  edgeStatVal: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  warnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 10,
  },
  warnText: {
    flex: 1,
    color: theme.colors.gold,
    fontSize: 9,
    fontFamily: theme.fonts.sans,
  },
  rulesBlock: {
    marginTop: 10,
  },
  confRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.cardBorder,
  },
  confLabel: {
    flex: 1,
    color: theme.colors.textSecondary,
    fontSize: 11,
    fontFamily: theme.fonts.sansMedium,
  },
  confMuted: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
  },
  confVals: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confCount: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.monoMedium,
    fontVariant: ['tabular-nums'],
  },
  confWr: {
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
    minWidth: 34,
    textAlign: 'right',
  },
  confPnl: {
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
    minWidth: 54,
    textAlign: 'right',
  },
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
  header: {
    marginBottom: theme.spacing.md,
  },
  screenTitle: {
    color: theme.colors.textPrimary,
    fontSize: 18,
    fontFamily: theme.fonts.sansExtraBold,
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
    marginTop: 2,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingVertical: 8,
  },
  tabBtnActive: {
    backgroundColor: withAlpha(theme.colors.primary, 0.2),
    borderColor: theme.colors.primary,
  },
  tabBtnText: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  tabBtnTextActive: {
    color: theme.colors.textPrimary,
  },
  tabContent: {
    paddingBottom: theme.spacing.xxl,
  },
  addSetupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  addSetupText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
  },
  setupCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  setupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  setupTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.sansBold,
  },
  setupDesc: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.sans,
    marginTop: 2,
  },
  ruleItem: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.monoMedium,
    lineHeight: 14,
    flex: 1,
  },
  ruleItemRow: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'flex-start',
  },
  ruleItemNum: {
    color: theme.colors.primaryLight,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    lineHeight: 14,
    minWidth: 12,
  },
  setupActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  iconBtn: {
    padding: 4,
  },
  setupMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: theme.colors.cardBorder,
    paddingTop: 6,
  },
  tagWrap: {
    flexDirection: 'row',
    gap: 4,
  },
  statsBadge: {
    alignItems: 'flex-end',
  },
  statWr: {
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
  },
  statCount: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.sansMedium,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  checkChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    backgroundColor: theme.colors.surface,
  },
  checkChipRed: {
    borderColor: theme.colors.red,
    backgroundColor: theme.colors.red + '18',
  },
  checkChipGreen: {
    borderColor: theme.colors.green,
    backgroundColor: theme.colors.green + '18',
  },
  checkChipText: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.4,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
    letterSpacing: 0.6,
    marginBottom: 4,
    marginTop: 6,
  },
  input: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    height: 40,
    paddingHorizontal: theme.spacing.md,
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  textArea: {
    height: 60,
    paddingTop: 8,
  },
  pillScroll: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  pill: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    marginRight: 4,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primaryLight,
  },
  pillText: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.monoBold,
  },
  whiteText: { color: theme.colors.textPrimary },
  greenText: { color: theme.colors.greenLight },
  debriefDateText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
    fontVariant: ['tabular-nums'],
    paddingVertical: 10,
  },
  redText: { color: theme.colors.redLight },
  saveBtn: {
    backgroundColor: theme.colors.primary,
    height: 44,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  saveBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 11,
    fontFamily: theme.fonts.sansBold,
    letterSpacing: 0.8,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: 4,
  },
  scoreCol: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.xs,
    height: 40,
  },
  stepperBtn: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
  },
  stepperBtnText: {
    color: theme.colors.textPrimary,
    fontSize: 16,
    fontFamily: theme.fonts.monoBold,
  },
  stepperValue: {
    flex: 1,
    textAlign: 'center',
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontFamily: theme.fonts.monoBold,
  },
  newDebriefBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: withAlpha(theme.colors.primary, 0.15),
    borderColor: theme.colors.primary,
    borderWidth: 1,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  newDebriefText: {
    color: theme.colors.primaryLight,
    fontSize: 9,
    fontFamily: theme.fonts.monoBold,
  },
  debriefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  debriefMain: {
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  debriefTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.xs,
    marginBottom: 4,
  },
  debriefDate: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.monoBold,
  },
  debriefScores: {
    flexDirection: 'row',
    gap: 4,
  },
  debriefSentiment: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontFamily: theme.fonts.monoMedium,
  },
  debriefLessons: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontFamily: theme.fonts.sans,
    marginTop: 2,
  },
  debriefActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.sans,
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: withAlpha(theme.colors.scrim, 0.85),
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  modalContent: {
    backgroundColor: theme.colors.modalBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    // The rules editor and its keyboard need room: the modal scrolls, so a
    // fixed ceiling keeps the title and the save button reachable.
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
    paddingBottom: theme.spacing.sm,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalAccentBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
    backgroundColor: theme.colors.primary,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.sansBold,
  },
  fieldHint: {
    color: theme.colors.textMuted,
    fontSize: 9,
    fontFamily: theme.fonts.mono,
    marginTop: 5,
    lineHeight: 13,
  },
  // Numbered rules editor: one row per rule, the number is positional and
  // read-only — the trader never types list formatting again.
  rulesEditor: {
    borderWidth: 1,
    borderColor: theme.colors.cardBorder,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    gap: 2,
  },
  rulesLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.cardBorder,
    paddingVertical: 2,
  },
  ruleNum: {
    color: theme.colors.primaryLight,
    fontSize: 11,
    fontFamily: theme.fonts.monoBold,
    minWidth: 16,
  },
  ruleNumEmpty: {
    color: theme.colors.textMuted,
  },
  ruleLineInput: {
    flex: 1,
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
    paddingVertical: 8,
    minHeight: 34,
  },
  ruleRemoveBtn: {
    padding: 5,
    borderRadius: 6,
  },
  searchBarRow: { marginBottom: theme.spacing.sm },
  searchInput: { backgroundColor: theme.colors.card, borderColor: theme.colors.cardBorder, borderWidth: 1, borderRadius: theme.borderRadius.md, height: 38, paddingHorizontal: 12, color: theme.colors.textPrimary, fontSize: 11, fontFamily: theme.fonts.sansMedium, marginBottom: 6 },
  filterRow: { flexDirection: 'row', gap: 6 },
  filterPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.cardBorder },
  filterPillActive: { backgroundColor: withAlpha(theme.colors.primary, 0.2), borderColor: theme.colors.primary },
  filterPillText: { color: theme.colors.textMuted, fontSize: 9, fontFamily: theme.fonts.monoBold },
  filterPillTextActive: { color: theme.colors.textPrimary },
  saveSuccess: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8, paddingVertical: 8, backgroundColor: withAlpha(theme.colors.green, 0.1), borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: withAlpha(theme.colors.green, 0.3) },
  saveSuccessText: { color: theme.colors.green, fontSize: 11, fontFamily: theme.fonts.monoBold },

});
