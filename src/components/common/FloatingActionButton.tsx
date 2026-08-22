import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useHaptic } from '../../hooks/useHaptic';

interface FloatingActionButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({ onPress, disabled }) => {
  const { theme } = useTheme();
  const styles = React.useMemo(() => createStyles(theme), [theme]);
  const { medium } = useHaptic();

  const handlePress = () => {
    medium();
    onPress();
  };

  if (disabled) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.touchable}
        onPress={handlePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Nouveau Trade"
      >
        <LinearGradient
          colors={[theme.colors.primaryLight, theme.colors.primary, theme.colors.primaryDeep]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fab}
        >
          <Plus color="#ffffff" size={26} strokeWidth={2.5} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      position: 'absolute',
      right: 20,
      bottom: 84,
      zIndex: 99,
    },
    touchable: {
      shadowColor: theme.colors.primary,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 8,
      borderRadius: 28,
    },
    fab: {
      width: 56,
      height: 56,
      borderRadius: 28,
      justifyContent: 'center',
      alignItems: 'center',
      borderColor: 'rgba(255, 255, 255, 0.25)',
      borderWidth: 1.5,
    },
  });
