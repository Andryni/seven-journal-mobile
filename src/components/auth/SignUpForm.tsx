import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react-native';
import { supabase } from '../../api/supabaseClient';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import { AuthInput } from './AuthInput';
import { AuthMessages } from './AuthMessages';

type Props = {
  onSwitchToSignIn: () => void;
};

export const SignUpForm: React.FC<Props> = ({ onSwitchToSignIn }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const emailError = emailTouched && email && !isValidEmail(email) ? t('emailInvalid') : '';
  const passwordError =
    passwordTouched && password && password.length < 6 ? t('passwordTooShort') : '';
  const confirmError =
    confirmTouched && confirmPassword && password !== confirmPassword
      ? t('passwordsDontMatch')
      : '';

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    isValidEmail(email) &&
    password === confirmPassword;

  const handleSignUp = async () => {
    setEmailTouched(true);
    setPasswordTouched(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg(t('authRequiredFields'));
      return;
    }
    if (!isValidEmail(email)) {
      setErrorMsg(t('emailInvalid'));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t('passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setConfirmTouched(true);
      setErrorMsg(t('passwordsDontMatch'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      setSuccessMsg(t('authSignUpSuccess'));
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t('authError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
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

      <View style={styles.passwordGroup}>
        <AuthInput
          label={t('passwordLabel')}
          value={password}
          onChangeText={setPassword}
          onBlur={() => setPasswordTouched(true)}
          placeholder="••••••••"
          error={passwordError}
          touched={passwordTouched}
          icon={Lock}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeToggle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {showPassword ? (
            <EyeOff color={theme.colors.textMuted} size={16} />
          ) : (
            <Eye color={theme.colors.textMuted} size={16} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.passwordGroup}>
        <AuthInput
          label={t('confirmPasswordLabel')}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          onBlur={() => setConfirmTouched(true)}
          placeholder="••••••••"
          error={confirmError}
          touched={confirmTouched}
          icon={Lock}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
        />
        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          style={styles.eyeToggle}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {showPassword ? (
            <EyeOff color={theme.colors.textMuted} size={16} />
          ) : (
            <Eye color={theme.colors.textMuted} size={16} />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSignUp}
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
            <Text style={styles.buttonText}>{t('signUpBtn')}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.toggleContainer}
        onPress={onSwitchToSignIn}
        hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
      >
        <Text style={styles.toggleText}>{t('haveAccount')}</Text>
      </TouchableOpacity>
    </>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    passwordGroup: {
      position: 'relative',
    },
    eyeToggle: {
      position: 'absolute',
      right: theme.spacing.md,
      top: 34,
      padding: 4,
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
    toggleContainer: {
      marginTop: theme.spacing.xl,
      alignItems: 'center',
      paddingVertical: theme.spacing.sm,
    },
    toggleText: {
      color: theme.colors.textMuted,
      fontSize: 12,
      fontFamily: theme.fonts.sans,
    },
  });
