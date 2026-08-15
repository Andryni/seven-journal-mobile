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
} from 'react-native';
import { usePlaybook, usePlaybookSetups } from '../features/playbook/usePlaybook';
import type { DailyDebrief, PlaybookSetup } from '../features/playbook/usePlaybook';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
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
  Star,
  Check,
  AlertTriangle,
  Layers,
} from 'lucide-react-native';

const COMMON_MISTAKES = [
  { id: 'revenge', label: 'Revenge Trading' },
  { id: 'fomo', label: 'FOMO' },
  { id: 'early_cut', label: 'Coupe anticipée' },
  { id: 'over_size', label: 'Over-Sizing' },
  { id: 'no_sl', label: 'No Stop Loss' },
  { id: 'chasing', label: 'Chasing price' },
];

const PLAYBOOK_RULES = [
  { id: 'wait_m15', label: 'Attendre confirmation M15' },
  { id: 'session_only', label: 'Trader en session seulement' },
  { id: 'tp_1r', label: 'TP ≥ 1R minimum' },
  { id: 'no_news', label: 'Éviter les news majeures' },
  { id: 'journal_before', label: 'Analyser HTF avant session' },
  { id: 'risk_managed', label: 'Risque ≤ 1% par trade' },
];

const EMOTIONS = ['Calme', 'Confiant', 'Anxieux', 'Euphorique', 'Frustré', 'Fatigué'];

