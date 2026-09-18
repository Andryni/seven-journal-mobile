import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Share } from 'react-native';
import { ChevronRight, Copy, Check } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { withAlpha } from '../../theme';
import { useT } from '../../i18n';
import { PressableScale } from '../ui/PressableScale';

// The ingest endpoint is public by design (the per-connector secret is the
// credential), so the real project URL can live in the bundle — the setup
// sheet then shows a copy-pasteable truth instead of a placeholder.
const WS_URL = 'https://aeqyqwchxvcfvbbapqch.supabase.co/functions/v1/sync-ingest';

/**
 * Overlay shown right after a connector is created: the webhook URL and the
 * secret, which the server never returns again. Share puts both on the
 * clipboard in one gesture — the URL alone is useless without its credential.
 */
export const SetupSheet: React.FC<{
  label: string;
  secret: string;
  onDone: () => void;
}> = ({ label, secret, onDone }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [copied, setCopied] = useState(false);

  const copySecret = async () => {
    try {
      await Share.share({ message: `${WS_URL}\n${secret}` });
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // share cancelled
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.sheet}>
        <Text style={styles.title}>{t('syncSetupTitle')}</Text>
        <Text style={styles.sub}>
          {label} — {t('syncSetupSub')}
        </Text>

        <Text style={styles.fieldLabel}>{t('syncSetupUrl')}</Text>
        <View style={styles.fieldBox}>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {WS_URL}
          </Text>
        </View>

        <Text style={styles.fieldLabel}>{t('syncSetupSecret')}</Text>
        <PressableScale style={styles.fieldBox} onPress={copySecret}>
          <Text style={styles.fieldValue} numberOfLines={1}>
            {secret}
          </Text>
          {copied ? (
            <Check size={15} color={theme.colors.green} strokeWidth={2.5} />
          ) : (
            <Copy size={15} color={theme.colors.textMuted} strokeWidth={2} />
          )}
        </PressableScale>
        <Text style={styles.note}>{t('syncSetupSecretNote')}</Text>

        <View style={styles.guide}>
          <Text style={styles.guideTitle}>{t('syncSetupGuideTitle')}</Text>
          <Text style={styles.guideStep}>{t('syncSetupGuideStep1')}</Text>
          <Text style={styles.guideStep}>{t('syncSetupGuideStep2')}</Text>
          <Text style={styles.guideStep}>{t('syncSetupGuideStep3')}</Text>
          <Text style={styles.guideStep}>{t('syncSetupGuideStep4')}</Text>
        </View>

        <PressableScale style={styles.doneBtn} onPress={onDone}>
          <ChevronRight size={14} color={theme.colors.background} strokeWidth={2.5} />
          <Text style={styles.doneText}>{t('syncDone')}</Text>
        </PressableScale>
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      position: 'absolute',
      inset: 0,
      backgroundColor: withAlpha(theme.colors.background, 0.9),
      justifyContent: 'center',
      padding: theme.spacing.lg,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderRadius: 14,
      padding: theme.spacing.lg,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.2),
      gap: 10,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: theme.type.title,
      fontFamily: theme.fonts.sansExtraBold,
    },
    sub: {
      color: theme.colors.textMuted,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.sans,
    },
    fieldLabel: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginTop: 6,
    },
    fieldBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: theme.colors.card,
      borderWidth: 1,
      borderColor: withAlpha(theme.colors.textMuted, 0.2),
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 12,
    },
    fieldValue: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.mono,
    },
    note: {
      color: theme.colors.textMuted,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
    },
    guide: {
      backgroundColor: withAlpha(theme.colors.primary, 0.07),
      borderRadius: 8,
      padding: 12,
      gap: 4,
      marginTop: 4,
    },
    guideTitle: {
      color: theme.colors.primary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      marginBottom: 2,
    },
    guideStep: {
      color: theme.colors.textSecondary,
      fontSize: theme.type.micro,
      fontFamily: theme.fonts.sans,
    },
    doneBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: theme.colors.primary,
      borderRadius: 8,
      paddingVertical: 12,
      marginTop: 6,
    },
    doneText: {
      color: theme.colors.background,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
  });
