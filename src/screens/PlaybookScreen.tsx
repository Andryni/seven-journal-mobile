import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { usePlaybook, usePlaybookSetups } from '../features/playbook/usePlaybook';
import { formatCurrency } from '../utils/formatCurrency';
import type { PlaybookSetup } from '../features/playbook/usePlaybook';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import type { TFunction } from '../i18n';
import { useT } from '../i18n';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import {
  BookOpen,
  Target,
  Brain,
  Plus,
  Trash2,
  Edit3,
  X,
} from 'lucide-react-native';

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

export const PlaybookScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { debriefs, isLoading: debriefsLoading, saveDebrief, isSaving, deleteDebrief } = usePlaybook();
  const { setups, isLoading: setupsLoading, saveSetup, deleteSetup } = usePlaybookSetups();
  const { trades } = useTrades();

  const [activeTab, setActiveTab] = useState<'setups' | 'debrief' | 'discipline'>('setups');

  // Debrief Form State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
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
    setSetupModalVisible(true);
  };

  const openEditSetup = (s: PlaybookSetup) => {
    setEditingSetup(s);
    setSetupTitle(s.title);
    setSetupDesc(s.description || '');
    setSetupTimeframes(s.timeframes.join(', '));
    setSetupRules(s.validation_rules.join('\n'));
    setSetupTags(s.tags.join(', '));
    setSetupModalVisible(true);
  };

  const handleSaveSetup = async () => {
    if (!setupTitle.trim()) {
      alert(t('setupNameRequired'));
      return;
    }
    const payload = {
      title: setupTitle.trim(),
      description: setupDesc.trim() || null,
      timeframes: setupTimeframes.split(',').map(s => s.trim()).filter(Boolean),
      validation_rules: setupRules.split('\n').map(s => s.trim()).filter(Boolean),
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
    alert(editingDebriefId ? t('debriefUpdated') : t('debriefSaved'));
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

  // Real Trade Stats per Setup (100% fidélité à la version web)
  const setupStats = useMemo(() => {
    return setups.map(s => {
      const titleLower = s.title.toLowerCase().trim();
      const matchingTrades = trades.filter((t: Trade) => {
        // 1. Direct match in setup_structures array
        if (t.setup_structures && t.setup_structures.some(st => st.toLowerCase().trim() === titleLower)) return true;
        // 2. Direct match in notes
        const notesLower = (t.notes || '').toLowerCase();
        if (notesLower.includes(titleLower)) return true;
        // 3. Technical confirmations check
        if (titleLower.includes('bos') && t.setup_structures && t.setup_structures.includes('BOS')) return true;
        if ((titleLower.includes('ob') || titleLower.includes('order block')) && t.setup_ob) return true;
        if ((titleLower.includes('fvg') || titleLower.includes('gap')) && t.setup_fvg) return true;
        if ((titleLower.includes('sweep') || titleLower.includes('liquidity')) && t.setup_liquidity_sweep) return true;
        if (setups.length === 1) return true;
        return false;
      });
      const closed = matchingTrades.filter(t => t.pnl !== null);
      const w = closed.filter(t => (t.pnl || 0) > 0).length;
      const wr = closed.length > 0 ? (w / closed.length) * 100 : 0;
      const pnl = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return { setup: s, count: closed.length, winRate: wr, pnl };
    });
  }, [setups, trades]);

  // Débriefings triés par date décroissante (plus récent en premier)
  const sortedDebriefs = useMemo(() => {
    return [...debriefs].sort((a, b) => b.date.localeCompare(a.date));
  }, [debriefs]);

  if (debriefsLoading || setupsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.colors.primary} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
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
        >
          <Target color={activeTab === 'setups' ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
          <Text style={[styles.tabBtnText, activeTab === 'setups' && styles.tabBtnTextActive]}>
            {t('myStrategies')} ({setups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'debrief' && styles.tabBtnActive]}
          onPress={() => setActiveTab('debrief')}
        >
          <BookOpen color={activeTab === 'debrief' ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
          <Text style={[styles.tabBtnText, activeTab === 'debrief' && styles.tabBtnTextActive]}>
            {t('dailyDebrief')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'discipline' && styles.tabBtnActive]}
          onPress={() => setActiveTab('discipline')}
        >
          <Brain color={activeTab === 'discipline' ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
          <Text style={[styles.tabBtnText, activeTab === 'discipline' && styles.tabBtnTextActive]}>
            {t('disciplineMatrix')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1 : MES STRATÉGIES PLAYBOOK ── */}
      {activeTab === 'setups' && (
        <View style={styles.tabContent}>
          <TouchableOpacity style={styles.addSetupBtn} onPress={openAddSetup}>
            <Plus size={16} color={theme.colors.textPrimary} />
            <Text style={styles.addSetupText}>{t('addNewStrategy')}</Text>
          </TouchableOpacity>

          {setupStats.length === 0 ? (
            <Text style={styles.emptyText}>{t('noStrategy')}</Text>
          ) : (
            setupStats.map(({ setup: s, count, winRate, pnl }) => (
              <View key={s.id} style={styles.setupCard}>
                <View style={styles.setupHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.setupTitle}>{s.title}</Text>
                    {s.description ? (
                      <Text style={styles.setupDesc}>{s.description}</Text>
                    ) : null}
                    {s.validation_rules.length > 0 && (
                      <View style={{ marginTop: 4 }}>
                        {s.validation_rules.map((rule, idx) => (
                          <Text key={idx} style={styles.ruleItem}>• {rule}</Text>
                        ))}
                      </View>
                    )}
                  </View>
                  <View style={styles.setupActions}>
                    <TouchableOpacity
                      onPress={() => openEditSetup(s)}
                      style={styles.iconBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t('a11yEditSetup', s.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Edit3 size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteSetup(s.id)}
                      style={styles.iconBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t('a11yDeleteSetup', s.title)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color={theme.colors.redLight} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.setupMetaRow}>
                  <View style={styles.tagWrap}>
                    {s.timeframes.map(tf => (
                      <Badge key={tf} label={tf} variant="blue" />
                    ))}
                    {s.tags.map(tg => (
                      <Badge key={tg} label={tg} variant="neutral" />
                    ))}
                  </View>

                  <View style={styles.statsBadge}>
                    <Text style={[styles.statWr, winRate >= 50 ? styles.greenText : styles.redText]}>
                      {winRate.toFixed(0)}% WR
                    </Text>
                    <Text style={styles.statCount}>{count} trades ({formatCurrency(pnl, { decimals: 0 })})</Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* ── TAB 2 : DÉBRIEFING JOURNALIER ── */}
      {activeTab === 'debrief' && (
        <View style={styles.tabContent}>
          <Card title={t('debriefTitle')}>
            <Text style={styles.fieldLabel}>{t('debriefDate')}</Text>
            <TextInput
              style={styles.input}
              value={selectedDate}
              onChangeText={setSelectedDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
            />

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
          </Card>

          {/* Historique des débriefings */}
          <Card
            title={t('debriefHistory', sortedDebriefs.length)}
            headerAction={
              sortedDebriefs.length > 0 ? (
                <TouchableOpacity
                  onPress={() => {
                    setEditingDebriefId(null);
                    setSelectedDate(new Date().toISOString().split('T')[0]);
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

      {/* ── TAB 3 : MATRICE DE DISCIPLINE ── */}
      {activeTab === 'discipline' && (
        <View style={styles.tabContent}>
          <Card title={t('mistakesCard')}>
            {COMMON_MISTAKES.map(id => {
              const isChecked = committedMistakes.includes(id);
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.mistakeRow, isChecked && styles.mistakeRowActive]}
                  onPress={() => {
                    setCommittedMistakes(prev =>
                      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                    );
                  }}
                >
                  <View style={[styles.checkDot, isChecked && styles.checkDotRed]} />
                  <Text style={[styles.mistakeText, isChecked && styles.redText]}>{mistakeLabel(t, id)}</Text>
                </TouchableOpacity>
              );
            })}
          </Card>

          <Card title={t('rulesCard')}>
            {PLAYBOOK_RULES.map(id => {
              const isChecked = rulesFollowed.includes(id);
              return (
                <TouchableOpacity
                  key={id}
                  style={[styles.mistakeRow, isChecked && styles.ruleRowActive]}
                  onPress={() => {
                    setRulesFollowed(prev =>
                      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                    );
                  }}
                >
                  <View style={[styles.checkDot, isChecked && styles.checkDotGreen]} />
                  <Text style={[styles.mistakeText, isChecked && styles.greenText]}>{ruleLabel(t, id)}</Text>
                </TouchableOpacity>
              );
            })}
          </Card>
        </View>
      )}

      {/* Modal Ajout / Modification Stratégie */}
      <Modal visible={setupModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingSetup ? t('editSetup') : t('newSetup')}
              </Text>
              <TouchableOpacity
                onPress={() => setSetupModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel={t('a11yCloseSetupForm')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={20} color={theme.colors.textPrimary} />
              </TouchableOpacity>
            </View>

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
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('phSetupRules')}
              placeholderTextColor={theme.colors.textMuted}
              value={setupRules}
              onChangeText={setSetupRules}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSetup}>
              <Text style={styles.saveBtnText}>{t('saveSetup')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
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
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
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
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
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
  mistakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.cardBorder,
  },
  mistakeRowActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
  },
  ruleRowActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
  },
  checkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.textMuted,
  },
  checkDotRed: { backgroundColor: theme.colors.red },
  checkDotGreen: { backgroundColor: theme.colors.green },
  mistakeText: {
    color: theme.colors.textPrimary,
    fontSize: 12,
    fontFamily: theme.fonts.sansMedium,
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontFamily: theme.fonts.sans,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    padding: theme.spacing.md,
  },
  modalContent: {
    backgroundColor: theme.colors.modalBg,
    borderColor: theme.colors.borderStrong,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modalTitle: {
    color: theme.colors.textPrimary,
    fontSize: 14,
    fontFamily: theme.fonts.sansBold,
  },
});