export const PlaybookScreen: React.FC = () => {
  const { debriefs, isLoading: debriefsLoading, saveDebrief, deleteDebrief } = usePlaybook();
  const { setups, isLoading: setupsLoading, saveSetup, deleteSetup } = usePlaybookSetups();
  const { trades } = useTrades();

  const [activeTab, setActiveTab] = useState<'setups' | 'debrief' | 'discipline'>('setups');

  // Debrief Form State
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [marketSentiment, setMarketSentiment] = useState('');
  const [htfAnalysis, setHtfAnalysis] = useState('');
  const [lessonsLearned, setLessonsLearned] = useState('');
  const [objectiveTomorrow, setObjectiveTomorrow] = useState('');
  const [mentalScore, setMentalScore] = useState<number>(8);
  const [dayRating, setDayRating] = useState<number | null>(7);
  const [emotionBefore, setEmotionBefore] = useState('Calme');
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
      alert('Veuillez renseigner le nom de la stratégie.');
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
    alert('Débriefing enregistré dans votre journal !');
  };

  // Real Trade Stats per Setup
  const setupStats = useMemo(() => {
    return setups.map(s => {
      const matchingTrades = trades.filter((t: Trade) =>
        t.setup_structures.includes(s.title) ||
        (t.notes || '').toLowerCase().includes(s.title.toLowerCase())
      );
      const closed = matchingTrades.filter(t => t.pnl !== null);
      const w = closed.filter(t => (t.pnl || 0) > 0).length;
      const wr = closed.length > 0 ? (w / closed.length) * 100 : 0;
      const pnl = closed.reduce((sum, t) => sum + (t.pnl || 0), 0);
      return { setup: s, count: closed.length, winRate: wr, pnl };
    });
  }, [setups, trades]);

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
          <Text style={styles.screenTitle}>PLAYBOOK & STRATÉGIES</Text>
          <Text style={styles.screenSubtitle}>Gestion des setups, débriefings & discipline</Text>
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
            Mes Stratégies ({setups.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'debrief' && styles.tabBtnActive]}
          onPress={() => setActiveTab('debrief')}
        >
          <BookOpen color={activeTab === 'debrief' ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
          <Text style={[styles.tabBtnText, activeTab === 'debrief' && styles.tabBtnTextActive]}>
            Débriefing Journalier
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'discipline' && styles.tabBtnActive]}
          onPress={() => setActiveTab('discipline')}
        >
          <Brain color={activeTab === 'discipline' ? theme.colors.primaryLight : theme.colors.textMuted} size={14} />
          <Text style={[styles.tabBtnText, activeTab === 'discipline' && styles.tabBtnTextActive]}>
            Matrice Discipline
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── TAB 1 : MES STRATÉGIES PLAYBOOK ── */}
      {activeTab === 'setups' && (
        <View style={styles.tabContent}>
          <TouchableOpacity style={styles.addSetupBtn} onPress={openAddSetup}>
            <Plus size={16} color="#ffffff" />
            <Text style={styles.addSetupText}>AJOUTER UNE NOUVELLE STRATÉGIE</Text>
          </TouchableOpacity>

          {setupStats.length === 0 ? (
            <Text style={styles.emptyText}>Aucune stratégie enregistrée. Ajoutez vos setups !</Text>
          ) : (
            setupStats.map(({ setup: s, count, winRate, pnl }) => (
              <View key={s.id} style={styles.setupCard}>
                <View style={styles.setupHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.setupTitle}>🎯 {s.title}</Text>
                    {s.description ? (
                      <Text style={styles.setupDesc}>{s.description}</Text>
                    ) : null}
                  </View>
                  <View style={styles.setupActions}>
                    <TouchableOpacity onPress={() => openEditSetup(s)} style={styles.iconBtn}>
                      <Edit3 size={16} color={theme.colors.textSecondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteSetup(s.id)} style={styles.iconBtn}>
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
                    <Text style={styles.statCount}>{count} trades ({pnl >= 0 ? '+' : ''}${pnl.toFixed(0)})</Text>
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
          <Card title="DÉBRIEFING & PSYCHOLOGIE DU JOUR">
            <Text style={styles.fieldLabel}>DATE DU DÉBRIEFING</Text>
            <TextInput
              style={styles.input}
              value={selectedDate}
              onChangeText={setSelectedDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={styles.fieldLabel}>SENTIMENT DU MARCHÉ (HTF)</Text>
            <TextInput
              style={styles.input}
              value={marketSentiment}
              onChangeText={setMarketSentiment}
              placeholder="ex: Bearish structure, zone de rejet H4..."
              placeholderTextColor={theme.colors.textMuted}
            />

            <Text style={styles.fieldLabel}>ÉMOTION AVANT LA SESSION</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll}>
              {EMOTIONS.map(em => (
                <TouchableOpacity
                  key={em}
                  style={[styles.pill, emotionBefore === em && styles.pillActive]}
                  onPress={() => setEmotionBefore(em)}
                >
                  <Text style={[styles.pillText, emotionBefore === em && styles.whiteText]}>{em}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={styles.fieldLabel}>LEÇONS APPRISES & DISCIPLINE</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={lessonsLearned}
              onChangeText={setLessonsLearned}
              placeholder="Ce qui a bien fonctionné, ce qu'il faut corriger..."
              placeholderTextColor={theme.colors.textMuted}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.fieldLabel}>OBJECTIF POUR DEMAIN</Text>
            <TextInput
              style={styles.input}
              value={objectiveTomorrow}
              onChangeText={setObjectiveTomorrow}
              placeholder="ex: Attendre confirmation M15, max 2 trades..."
              placeholderTextColor={theme.colors.textMuted}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveDailyDebrief}>
              <Text style={styles.saveBtnText}>ENREGISTRER LE DÉBRIEFING</Text>
            </TouchableOpacity>
          </Card>
        </View>
      )}

      {/* ── TAB 3 : MATRICE DE DISCIPLINE ── */}
      {activeTab === 'discipline' && (
        <View style={styles.tabContent}>
          <Card title="ERREURS DE DISCIPLINE (SUIVI RÉCURRENT)">
            {COMMON_MISTAKES.map(m => {
              const isChecked = committedMistakes.includes(m.id);
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.mistakeRow, isChecked && styles.mistakeRowActive]}
                  onPress={() => {
                    setCommittedMistakes(prev =>
                      prev.includes(m.id) ? prev.filter(x => x !== m.id) : [...prev, m.id]
                    );
                  }}
                >
                  <View style={[styles.checkDot, isChecked && styles.checkDotRed]} />
                  <Text style={[styles.mistakeText, isChecked && styles.redText]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </Card>

          <Card title="RÈGLES DE TRADING RESPECTÉES">
            {PLAYBOOK_RULES.map(r => {
              const isChecked = rulesFollowed.includes(r.id);
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.mistakeRow, isChecked && styles.ruleRowActive]}
                  onPress={() => {
                    setRulesFollowed(prev =>
                      prev.includes(r.id) ? prev.filter(x => x !== r.id) : [...prev, r.id]
                    );
                  }}
                >
                  <View style={[styles.checkDot, isChecked && styles.checkDotGreen]} />
                  <Text style={[styles.mistakeText, isChecked && styles.greenText]}>{r.label}</Text>
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
                {editingSetup ? 'MODIFIER LA STRATÉGIE' : 'NOUVELLE STRATÉGIE PLAYBOOK'}
              </Text>
              <TouchableOpacity onPress={() => setSetupModalVisible(false)}>
                <X size={20} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>TITRE DU SETUP *</Text>
            <TextInput
              style={styles.input}
              placeholder="ex: FVG + BOS Reversal M5"
              placeholderTextColor={theme.colors.textMuted}
              value={setupTitle}
              onChangeText={setSetupTitle}
            />

            <Text style={styles.fieldLabel}>TIMEFRAMES (séparés par virgule)</Text>
            <TextInput
              style={styles.input}
              placeholder="M5, M15, H1"
              placeholderTextColor={theme.colors.textMuted}
              value={setupTimeframes}
              onChangeText={setSetupTimeframes}
            />

            <Text style={styles.fieldLabel}>RÈGLES DE VALIDATION (une par ligne)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="1. Prise de liquidité BSL&#10;2. Cassure BOS&#10;3. Retracement sur FVG"
              placeholderTextColor={theme.colors.textMuted}
              value={setupRules}
              onChangeText={setSetupRules}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSetup}>
              <Text style={styles.saveBtnText}>ENREGISTRER LE SETUP</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },
  screenSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
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
    fontWeight: '800',
  },
  tabBtnTextActive: {
    color: '#ffffff',
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
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
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
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  setupDesc: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    marginTop: 2,
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
    borderTopColor: 'rgba(255,255,255,0.04)',
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
    fontWeight: '900',
  },
  statCount: {
    color: theme.colors.textMuted,
    fontSize: 9,
  },
  fieldLabel: {
    color: theme.colors.textSecondary,
    fontSize: 9,
    fontWeight: '800',
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
    color: '#ffffff',
    fontSize: 12,
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
    fontWeight: '800',
  },
  whiteText: { color: '#ffffff' },
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
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  mistakeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
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
  },
  emptyText: {
    color: theme.colors.textMuted,
    fontSize: 11,
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
    backgroundColor: '#181920',
    borderColor: '#262833',
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
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
});
