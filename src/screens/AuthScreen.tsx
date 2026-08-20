import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
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
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../api/supabaseClient';
import { useTheme } from '../theme';
import type { AppTheme } from '../theme';
import { useT } from '../i18n';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react-native';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export const AuthScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const styles = useMemo(() => createStyles(theme), [theme]);

  // Form state
  const [mode, setMode] = useState<AuthMode>('signIn');
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

  // Animations
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardTranslateY = useRef(new Animated.Value(30)).current;
  const glowPulse = useRef(new Animated.Value(0.3)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Card entrance
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
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow pulse loop
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.6,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.2,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // Validation
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
    password.length > 0 &&
    isValidEmail(email) &&
    password.length >= 6;

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setErrorMsg('');
    setSuccessMsg('');
    setEmailTouched(false);
    setPasswordTouched(false);
    setConfirmTouched(false);
  }, []);

  const switchMode = useCallback(
    (newMode: AuthMode) => {
      resetForm();
      setMode(newMode);
    },
    [resetForm]
  );

  const handleAuth = async () => {
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
    if (mode === 'signUp' && password !== confirmPassword) {
      setConfirmTouched(true);
      setErrorMsg(t('passwordsDontMatch'));
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signUp') {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccessMsg(t('authSignUpSuccess'));
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t('authError'));
    } finally {
      setLoading(false);
    }
  };

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
      // Always provide a redirectTo so the email link works everywhere
      const redirectUrl = AuthSession.makeRedirectUri({
        scheme: 'seventracking',
        path: 'reset-password',
      });
      console.log('[Auth] Forgot password - email:', email);
      console.log('[Auth] Forgot password - redirectUrl:', redirectUrl);
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectUrl,
      });
      if (error) {
        console.log('[Auth] Forgot password - Supabase error:', error.message);
        throw error;
      }
      console.log('[Auth] Forgot password - Success! Check your email.');
      setSuccessMsg(t('resetPasswordSent'));
    } catch (err: unknown) {
      console.log('[Auth] Forgot password - Catch error:', err instanceof Error ? err.message : err);
      setErrorMsg(err instanceof Error ? err.message : t('authError'));
    } finally {
      setLoading(false);
    }
  };

  const isSignIn = mode === 'signIn';
  const isSignUp = mode === 'signUp';
  const isForgot = mode === 'forgotPassword';

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Ambient background glow */}
        <View style={styles.ambientGlow} />
        <View style={styles.ambientGlowSecondary} />

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
            {/* Top glow line */}
            <LinearGradient
              colors={[theme.colors.borderBright, theme.colors.primaryGlow, 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.topHighlight}
            />

            {/* Logo */}
            <View style={styles.logoSection}>
              <Animated.View style={[styles.logoGlow, { opacity: glowPulse }]} />
              <Animated.View style={[styles.logoCard, { transform: [{ scale: logoScale }] }]}>
                <Image
                  source={require('../assets/seven_tracking_logo.png')}
                  style={styles.logoImage}
                  resizeMode="cover"
                />
              </Animated.View>
              <View style={styles.brandRow}>
                <Text style={styles.brandSeven}>SEVEN </Text>
                <Text style={styles.brandTracking}>JOURNAL</Text>
              </View>
              <Text style={styles.tagline}>QUANTITATIVE TRADING TERMINAL</Text>
            </View>

            {/* Welcome text */}
            <Text style={styles.welcomeText}>
              {isForgot ? t('resetPassword') : isSignIn ? t('authWelcomeBack') : t('authWelcomeNew')}
            </Text>

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

            {/* Back button for forgot password */}
            {isForgot && (
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => switchMode('signIn')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ArrowLeft color={theme.colors.primaryLight} size={14} />
                <Text style={styles.backBtnText}>{t('backToSignIn')}</Text>
              </TouchableOpacity>
            )}

            {/* Email input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('emailLabel')}</Text>
              <View
                style={[
                  styles.inputWrapper,
                  emailError ? styles.inputError : null,
                  email && !emailError ? styles.inputValid : null,
                ]}
              >
                <Mail
                  color={emailError ? theme.colors.redLight : theme.colors.textMuted}
                  size={16}
                  style={styles.icon}
                />
                <TextInput
                  style={styles.input}
                  placeholder={t('emailPlaceholder')}
                  placeholderTextColor={theme.colors.textDark}
                  value={email}
                  onChangeText={setEmail}
                  onBlur={() => setEmailTouched(true)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  accessibilityLabel={t('emailLabel')}
                />
                {email && !emailError ? (
                  <CheckCircle color={theme.colors.greenLight} size={14} />
                ) : null}
              </View>
              {emailError ? <Text style={styles.fieldError}>{emailError}</Text> : null}
            </View>

            {/* Password input (hidden on forgot password) */}
            {!isForgot && (
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
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
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
            )}

            {/* Confirm Password input (sign up only) */}
            {isSignUp && (
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
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ padding: 4 }}>
                    {showPassword ? (
                      <EyeOff color={theme.colors.textMuted} size={16} />
                    ) : (
                      <Eye color={theme.colors.textMuted} size={16} />
                    )}
                  </TouchableOpacity>

                  {confirmPassword && !confirmError && password === confirmPassword ? (
                    <CheckCircle color={theme.colors.greenLight} size={14} />
                  ) : null}
                </View>
                {confirmError ? <Text style={styles.fieldError}>{confirmError}</Text> : null}
              </View>
            )}

            {/* Submit button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={isForgot ? handleForgotPassword : handleAuth}
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
                  <Text style={styles.buttonText}>
                    {isForgot
                      ? t('resetPassword')
                      : isSignIn
                      ? t('signInBtn')
                      : t('signUpBtn')}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Forgot password link (only on sign in) */}
            {isSignIn && (
              <TouchableOpacity
                style={styles.forgotBtn}
                onPress={() => switchMode('forgotPassword')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.forgotText}>{t('forgotPassword')}</Text>
              </TouchableOpacity>
            )}

            {/* Toggle sign in / sign up */}
            {!isForgot && (
              <TouchableOpacity
                style={styles.toggleContainer}
                onPress={() => switchMode(isSignIn ? 'signUp' : 'signIn')}
                hitSlop={{ top: 8, bottom: 8, left: 16, right: 16 }}
              >
                <Text style={styles.toggleText}>
                  {isSignIn ? t('noAccount') : t('haveAccount')}
                </Text>
              </TouchableOpacity>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Seven Journal v1.0</Text>
        </View>
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
      top: '15%',
      alignSelf: 'center',
    },
    ambientGlowSecondary: {
      position: 'absolute',
      width: 200,
      height: 200,
      borderRadius: 100,
      backgroundColor: 'rgba(6, 182, 212, 0.06)',
      bottom: '20%',
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
    logoGlow: {
      position: 'absolute',
      width: 140,
      height: 140,
      borderRadius: 70,
      backgroundColor: 'rgba(99, 102, 241, 0.25)',
      top: -14,
    },
    logoCard: {
      width: 84,
      height: 84,
      borderRadius: 22,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: 'rgba(129, 140, 248, 0.6)',
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.7,
      shadowRadius: 16,
      elevation: 12,
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
    tagline: {
      color: theme.colors.textMuted,
      fontSize: 8,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.5,
    },
    welcomeText: {
      color: theme.colors.textSecondary,
      fontSize: 13,
      fontFamily: theme.fonts.sansSemiBold,
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
    forgotBtn: {
      alignItems: 'center',
      marginTop: theme.spacing.md,
    },
    forgotText: {
      color: theme.colors.primaryLight,
      fontSize: 11,
      fontFamily: theme.fonts.sansSemiBold,
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
    footer: {
      position: 'absolute',
      bottom: 40,
      alignItems: 'center',
    },
    footerText: {
      color: theme.colors.textDark,
      fontSize: 9,
      fontFamily: theme.fonts.monoMedium,
      letterSpacing: 0.5,
    },
  });
