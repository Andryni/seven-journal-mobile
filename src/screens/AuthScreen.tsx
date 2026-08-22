import React, { useState, useCallback } from 'react';
import { TouchableWithoutFeedback, Keyboard, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useTheme } from '../theme';
import { useT } from '../i18n';
import { AuthCard, SignInForm, SignUpForm, ForgotPasswordForm } from '../components/auth';

type AuthMode = 'signIn' | 'signUp' | 'forgotPassword';

export const AuthScreen: React.FC = () => {
  const { theme } = useTheme();
  const { t } = useT();
  const [mode, setMode] = useState<AuthMode>('signIn');

  const switchMode = useCallback((newMode: AuthMode) => setMode(newMode), []);

  const welcomeText =
    mode === 'forgotPassword'
      ? t('resetPassword')
      : mode === 'signIn'
      ? t('authWelcomeBack')
      : t('authWelcomeNew');

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center', paddingHorizontal: theme.spacing.lg }}
      >
        <AuthCard welcomeText={welcomeText}>
          {mode === 'signIn' && (
            <SignInForm
              onForgotPassword={() => switchMode('forgotPassword')}
              onSwitchToSignUp={() => switchMode('signUp')}
            />
          )}
          {mode === 'signUp' && (
            <SignUpForm onSwitchToSignIn={() => switchMode('signIn')} />
          )}
          {mode === 'forgotPassword' && (
            <ForgotPasswordForm onBack={() => switchMode('signIn')} />
          )}
        </AuthCard>
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
};
