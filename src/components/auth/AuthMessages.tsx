import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { AlertTriangle, CheckCircle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';

type Props = {
  error?: string;
  success?: string;
};

export const AuthMessages: React.FC<Props> = ({ error, success }) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <>
      {error ? (
        <View style={styles.errorBox}>
          <AlertTriangle color={theme.colors.redLight} size={14} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {success ? (
        <View style={styles.successBox}>
          <CheckCircle color={theme.colors.greenLight} size={14} />
          <Text style={styles.successText}>{success}</Text>
        </View>
      ) : null}
    </>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(239, 68, 68, 0.12)',
      borderColor: 'rgba(239, 68, 68, 0.35)',
      borderWidth: 1,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
    },
    errorText: {
      flex: 1,
      color: theme.colors.redLight,
      fontSize: 11,
      fontFamily: theme.fonts.sans,
    },
    successBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(16, 185, 129, 0.12)',
      borderColor: 'rgba(16, 185, 129, 0.35)',
      borderWidth: 1,
      padding: theme.spacing.md,
      borderRadius: theme.borderRadius.md,
      marginBottom: theme.spacing.md,
    },
    successText: {
      flex: 1,
      color: theme.colors.greenLight,
      fontSize: 11,
      fontFamily: theme.fonts.sans,
    },
  });
