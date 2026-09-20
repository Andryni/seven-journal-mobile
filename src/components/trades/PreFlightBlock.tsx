import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, ClipboardCheck, Plus, ShieldCheck } from 'lucide-react-native';
import { useTheme, withAlpha } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { PressableScale } from '../ui/PressableScale';
import { DEFAULT_PREFLIGHT_KEYS } from '../../features/guard/preFlight';
import type { ChecklistItem } from '../../features/guard/useChecklist';

interface Props {
  items: ChecklistItem[];
  /** True when today still needs a completion and the trader has items. */
  required: boolean;
  ticked: string[];
  onToggle: (id: string) => void;
  onComplete: () => Promise<void>;
  onSeed: () => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  isSaving: boolean;
}

/**
 * The pre-flight, inline in the entry sheet rather than behind a modal.
 *
 * A checklist in a second screen is a checklist nobody opens: the trader is
 * mid-entry, the rule has to be in front of them at that exact moment. It is
 * also the only moment in the app that speaks before the trade exists — the
 * Lock Guard, for all its value, only ever speaks after.
 *
 * Three states, and each says something different:
 *   * no items yet  → the checklist is OFFERED (four written rules, not ten);
 *   * items, day not confirmed → the items themselves, and the save waits;
 *   * confirmed today → one quiet line. A ritual that keeps shouting after it
 *     has been performed is noise.
 */
export const PreFlightBlock: React.FC<Props> = ({
  items,
  required,
  ticked,
  onToggle,
  onComplete,
  onSeed,
  onRemove,
  isSaving,
}) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (items.length === 0) {
    return (
      <View style={styles.wrap}>
        <View style={styles.head}>
          <ClipboardCheck size={13} color={theme.colors.textMuted} strokeWidth={2} />
          <Text style={styles.title}>{t('preflightTitle')}</Text>
        </View>
        <Text style={styles.hint}>{t('preflightNoneHint')}</Text>
        <PressableScale
          style={[styles.ghostBtn, isSaving && styles.off]}
          onPress={() => onSeed()}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel={t('preflightCreate')}
        >
          <Plus size={13} color={theme.colors.textSecondary} strokeWidth={2} />
          <Text style={styles.ghostText}>{t('preflightCreate')}</Text>
        </PressableScale>
      </View>
    );
  }

  if (!required) {
    return (
      <View style={[styles.wrap, styles.doneWrap]}>
        <View style={styles.head}>
          <ShieldCheck size={13} color={theme.colors.green} strokeWidth={2} />
          <Text style={[styles.title, { color: theme.colors.green }]}>
            {t('preflightDoneToday', String(items.length))}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <ClipboardCheck size={13} color={theme.colors.gold} strokeWidth={2} />
        <Text style={[styles.title, { color: theme.colors.gold }]}>{t('preflightTitle')}</Text>
      </View>
      <Text style={styles.hint}>{t('preflightRequiredHint')}</Text>

      {items.map(item => {
        const on = ticked.includes(item.id);
        return (
          <PressableScale
            key={item.id}
            style={styles.row}
            onPress={() => onToggle(item.id)}
            onLongPress={() => onRemove(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={item.text}
          >
            <View style={[styles.box, on && styles.boxOn]}>
              {on ? <Check size={11} color={theme.colors.background} strokeWidth={3} /> : null}
            </View>
            <Text style={[styles.rowText, on && styles.rowTextOn]}>{item.text}</Text>
          </PressableScale>
        );
      })}

      <PressableScale
        style={[styles.btn, (!items.every(i => ticked.includes(i.id)) || isSaving) && styles.off]}
        onPress={() => onComplete()}
        disabled={!items.every(i => ticked.includes(i.id)) || isSaving}
        accessibilityRole="button"
        accessibilityLabel={t('preflightValidate')}
      >
        <Text style={styles.btnText}>{t('preflightValidate')}</Text>
      </PressableScale>
      {/* Long press deletes; said out loud because nothing else would reveal it. */}
      <Text style={styles.tiny}>{t('preflightRemoveHint')}</Text>
    </View>
  );
};

/** The four items seeded for a trader who has none. */
export function defaultPreFlightLabels(t: (key: never) => string): string[] {
  return DEFAULT_PREFLIGHT_KEYS.map(key => t(key as never));
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    wrap: {
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    doneWrap: { borderColor: withAlpha(theme.colors.green, 0.35) },
    head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    hint: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
      lineHeight: 15,
      marginBottom: theme.spacing.sm,
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
    box: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    boxOn: { backgroundColor: theme.colors.green, borderColor: theme.colors.green },
    rowText: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
    },
    rowTextOn: { color: theme.colors.textPrimary },
    btn: {
      marginTop: theme.spacing.sm,
      borderRadius: theme.borderRadius.sm,
      backgroundColor: theme.colors.gold,
      paddingVertical: theme.spacing.sm,
      alignItems: 'center',
    },
    off: { opacity: 0.45 },
    btnText: {
      color: theme.colors.background,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    ghostBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      paddingVertical: theme.spacing.sm,
    },
    ghostText: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.6,
    },
    tiny: {
      color: theme.colors.textDark,
      fontSize: 9,
      fontFamily: theme.fonts.sans,
      marginTop: 5,
      textAlign: 'center',
    },
  });
