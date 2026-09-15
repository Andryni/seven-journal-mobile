import React, { useMemo } from 'react';
import { Modal, View, Text, StyleSheet, Image, Dimensions, ScrollView } from 'react-native';
import { X } from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import type { AppTheme } from '../../theme';
import { duration } from '../../theme/motion';
import { PressableScale } from '../ui/PressableScale';

interface ScreenshotViewerProps {
  visible: boolean;
  uri: string | null;
  label?: string;
  onClose: () => void;
}

/**
 * Full-screen chart screenshot viewer with pinch/pan.
 *
 * Trade screenshots were rendered as ~140px thumbnails with `resizeMode
 * contain` and no way to open them — useless for reviewing a chart, which is
 * the entire reason to attach one. A ScrollView with min/max zoom gives
 * pinch-to-zoom on iOS and double-tap zoom on Android without a new dep.
 */
export const ScreenshotViewer: React.FC<ScreenshotViewerProps> = ({
  visible,
  uri,
  label,
  onClose,
}) => {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width, height } = Dimensions.get('window');

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent={false} animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(duration.fast)} style={styles.header}>
          <Text style={styles.label} numberOfLines={1}>
            {label ?? ''}
          </Text>
          <PressableScale onPress={onClose} accessibilityLabel="Fermer" hitSlop={12}>
            <X size={22} color={theme.colors.textPrimary} />
          </PressableScale>
        </Animated.View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ width, height: height - 64 }}
          maximumZoomScale={4}
          minimumZoomScale={1}
          bouncesZoom
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          centerContent
        >
          <Image
            source={{ uri }}
            style={{ width, height: height - 64 }}
            resizeMode="contain"
            accessibilityLabel={label}
          />
        </ScrollView>
      </View>
    </Modal>
  );
};

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
    },
    label: {
      flex: 1,
      color: theme.colors.textSecondary,
      fontSize: theme.type.label,
      fontFamily: theme.fonts.monoBold,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    scroll: { flex: 1 },
  });
