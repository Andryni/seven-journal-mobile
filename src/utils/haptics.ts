import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Centralized haptic feedback — every call is wrapped so a missing native
 * module (web, Expo Go edge cases) can never crash the app.
 */

const safe = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => {
    /* haptics unavailable — ignore */
  });
};

/** Light tick — tab switches, pickers, toggles */
export const hapticLight = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));

/** Medium thump — buttons, confirmations */
export const hapticMedium = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/** Success notification — trade saved, goal reached */
export const hapticSuccess = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));

/** Warning — approaching daily loss limit */
export const hapticWarning = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

/** Error / lock triggered */
export const hapticError = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
