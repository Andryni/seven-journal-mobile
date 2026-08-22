import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { useT } from '../../i18n';
import type { MentalState } from '../../types/domain';
import { Camera, Upload, Brain, FileText } from 'lucide-react-native';

const MENTAL_STATES: MentalState[] = ['focused', 'anxious', 'greedy', 'revenge', 'fomo', 'tired'];

// ─── Screenshots Section ───
export const ScreenshotsSection: React.FC<{
  screenshotBefore: string;
  screenshotAfter: string;
  onSetBefore: (uri: string) => void;
  onSetAfter: (uri: string) => void;
}> = ({ screenshotBefore, screenshotAfter, onSetBefore, onSetAfter }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const s = React.useMemo(() => createStyles(theme), [theme]);

  const pickImage = async (target: 'before' | 'after') => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });
    if (!res.canceled && res.assets?.[0]) {
      const asset = res.assets[0];
      const dataUri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      if (target === 'before') onSetBefore(dataUri);
      else onSetAfter(dataUri);
    }
  };

  return (
    <View style={s.sectionBox}>
      <Text style={s.sectionTitle}>
        <Camera color={theme.colors.goldLight} size={13} style={{ marginRight: 6 }} />
        {t('tfSection3')}
      </Text>
      <View style={s.row2}>
        <TouchableOpacity style={s.screenshotBtn} onPress={() => pickImage('before')} activeOpacity={0.7}>
          {screenshotBefore ? (
            <Image source={{ uri: screenshotBefore }} style={s.screenshotPreview} resizeMode="cover" />
          ) : (
            <View style={s.screenshotPlaceholder}>
              <Upload size={20} color={theme.colors.textMuted} />
              <Text style={s.screenshotLabel}>{t('tfScreenshotBefore')}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={s.screenshotBtn} onPress={() => pickImage('after')} activeOpacity={0.7}>
          {screenshotAfter ? (
            <Image source={{ uri: screenshotAfter }} style={s.screenshotPreview} resizeMode="cover" />
          ) : (
            <View style={s.screenshotPlaceholder}>
              <Upload size={20} color={theme.colors.textMuted} />
              <Text style={s.screenshotLabel}>{t('tfScreenshotAfter')}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Mental State & Notes Section ───
export const MentalNotesSection: React.FC<{
  mentalState: MentalState;
  onMentalChange: (state: MentalState) => void;
  notes: string;
  onNotesChange: (text: string) => void;
}> = ({ mentalState, onMentalChange, notes, onNotesChange }) => {
  const { theme } = useTheme();
  const { t } = useT();
  const s = React.useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={s.sectionBox}>
      <Text style={s.sectionTitle}>
        <Brain color={theme.colors.cyan} size={13} style={{ marginRight: 6 }} />
        {t('tfSection4')}
      </Text>
      <View style={s.pillRow}>
        {MENTAL_STATES.map(ms => (
          <TouchableOpacity
            key={ms}
            style={[s.pill, mentalState === ms && s.pillActive]}
            onPress={() => onMentalChange(ms)}
          >
            <Text style={[s.pillText, mentalState === ms && s.whiteText]}>
              {t(`mentalState_${ms}` as any)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={{ marginTop: 12 }}>
        <Text style={s.fieldLabel}>
          <FileText size={11} color={theme.colors.textMuted} style={{ marginRight: 4 }} />
          {t('tfNotes')}
        </Text>
        <TextInput
          style={[s.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
          placeholder={t('tfNotesPlaceholder')}
          placeholderTextColor={theme.colors.textMuted}
          value={notes}
          onChangeText={onNotesChange}
          multiline
          numberOfLines={3}
        />
      </View>
    </View>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    sectionBox: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.md,
    },
    sectionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 11,
      fontFamily: theme.fonts.sansBold,
      letterSpacing: 0.5,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
    },
    row2: {
      flexDirection: 'row',
      gap: 8,
    },
    screenshotBtn: {
      flex: 1,
      height: 100,
      borderRadius: theme.borderRadius.md,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
      borderStyle: 'dashed',
      overflow: 'hidden',
    },
    screenshotPreview: {
      width: '100%',
      height: '100%',
    },
    screenshotPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
    },
    screenshotLabel: {
      color: theme.colors.textMuted,
      fontSize: 9,
      marginTop: 4,
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.cardBorder,
    },
    pillActive: {
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      borderColor: theme.colors.primary,
    },
    pillText: {
      color: theme.colors.textMuted,
      fontSize: 10,
      fontWeight: '700',
    },
    whiteText: {
      color: '#fff',
    },
    fieldLabel: {
      color: theme.colors.textSecondary,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 0.8,
      marginBottom: 6,
      flexDirection: 'row',
      alignItems: 'center',
    },
    input: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.cardBorder,
      borderWidth: 1,
      borderRadius: theme.borderRadius.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 8,
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontFamily: theme.fonts.mono,
    },
  });
