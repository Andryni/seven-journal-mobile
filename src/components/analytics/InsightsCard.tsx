import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Bot,
  Lock,
} from 'lucide-react-native';
import { Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT, localeFor } from '../../i18n';
import { Panel, Hairline } from '../ui/Panel';
import { duration, stagger } from '../../theme/motion';
import { computeInsights, MIN_TRADES_FOR_INSIGHTS } from '../../features/insights/computeInsights';
import { useCoach } from '../../features/insights/useCoach';
import type { Insight, InsightSeverity } from '../../features/insights/computeInsights';
import type { Trade } from '../../types/domain';
import type { DailyDebrief } from '../../features/playbook/usePlaybook';

interface InsightsCardProps {
  /** Already account-scoped, like every other figure in the app. */
  trades: Trade[];
  /** The user's own strategies; only these can be named as a best setup. */
  playbookSetups?: { title: string }[];
  /** Debriefs, for the discipline aggregates in the AI summary. */
  debriefs?: DailyDebrief[];
}

const ICONS: Record<InsightSeverity, React.FC<{ color: string; size: number }>> = {
  critical: AlertTriangle,
  warning: AlertCircle,
  good: CheckCircle2,
};

/**
 * Journal analysis — statistical findings over the trader's own history.
 *
 * Shows nothing until there is enough history to be honest about, and says so
 * explicitly rather than rendering an empty card: "not enough data yet" is
 * information, a blank panel is a bug.
 */
