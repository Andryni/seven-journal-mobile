import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from '../api/supabaseClient';
import { theme } from '../theme';
import { Lock, Mail } from 'lucide-react-native';

export const AuthScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAuth = async () => {
    if (!email || !password) {
      setErrorMsg('Veuillez remplir l\'email et le mot de passe.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Inscription réussie ! Vérifiez votre boîte mail.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Erreur lors de l\'authentification.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.logoContainer}>
          <Text style={styles.brandTitle}>SEVEN TRACKING</Text>
          <Text style={styles.brandSubtitle}>FINTECH TERMINAL MOBILE</Text>
        </View>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        <View style={styles.inputGroup}>
          <Text style={styles.label}>ADRESSE EMAIL</Text>
          <View style={styles.inputWrapper}>
            <Mail color={theme.colors.textMuted} size={18} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="trader@seven.com"
              placeholderTextColor={theme.colors.textMuted}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>MOT DE PASSE</Text>
          <View style={styles.inputWrapper}>
            <Lock color={theme.colors.textMuted} size={18} style={styles.icon} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>
        </View>

        <TouchableOpacity style={styles.button} onPress={handleAuth} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>{isSignUp ? 'S\'INSCRIRE' : 'SE CONNECTER'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsSignUp(!isSignUp)} style={styles.toggleContainer}>
          <Text style={styles.toggleText}>
            {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  brandTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
  },
  brandSubtitle: {
    color: theme.colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    borderWidth: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.redLight,
    fontSize: 12,
  },
  inputGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    color: theme.colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: theme.spacing.xs,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  icon: {
    marginRight: theme.spacing.sm,
  },
  input: {
    flex: 1,
    height: 46,
    color: '#ffffff',
    fontSize: 14,
  },
  button: {
    backgroundColor: theme.colors.primary,
    height: 48,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1,
  },
  toggleContainer: {
    marginTop: theme.spacing.xl,
    alignItems: 'center',
  },
  toggleText: {
    color: theme.colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
});
