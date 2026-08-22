import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { ShieldAlert, Lock, AlertOctagon } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';

interface DailyLockOverlayProps {
  visible: boolean;
  reason?: string | null;
  onDismiss?: () => void;
}

export const DailyLockOverlay: React.FC<DailyLockOverlayProps> = ({ visible, reason, onDismiss }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = React.useMemo(() => createStyles(theme), [theme]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <ShieldAlert size={44} color={theme.colors.redLight} />
          </View>

          <Text style={styles.title}>{t('lockModeTitle')}</Text>
          <Text style={styles.subtitle}>{t('lockModeSubtitle')}</Text>

          <View style={styles.reasonBox}>
            <AlertOctagon size={16} color={theme.colors.redLight} style={{ marginRight: 8 }} />
            <Text style={styles.reasonText}>
              {reason || t('lockReasonFallback')}
            </Text>
          </View>

          <Text style={styles.infoText}>
            {t('lockModeDesc')}
          </Text>

          {onDismiss && (
            <TouchableOpacity style={styles.button} onPress={onDismiss} activeOpacity={0.8}>
              <Lock size={14} color="#fff" style={{ marginRight: 6 }} />
              <Text style={styles.buttonText}>{t('lockModeAcknowledge')}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(7, 8, 10, 0.88)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      backgroundColor: theme.colors.card,
      borderColor: 'rgba(239, 68, 68, 0.4)',
      borderWidth: 1.5,
      borderRadius: theme.borderRadius.xl,
      padding: 24,
      alignItems: 'center',
      shadowColor: theme.colors.red,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 20,
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: 'rgba(239, 68, 68, 0.15)',
      borderColor: 'rgba(239, 68, 68, 0.3)',
      borderWidth: 1,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 18,
      fontFamily: theme.fonts.sansExtraBold,
      color: theme.colors.redLight,
      letterSpacing: 1.5,
      textAlign: 'center',
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
      color: theme.colors.textMuted,
      letterSpacing: 1,
      textAlign: 'center',
      marginBottom: 16,
    },
    reasonBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(239, 68, 68, 0.1)',
      borderColor: 'rgba(239, 68, 68, 0.25)',
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: 14,
      paddingVertical: 10,
      marginBottom: 16,
      width: '100%',
    },
    reasonText: {
      flex: 1,
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontFamily: theme.fonts.monoMedium,
      lineHeight: 16,
    },
    infoText: {
      color: theme.colors.textSecondary,
      fontSize: 11,
      fontFamily: theme.fonts.sans,
      textAlign: 'center',
      lineHeight: 18,
      marginBottom: 20,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.red,
      borderRadius: theme.borderRadius.md,
      paddingVertical: 12,
      paddingHorizontal: 24,
      width: '100%',
    },
    buttonText: {
      color: '#fff',
      fontSize: 11,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
    },
  });