export const InsightsCard: React.FC<InsightsCardProps> = ({
  trades,
  playbookSetups = [],
  debriefs = [],
}) => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  /**
   * Only the user's own strategy titles are eligible to be named as a best
   * setup. See computeInsights: setup_structures still holds fixed ICT labels
   * written by an older version of the app.
   */
  const playbookTitles = useMemo(
    () => playbookSetups.map(p => p.title).filter(Boolean),
    [playbookSetups]
  );

  const result = useMemo(
    () => computeInsights(trades, playbookTitles),
    [trades, playbookTitles]
  );
  const coach = useCoach(trades, lang, playbookTitles, debriefs);

  const coachErrorKey = {
    not_enough_data: 'coachErrorNotEnough',
    not_configured: 'coachErrorNotConfigured',
    rate_limited: 'coachErrorRateLimited',
    model_not_found: 'coachErrorModelNotFound',
    not_deployed: 'coachErrorNotDeployed',
    unauthorized: 'coachErrorUnauthorized',
    network: 'coachErrorNetwork',
    unknown: 'coachErrorUnknown',
  } as const;

  const severityColor: Record<InsightSeverity, string> = {
    critical: theme.colors.red,
    warning: theme.colors.gold,
    good: theme.colors.green,
  };

  /** Weekday index -> localized name, so the UI never prints "Day 2". */
  const weekdayName = (index: number) => {
    const ref = new Date(2026, 0, 4 + index); // 2026-01-04 is a Sunday
    return ref.toLocaleDateString(localeFor(lang), { weekday: 'long' });
  };

  const describe = (i: Insight): string => {
    const params =
      i.id === 'losing-weekday'
        ? { ...i.params, day: weekdayName(Number(i.params.day)) }
        : i.params;
    return t(i.titleKey as never, params as never);
  };

  return (
    <Panel>
      <View style={styles.header}>
        <Sparkles color={theme.colors.primary} size={14} strokeWidth={2} />
        <Text style={styles.title}>{t('insightsTitle')}</Text>
        {result.hasEnoughData ? (
          <Text style={styles.subtitle}>{t('insightsSubtitle', result.tradesAnalysed)}</Text>
        ) : null}
      </View>

      <Hairline />

      {!result.hasEnoughData ? (
        <Text style={styles.empty}>
          {t('insightsNotEnough', result.tradesAnalysed, MIN_TRADES_FOR_INSIGHTS)}
        </Text>
      ) : result.insights.length === 0 ? (
        <Text style={styles.empty}>{t('insightsAllClear')}</Text>
      ) : (
        result.insights.map((insight, index) => {
          const Icon = ICONS[insight.severity];
          const color = severityColor[insight.severity];
          return (
            <Animated.View
              key={insight.id}
              entering={FadeInDown.delay(stagger(index)).duration(duration.fast)}
              style={styles.row}
            >
              <View style={[styles.rail, { backgroundColor: color }]} />
              <Icon color={color} size={14} />
              <View style={styles.body}>
                <Text style={styles.text}>{describe(insight)}</Text>
                <Text style={styles.note}>{t('insightSampleNote', insight.sampleSize)}</Text>
              </View>
            </Animated.View>
          );
        })
      )}

      {/* Opt-in narrative layer. The findings above are already complete
          without it: this only turns them into prose, on demand, and the
          request is never fired automatically. Shown whenever there is enough
          history — even with zero specific findings, because a disciplined
          journal triggers no rule and the aggregate ratios alone still make
          a briefing. Hiding the button there made the feature look broken. */}
      {result.hasEnoughData ? (
        <>
          <Hairline />
          <View style={styles.coach}>
            {coach.result ? (
              <>
                <Text style={styles.coachBody}>{coach.result.briefing}</Text>
                {coach.result.priority ? (
                  <View style={styles.priorityBox}>
                    <Text style={styles.priorityLabel}>{t('coachPriority')}</Text>
                    <Text style={styles.coachBody}>{coach.result.priority}</Text>
                  </View>
                ) : null}
              </>
            ) : null}

            {coach.error ? (
              <>
                <Text style={styles.coachError}>{t(coachErrorKey[coach.error])}</Text>
                {/* The provider's own words. Shown because the Supabase CLI
                    has no `functions logs`, so this is the only place the
                    real cause can surface. */}
                {coach.detail ? (
                  <Text style={styles.coachErrorDetail} numberOfLines={3}>
                    {coach.detail}
                  </Text>
                ) : null}
              </>
            ) : null}

            <Pressable
              onPress={coach.ask}
              disabled={coach.loading}
              accessibilityRole="button"
              style={({ pressed }) => [styles.coachBtn, pressed && { opacity: 0.6 }]}
            >
              {coach.loading ? (
                <ActivityIndicator size="small" color={theme.colors.primary} />
              ) : (
                <Bot color={theme.colors.primary} size={14} />
              )}
              <Text style={styles.coachBtnText}>
                {coach.loading
                  ? t('coachLoading')
                  : coach.result
                    ? t('coachAgain')
                    : t('coachAsk')}
              </Text>
            </Pressable>

            {/* Stated at the point of action, not buried in a settings page. */}
            <View style={styles.privacyRow}>
              <Lock color={theme.colors.textMuted} size={10} />
              <Text style={styles.privacyText}>{t('coachPrivacy')}</Text>
            </View>
          </View>
        </>
      ) : null}
    </Panel>
  );
};
const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      marginBottom: theme.spacing.sm,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.1,
    },
    subtitle: {
      marginLeft: 'auto',
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      fontVariant: ['tabular-nums'],
    },
    empty: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
      lineHeight: 18,
      paddingTop: theme.spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 9,
      paddingTop: theme.spacing.sm,
      paddingBottom: 2,
    },
    rail: {
      width: 2,
      alignSelf: 'stretch',
      marginRight: 2,
    },
    body: { flex: 1 },
    text: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
      lineHeight: 18,
    },
    coach: { paddingTop: theme.spacing.sm, gap: theme.spacing.sm },
    coachBody: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
      lineHeight: 19,
    },
    priorityBox: {
      borderLeftWidth: 2,
      borderLeftColor: theme.colors.primary,
      paddingLeft: theme.spacing.sm,
      gap: 3,
    },
    priorityLabel: {
      color: theme.colors.primary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
    },
    coachErrorDetail: {
    color: theme.colors.textMuted,
    fontSize: theme.type.micro,
    fontFamily: theme.fonts.mono,
    marginTop: 4,
    textAlign: 'center',
  },
  coachError: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
    },
    coachBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 9,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
    },
    coachBtnText: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    privacyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5 },
    privacyText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      lineHeight: 14,
    },
    note: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      marginTop: 2,
      fontVariant: ['tabular-nums'],
    },
  });
