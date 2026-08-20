import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Animated,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../api/supabaseClient';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT } from '../i18n';
import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle } from 'lucide-react-native';

interface ResetPasswordScreenProps {
  onPasswordReset?: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({ onPasswordReset }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  // Animations
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(cardTranslateY, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Validation
  const passwordError =
    passwordTouched && password && password.length < 6 ? t('passwordTooShort') : '';
  const confirmError =
    confirmTouched && confirmPassword && password !== confirmPassword
      ? t('passwordsDontMatch')
      : '';

  const handleResetPassword = async () => {
    setPasswordTouched(true);
    setConfirmTouched(true);
    setErrorMsg('');
    setSuccessMsg('');

    if (!password || !confirmPassword) {
      setErrorMsg(t('authRequiredFields'));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t('passwordTooShort'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t('passwordsDontMatch'));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccessMsg('Mot de passe mis à jour avec succès !');
      setTimeout(() => {
        onPasswordReset?.();
      }, 2000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t('authError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Ambient glow */}
        <View style={styles.ambientGlow} />

        <Animated.View
          style={[
            styles.cardWrapper,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardTranslateY }],
            },
          ]}
        >
          <LinearGradient
            colors={[theme.colors.card, theme.colors.backgroundElevated]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.cardGradient}
          >
            {/* Top highlight */}
            <LinearGradient
              colors={[theme.colors.borderBright, theme.colors.primaryGlow, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topHighlight}
            />

            {/* Logo */}
            <View style={styles.logoSection}>
              <View style={styles.logoCard}>
                <Image
                  source={require('../assets/seven_tracking_logo.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </View>
              <View style={styles.brandRow}>
                <Text style={styles.brandSeven}>SEVEN </Text>
                <Text style={styles.brandTracking}>JOURNAL</Text>
              </View>
            </View>

            {/* Title */}
            <Text style={styles.title}>{t('resetPassword')}</Text>
            <Text style={styles.subtitle}>Entrez votre nouveau mot de passe</Text>

            {/* Error / Success messages */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <AlertTriangle color={theme.colors.redLight} size={14} />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}
            {successMsg ? (
              <View style={styles.successBox}>
                <CheckCircle color={theme.colors.greenLight} size={14} />
                <Text style={styles.successText}>{successMsg}</Text>
              </View>
            ) : null}

            {/* Password input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('passwordLabel')}</Text>
              <View
                style={[
                  styles.inputWrapper,
                  passwordError ? styles.inputError : null,
                  password && !passwordError ? styles.inputValid : null,
                ]}
              >
                <Lock
                  color={passwordError ? theme.colors.redLight : theme.colors.textMuted}
                  size={16}
                  style={styles.icon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textDark}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => setPasswordTouched(true)}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  accessibilityLabel={t('passwordLabel')}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={showPassword ? t('hidePassword') : t('showPassword')}
                  accessibilityRole="button"
                >
                  {showPassword ? (
                    <EyeOff color={theme.colors.textMuted} size={16} />
                  ) : (
                    <Eye color={theme.colors.textMuted} size={16} />
                  )}
                </TouchableOpacity>
              </View>
              {passwordError ? <Text style={styles.fieldError}>{passwordError}</Text> : null}
            </View>

            {/* Confirm password input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('confirmPasswordLabel')}</Text>
              <View
                style={[
                  styles.inputWrapper,
                  confirmError ? styles.inputError : null,
                  confirmPassword && !confirmError && password === confirmPassword
                    ? styles.inputValid
                    : null,
                ]}
              >
                <Lock
                  color={confirmError ? theme.colors.redLight : theme.colors.textMuted}
                  size={16}
                  style={styles.icon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.textDark}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onBlur={() => setConfirmTouched(true)}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  accessibilityLabel={t('confirmPasswordLabel')}
                />
                {confirmPassword && !confirmError && password === confirmPassword ? (
                  <CheckCircle color={theme.colors.greenLight} size={14} />
                ) : null}
              </View>
              {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
            </View>

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleResetPassword}
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
          </LinearGradient>
        </Animated.View>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
    },
    ambientGlow: {
      position: 'absolute',
      width: 350,
      height: 350,
      borderRadius: 175,
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      top: '20%',
      alignSelf: 'center',
    },
    cardWrapper: {
      width: '100%',
      borderRadius: theme.borderRadius.xl,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 15,
    },
    cardGradient: {
      padding: theme.spacing.xl,
    },
    topHighlight: {
      height: 1,
      width: '100%',
      marginBottom: theme.spacing.lg,
    },
    logoSection: {
      alignItems: 'center',
      marginBottom: theme.spacing.xl,
    },
    logoCard: {
      width: 74,
      height: 74,
      borderRadius: 20,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(129, 140, 248, 0.6)',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 5 },
      shadowOpacity: 0.7,
      shadowRadius: 14,
      elevation: 11,
      backgroundColor: theme.colors.backgroundElevated,
      marginBottom: 14,
    },
    logoImage: {
      width: '100%',
      height: '100%',
    },
    brandRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 4,
    },
    brandSeven: {
      color: theme.colors.textPrimary,
      fontSize: 18,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 2,
    },
    brandTracking: {
      color: theme.colors.primaryLight,
      fontSize: 18,
      fontFamily: theme.fonts.sansExtraBold,
      letterSpacing: 2,
    },
    title: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontFamily: theme.fonts.sansExtraBold,
      textAlign: 'center',
      marginBottom: 4,
    },
    subtitle: {
      color: theme.colors.textSecondary,
      fontSize: 12,
      fontFamily: theme.fonts.sansMedium,
      textAlign: 'center',
      marginBottom: theme.spacing.lg,
    },
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
    inputGroup: {
      marginBottom: theme.spacing.md,
    },
    label: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.colors.inputBg,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.md,
      paddingHorizontal: theme.spacing.md,
      height: 48,
    },
    inputError: {
      borderColor: 'rgba(239, 68, 68, 0.5)',
      backgroundColor: 'rgba(239, 68, 68, 0.05)',
    },
    inputValid: {
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    icon: {
      marginRight: theme.spacing.sm,
    },
    input: {
      flex: 1,
      height: 48,
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontFamily: theme.fonts.sansMedium,
    },
    fieldError: {
      color: theme.colors.redLight,
      fontSize: 10,
      fontFamily: theme.fonts.sansMedium,
      marginTop: 4,
      marginLeft: 2,
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
