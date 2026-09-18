import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Send, Trash2, Lock, Sparkles } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme, withAlpha } from '../theme';
import type { AppTheme } from '../theme';
import { useT } from '../i18n';
import { PressableScale } from '../components/ui/PressableScale';
import { ThinkingIndicator } from '../components/ui/ThinkingIndicator';
import { useTrades } from '../features/trades/useTrades';
import { useDailyLock } from '../features/guard/useDailyLock';
import { useAccounts } from '../features/accounts/useAccounts';
import { useUIStore } from '../store/uiStore';
import { scopeTrades } from '../features/accounts/accountScope';
import { useChat } from '../features/chat/useChat';
import { auditCompleteness } from '../features/trades/tradeCompleteness';

/**
 * Conversation with the journal.
 *
 * Distinct from the Analytics summary, which is a one-shot briefing over
 * anonymous findings and needs twenty trades to say anything. This works from
 * the first trade: a question about one execution is legitimate, and the
 * model is told to avoid statistical claims a small sample cannot carry.
 */
export const ChatScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t, lang } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const { trades } = useTrades();
  const { accounts } = useAccounts();
  const activeAccountId = useUIStore(st => st.activeAccountId);
  const { isLocked } = useDailyLock();

  const scoped = useMemo(
    () => scopeTrades(trades, activeAccountId),
    [trades, activeAccountId]
  );
  const account = useMemo(
    () => accounts.find(a => a.id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const chat = useChat({ trades: scoped, account, locale: lang, isLocked });
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    // Keep the newest turn in view as the conversation grows.
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    return () => clearTimeout(id);
  }, [chat.messages.length, chat.loading]);

  const errorKey: Record<string, string> = {
    not_configured: 'coachErrorNotConfigured',
    not_deployed: 'coachErrorNotDeployed',
    model_not_found: 'coachErrorModelNotFound',
    unauthorized: 'coachErrorUnauthorized',
    rate_limited: 'coachErrorRateLimited',
    network: 'coachErrorNetwork',
    unknown: 'coachErrorUnknown',
  };

  const closedCount = scoped.filter(tr => tr.pnl !== null && tr.pnl !== undefined).length;

  // Whether the journal has context gaps worth asking about.
  const hasGaps = useMemo(() => {
    const closed = scoped.filter(tr => tr.pnl !== null && tr.pnl !== undefined);
    return closed.length > 0 && auditCompleteness(closed).incomplete > 0;
  }, [scoped]);

  const suggestions = [
    t('chatSuggest1'),
    t('chatSuggest2'),
    t('chatSuggest3'),
    // Only offered once the bridge has actually left gaps: suggesting it on a
    // hand-written journal would point at nothing.
    ...(hasGaps ? [t('chatSuggest4')] : []),
  ];

  const onSend = (text: string) => {
    chat.send(text);
    setDraft('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles size={15} color={theme.colors.primary} strokeWidth={2} />
          <Text style={styles.title}>{t('chatTitle')}</Text>
          {/* What the coach is looking at. With no account selected the chat
              aggregates every account, so the chip names that too — silence
              here is how a mixed-currency answer surprises someone. */}
          <View style={styles.accountChip}>
            <Text style={styles.accountChipText} numberOfLines={1}>
              {account ? account.name.toUpperCase() : t('chatAccountChip')}
            </Text>
          </View>
        </View>
        {chat.messages.length > 0 ? (
          <PressableScale
            onPress={chat.clear}
            hitSlop={12}
            accessibilityLabel={t('chatClear')}
          >
            <Trash2 size={15} color={theme.colors.textMuted} strokeWidth={1.75} />
          </PressableScale>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.thread}
        contentContainerStyle={styles.threadContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {chat.messages.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>{t('chatEmptyTitle')}</Text>
            <Text style={styles.emptyBody}>
              {closedCount === 0 ? t('chatEmptyNoTrades') : t('chatEmptyBody')}
            </Text>

            {closedCount > 0
              ? suggestions.map(s => (
                  <PressableScale
                    key={s}
                    style={styles.suggestion}
                    onPress={() => onSend(s)}
                    accessibilityLabel={s}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </PressableScale>
                ))
              : null}

            {/* Stated up front, not buried in settings: this is the one
                feature that sends trades off the device. */}
            <View style={styles.privacy}>
              <Lock size={11} color={theme.colors.textMuted} strokeWidth={1.75} />
              <Text style={styles.privacyText}>{t('chatPrivacy')}</Text>
            </View>
          </View>
        ) : null}

        {chat.messages.map(m => (
          <Animated.View
            key={m.id}
            entering={FadeIn.duration(180)}
            style={[styles.bubble, m.role === 'user' ? styles.bubbleUser : styles.bubbleModel]}
          >
            <Text style={m.role === 'user' ? styles.textUser : styles.textModel}>{m.text}</Text>
          </Animated.View>
        ))}

        {chat.loading ? (
          <Animated.View entering={FadeIn.duration(160)} style={styles.thinking}>
            <ThinkingIndicator />
          </Animated.View>
        ) : null}

        {chat.error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{t(errorKey[chat.error] as never)}</Text>
            {chat.detail ? (
              <Text style={styles.errorDetail} numberOfLines={3}>
                {chat.detail}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('chatPlaceholder')}
          placeholderTextColor={theme.colors.textDark}
          multiline
          maxLength={1200}
          editable={!chat.loading}
          onSubmitEditing={() => onSend(draft)}
          accessibilityLabel={t('chatPlaceholder')}
        />
        <PressableScale
          style={[styles.sendBtn, (!draft.trim() || chat.loading) && styles.sendBtnOff]}
          onPress={() => onSend(draft)}
          disabled={!draft.trim() || chat.loading}
          accessibilityLabel={t('chatSend')}
        >
          {chat.loading ? (
            <ActivityIndicator size="small" color={theme.colors.background} />
          ) : (
            <Send size={16} color={theme.colors.background} strokeWidth={2} />
          )}
        </PressableScale>
      </View>
    </KeyboardAvoidingView>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: 14,
      paddingBottom: 10,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
    accountChip: {
      marginLeft: 6,
      paddingHorizontal: 7,
      paddingVertical: 2.5,
      borderRadius: 4,
      backgroundColor: withAlpha(theme.colors.primary, 0.12),
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.primary, 0.25),
      maxWidth: 140,
    },
    accountChipText: {
      color: theme.colors.primaryLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },

    thread: { flex: 1 },
    threadContent: { paddingHorizontal: 14, paddingBottom: 16 },

    empty: { paddingTop: 24, paddingHorizontal: 4 },
    emptyTitle: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.body,
      fontFamily: theme.fonts.monoBold,
      marginBottom: 6,
    },
    emptyBody: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
      lineHeight: 17,
      marginBottom: 16,
    },
    suggestion: {
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      backgroundColor: theme.colors.surface,
      borderRadius: 10,
      paddingHorizontal: 13,
      paddingVertical: 11,
      marginBottom: 8,
    },
    suggestionText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
    },
    privacy: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 6,
      marginTop: 14,
      paddingRight: 8,
    },
    privacyText: {
      flex: 1,
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      lineHeight: 14,
    },

    bubble: {
      maxWidth: '88%',
      borderRadius: 12,
      paddingHorizontal: 13,
      paddingVertical: 10,
      marginBottom: 9,
    },
    bubbleUser: {
      alignSelf: 'flex-end',
      backgroundColor: withAlpha(theme.colors.primary, 0.16),
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.primary, 0.35),
    },
    bubbleModel: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    textUser: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
      lineHeight: 18,
    },
    textModel: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
      lineHeight: 18,
    },

    thinking: { alignSelf: 'flex-start', paddingVertical: 8, paddingLeft: 4 },

    errorBox: {
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.red, 0.4),
      backgroundColor: withAlpha(theme.colors.red, 0.1),
      borderRadius: 10,
      padding: 11,
      marginTop: 4,
    },
    errorText: {
      color: theme.colors.redLight,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
    },
    errorDetail: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.mono,
      marginTop: 4,
    },

    composer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 8,
      paddingBottom: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.hairline,
    },
    input: {
      flex: 1,
      maxHeight: 110,
      minHeight: 42,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingTop: 11,
      paddingBottom: 11,
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
    },
    sendBtn: {
      width: 42,
      height: 42,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.primary,
    },
    sendBtnOff: { opacity: 0.4 },
  });
