import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useTrades } from '../features/trades/useTrades';
import type { Trade } from '../types/domain';
import { theme } from '../theme';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { BookOpen, AlertCircle, CheckCircle, Brain, Target } from 'lucide-react-native';

const COMMON_MISTAKES = [
  { id: 'fomo', label: 'FOMO / Entrée tardive', desc: 'Entrée après l\'impulsion sans retracement' },
  { id: 'overleverage', label: 'Overleverage / Taille excessive', desc: 'Taille supérieure au risque défini' },
  { id: 'moving_sl', label: 'Déplacement de Stop Loss', desc: 'Recul du SL en cours de trade' },
  { id: 'early_exit', label: 'Sortie prématurée de peur', desc: 'Coupe du trade avant le TP' },
  { id: 'revenge', label: 'Revenge Trading', desc: 'Trade impulsif immédiatement après une perte' },
];

export const PlaybookScreen: React.FC = () => {
  const { trades, isLoading } = useTrades();
  const [selectedMistakes, setSelectedMistakes] = useState<string[]>([]);

  const closedTrades = trades.filter((t: Trade) => t.pnl !== null);

  // Setups Win Rate computation
  const setupStats = useMemo(() => {
    const setups = ['BOS', 'OB', 'FVG', 'Liquidity Sweep'];
    return setups.map(s => {
      let matching: Trade[] = [];
      if (s === 'BOS') matching = closedTrades.filter(t => t.setup_structures.includes('BOS'));
      if (s === 'OB') matching = closedTrades.filter(t => t.setup_ob);
      if (s === 'FVG') matching = closedTrades.filter(t => t.setup_fvg);
      if (s === 'Liquidity Sweep') matching = closedTrades.filter(t => t.setup_liquidity_sweep);

      const wins = matching.filter(t => (t.pnl || 0) > 0).length;
      const winRate = matching.length > 0 ? ((wins / matching.length) * 100).toFixed(0) : '0';
      const pnl = matching.reduce((acc, t) => acc + (t.pnl || 0), 0);

      return { setup: s, count: matching.length, wins, winRate, pnl };
    });
  }, [closedTrades]);

  const toggleMistake = (id: string) => {
    setSelectedMistakes(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);
  };

  if (isLoading) {
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
        <Text style={styles.screenTitle}>PLAYBOOK & DISCIPLINE</Text>
        <Text style={styles.screenSubtitle}>Psychologie de trading & suivi des setups</Text>
      </View>

      {/* SETUPS PERFORMANCE MATRIX */}
      <Card title="PERFORMANCE PAR SETUP (WIN RATE)">
        {setupStats.map(s => (
          <View key={s.setup} style={styles.setupRow}>
            <View>
              <Text style={styles.setupName}>{s.setup}</Text>
              <Text style={styles.setupCount}>{s.count} trades exécutés</Text>
            </View>
            <View style={styles.alignRight}>
              <Text style={[styles.setupWinRate, Number(s.winRate) >= 50 ? styles.greenText : styles.redText]}>
                {s.winRate}% WR
              </Text>
              <Text style={[styles.setupPnl, s.pnl >= 0 ? styles.greenText : styles.redText]}>
                {s.pnl >= 0 ? '+' : ''}${s.pnl.toFixed(2)}
              </Text>
            </View>
          </View>
        ))}
      </Card>

      {/* DISCIPLINE & ERREURS COURANTES */}
      <Card title="MATRICE DES ERREURS DE DISCIPLINE">
        <Text style={styles.cardDesc}>
          Cochez les erreurs commises aujourd'hui pour identifier vos patterns récurrents.
        </Text>
        <View style={styles.mistakesList}>
          {COMMON_MISTAKES.map(m => {
            const isCommitted = selectedMistakes.includes(m.id);
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.mistakeItem, isCommitted && styles.mistakeActive]}
                onPress={() => toggleMistake(m.id)}
              >
                <View style={[styles.statusDot, isCommitted && styles.dotRed]} />
                <View style={styles.mistakeContent}>
                  <Text style={[styles.mistakeTitle, isCommitted && styles.redText]}>{m.label}</Text>
                  <Text style={styles.mistakeDesc}>{m.desc}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </Card>
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
    marginBottom: theme.spacing.lg,
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
  setupRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  setupName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  setupCount: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  alignRight: {
    alignItems: 'flex-end',
  },
  setupWinRate: {
    fontSize: 14,
    fontWeight: '900',
  },
  setupPnl: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  greenText: {
    color: theme.colors.greenLight,
  },
  redText: {
    color: theme.colors.redLight,
  },
  cardDesc: {
    color: theme.colors.textSecondary,
    fontSize: 11,
    marginBottom: theme.spacing.md,
  },
  mistakesList: {
    gap: theme.spacing.sm,
  },
  mistakeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
  },
  mistakeActive: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.textMuted,
    marginRight: theme.spacing.md,
  },
  dotRed: {
    backgroundColor: theme.colors.red,
  },
  mistakeContent: {
    flex: 1,
  },
  mistakeTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  mistakeDesc: {
    color: theme.colors.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
});
