import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local notifications — retention with no backend cost.
 *
 * Three triggers, each tied to a real behaviour rather than engagement spam:
 *   1. End-of-session journaling reminder (a journal filled the next morning
 *      is a journal of invented reasons).
 *   2. Daily risk warning at 70% of the allowance — fired from the risk gauge,
 *      not on a schedule.
 *   3. Weekly review prompt on Sunday evening.
 *
 * All of it is opt-in and individually switchable.
 */

export interface NotificationPrefs {
  enabled: boolean;
  journalReminder: boolean;
  /** Local hour (0-23) for the journaling reminder. */
  journalHour: number;
  riskAlerts: boolean;
  weeklyReview: boolean;
}

interface NotificationState extends NotificationPrefs {
  set: (patch: Partial<NotificationPrefs>) => void;
}

export const useNotificationPrefs = create<NotificationState>()(
  persist(
    set => ({
      enabled: false,
      journalReminder: true,
      journalHour: 21,
      riskAlerts: true,
      weeklyReview: true,
      set: patch => set(patch),
    }),
    {
      name: 'seven-notification-prefs',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const IDS = {
  journal: 'seven-journal-reminder',
  weekly: 'seven-weekly-review',
};

export function useNotifications() {
  const prefs = useNotificationPrefs();

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return false;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Seven Journal',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
      });
    }
    return true;
  }, []);

  /** Rebuild all scheduled notifications from the current preferences. */
  const sync = useCallback(async () => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!prefs.enabled) return;

    if (prefs.journalReminder) {
      await Notifications.scheduleNotificationAsync({
        identifier: IDS.journal,
        content: {
          title: 'Seven Journal',
          body: 'Session terminée — journalisez vos trades pendant que le contexte est frais.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: prefs.journalHour,
          minute: 0,
        },
      });
    }

    if (prefs.weeklyReview) {
      await Notifications.scheduleNotificationAsync({
        identifier: IDS.weekly,
        content: {
          title: 'Revue hebdomadaire',
          body: 'Votre semaine est prête : meilleur setup, erreurs récurrentes, évolution du R.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: 1, // Sunday
          hour: 19,
          minute: 0,
        },
      });
    }
  }, [prefs.enabled, prefs.journalReminder, prefs.journalHour, prefs.weeklyReview]);

  useEffect(() => {
    void sync();
  }, [sync]);

  /**
   * Immediate risk warning. Deduplicated by the caller — this fires now, it
   * is not scheduled.
   */
  const notifyRiskThreshold = useCallback(
    async (consumedPct: number, remaining: string) => {
      if (!prefs.enabled || !prefs.riskAlerts) return;
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `Risque quotidien à ${Math.round(consumedPct)}%`,
          body: `Il vous reste ${remaining} avant le verrouillage de la session.`,
        },
        trigger: null,
      });
    },
    [prefs.enabled, prefs.riskAlerts]
  );

  const enable = useCallback(async () => {
    const granted = await requestPermission();
    prefs.set({ enabled: granted });
    return granted;
  }, [requestPermission, prefs]);

  const disable = useCallback(async () => {
    prefs.set({ enabled: false });
    await Notifications.cancelAllScheduledNotificationsAsync();
  }, [prefs]);

  return { prefs, enable, disable, sync, notifyRiskThreshold, requestPermission };
}
