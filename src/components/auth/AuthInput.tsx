import React, { useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import type { LucideIcon } from 'lucide-react-native';

type Props = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string;
  touched?: boolean;
  icon: LucideIcon;
  secureTextEntry?: boolean;
  showPasswordToggle?: boolean;
  isPasswordVisible?: boolean;
  onTogglePassword?: () => void;
  autoComplete?: 'email' | 'current-password' | 'new-password';
  keyboardType?: 'email-address' | 'default';
};

export const AuthInput: React.FC<Props> = ({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  touched,
  icon: Icon,
  secureTextEntry,
  showPasswordToggle,
  isPasswordVisible,
  onTogglePassword,
  autoComplete,
  keyboardType,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const hasError = touched && !!error;
  const isValid = touched && value.length > 0 && !error;

  return (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.inputWrapper,
          hasError ? styles.inputError : null,
          isValid ? styles.inputValid : null,
        ]}
      >
        <Icon
          color={hasError ? theme.colors.redLight : theme.colors.textMuted}
          size={16}
          style={styles.icon}
        />
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textDark}
          value={value}
          onChangeText={onChangeText}
          onBlur={onBlur}
          secureTextEntry={secureTextEntry}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          autoCapitalize="none"
          accessibilityLabel={label}
        />
        {showPasswordToggle && (
          <TouchableOpacity
            onPress={onTogglePassword}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {/* Eye icon placeholder — parent handles the actual icon */}
          </TouchableOpacity>
        )}
        {isValid && <CheckCircle color={theme.colors.greenLight} size={14} />}
      </View>
      {hasError ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
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
  });
