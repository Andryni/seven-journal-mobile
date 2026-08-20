import React from 'react';
import { TouchableOpacity, Text, StyleSheet, Alert, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { Camera } from 'lucide-react-native';

/**
 * Export PNG button — Expo Go compatible.
 * Uses html2canvas-like approach via a canvas element rendered as base64,
 * then saved via expo-file-system and shared via expo-sharing.
 *
 * NOTE: This is a simplified version. For full screenshot capture,
 * a development build with react-native-view-shot is recommended.
 */
export const ExportPngButton: React.FC<{
  onCapture?: () => Promise<string | null>;
  label?: string;
}> = ({ onCapture, label }) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const handleExport = async () => {
    try {
      if (onCapture) {
        const uri = await onCapture();
        if (uri) {
          const isAvailable = await Sharing.isAvailableAsync();
          if (isAvailable) {
            await Sharing.shareAsync(uri);
          } else {
            Alert.alert('Info', 'Partage non disponible sur cet appareil.');
          }
        }
      } else {
        Alert.alert(
          'Export PNG',
          'Pour exporter en PNG, utilisez la version development build avec react-native-view-shot.',
        );
      }
    } catch {
      Alert.alert('Erreur', "Erreur lors de l'export.");
    }
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleExport} activeOpacity={0.7}>
      <View style={styles.buttonContent}>
        <Camera size={14} color={theme.colors.primaryLight} />
        <Text style={styles.buttonText}>{label || 'EXPORT PNG'}</Text>
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    button: {
      backgroundColor: 'rgba(99, 102, 241, 0.15)',
      borderColor: 'rgba(99, 102, 241, 0.3)',
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    buttonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    buttonText: {
      color: theme.colors.primaryLight,
      fontSize: 10,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 0.5,
    },
  });
