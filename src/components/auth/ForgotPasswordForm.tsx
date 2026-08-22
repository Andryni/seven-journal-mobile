import React, { useState, useMemo } from 'react';
import { Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, ArrowLeft } from 'lucide-react-native';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../../api/supabaseClient';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { AuthInput } from './AuthInput';
import { AuthMessages } from './AuthMessages';

type Props = {
  onBack: () => void;
};

export const ForgotPasswordForm: React.FC<Props> = ({ onBack }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const emailError = emailTouched && email && !isValidEmail(email) ? t('emailInvalid') : '';

  const handleForgotPassword = async () => {
    setEmailTouched(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !isValidEmail(email)) {
      setErrorMsg(t('emailInvalid'));
      return;
    }

    setLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'seventracking',
        path: 'reset-password',
      });
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) throw error;
      setSuccessMsg(t('resetPasswordSent'));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t('authError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={onBack}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ArrowLeft color={theme.colors.primaryLight} size={14} />
        <Text style={styles.backBtnText}>{t('backToSignIn')}</Text>
      </TouchableOpacity>

      <AuthMessages error={errorMsg} success={successMsg} />

      <AuthInput
        label={t('emailLabel')}
        value={email}
        onChangeText={setEmail}
        onBlur={() => setEmailTouched(true)}
        placeholder={t('emailPlaceholder')}
        error={emailError}
        touched={emailTouched}
        icon={Mail}
        keyboardType="email-address"
        autoComplete="email"
      />

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleForgotPassword}
        disabled={loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={
            loading
              ? [theme.colors.surface, theme.colors.surface]
              : [theme.colors.primary, theme.colors.primaryDeep]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.buttonGradient}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.textPrimary} size="small" />
          ) : (
            <Text style={styles.buttonText}>{t('resetPassword')}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    backBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: theme.spacing.md,
    },
    backBtnText: {
      color: theme.colors.primaryLight,
      fontSize: 12,
      fontFamily: theme.fonts.sansSemiBold,
    },
    button: {
      borderRadius: theme.borderRadius.md,
      overflow: 'hidden',
      marginTop: theme.spacing.sm,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonGradient: {
      height: 48,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontFamily: theme.fonts.sansBold,
      letterSpacing: 1.5,
    },
  });
