import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../../api/supabaseClient';
import { useI18nStore } from '../../i18n';
import {
  Notifications,
  notificationsAvailable,
  isExpoGo,
} from './notificationsModule';
import { useNotificationPrefs } from './useNotifications';
import { buildPushRegistration } from './pushRegistration';

/**
 * Server alerts — the alerts that arrive with the app CLOSED.
 *
 * The local notifications next door (journal reminder, risk threshold, Sunday
 * review) all need the process alive. These three do not, and they are the
 * three that matter when it is not:
 *
 *   * the terminal went quiet (the auto-journal is filling with holes),
 *   * a session lock just fired,
 *   * today's loss is eating the daily allowance.
 *
 * The database decides and claims (public.push_sweep), the push Edge Function
 * delivers. This file's whole job is to hand it a token, and to let go of it
 * on sign-out so a logged-out phone stops hearing about someone else's trades.
 */

/**
 * Why a registration failed. The distinction matters because the fixes live on
 * different machines:
 *
 *   * 'denied'      — the phone: enable notifications;
 *   * 'unavailable' — Expo Go: remote push cannot work there at all;
 *   * 'no_token'    — a REAL build, but the Expo project has no FCM
 *                     credentials (Android): the token cannot be issued;
 *                     fixed in Firebase + Expo Credentials, then one rebuild;
 *   * 'schema'      — the database: the push tables do not exist yet, the
 *                     latest schema.sql has not been re-run;
 *   * 'error'       — everything else, which is genuinely "try later".
 *
 * Collapsing these into one message made every failure read as a server
 * outage — a trader on an installed build was told "unavailable in Expo Go",
 * which reads as nonsense and helps nobody.
 */
export type PushSetupResult =
  | 'ok'
  | 'unavailable'
  | 'no_token'
  | 'denied'
  | 'schema'
  | 'error';

/** The EAS project id `getExpoPushTokenAsync` needs in a standalone build. */
export function expoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

interface TokenResponse {
  data?: string;
}

async function obtainToken(): Promise<string | null> {
  if (!Notifications) return null;
  try {
    const res = (await Notifications.getExpoPushTokenAsync({
      projectId: expoProjectId(),
    })) as TokenResponse;
    return res?.data ?? null;
  } catch {
    // Expo Go, a simulator, or a build without FCM configured. The switch
    // reports "unavailable" rather than pretending to have registered.
    return null;
  }
}

/**
 * Let go of this device. Standalone because sign-out needs it outside React
 * (TopAccountBar's handler); the hook below delegates to it.
 */
export async function unregisterPushToken(): Promise<void> {
  const store = useNotificationPrefs.getState();
  if (store.serverToken) {
    await supabase.rpc('unregister_push_token', { p_token: store.serverToken });
  }
  store.set({ serverToken: null, serverAlerts: false });
}

export function usePushServerAlerts() {
  const prefs = useNotificationPrefs();
  const set = useNotificationPrefs(s => s.set);
  const { lang } = useI18nStore();

  const register = useCallback(
    async (token: string | null): Promise<PushSetupResult> => {
      if (!notificationsAvailable) return 'unavailable';

      const { status } = await Notifications!.getPermissionsAsync();
      if (status !== 'granted') return 'denied';

      const resolved = token ?? (await obtainToken());
      const payload = buildPushRegistration({
        available: true,
        enabled: true,
        token: resolved,
        os: Platform.OS,
        lang,
      });
      // No token is not a server problem: say which machine to fix. In Expo
      // Go the notifications module never even loaded; in a real build a
      // missing token means the project's FCM credentials (Android).
      if (!payload) return isExpoGo ? 'unavailable' : 'no_token';

      const { error } = await supabase.rpc('register_push_token', {
        p_token: payload.token,
        p_platform: payload.platform,
        p_locale: payload.locale,
      });
      if (error) {
        // 42883 = undefined_function: the RPC itself is missing, which means
        // the database predates the push tables. That is a fixable, named
        // state — not "try again later".
        const code = (error as { code?: string }).code;
        const message = (error as { message?: string }).message ?? '';
        if (code === '42883' || message.includes('register_push_token')) {
          return 'schema';
        }
        return 'error';
      }

      set({ serverToken: payload.token });
      return 'ok';
    },
    [lang, set]
  );

  // Best effort: a failed call here must not block the user, and the token
  // rebinds to whoever logs in next on the same device anyway.
  const unregister = useCallback(() => unregisterPushToken(), []);

  const setEnabled = useCallback(
    async (next: boolean): Promise<PushSetupResult> => {
      if (!next) {
        await unregister();
        return 'ok';
      }
      const result = await register(null);
      set({ serverAlerts: result === 'ok' });
      return result;
    },
    [register, unregister, set]
  );

  return {
    supported: notificationsAvailable,
    /** True only when the server has acknowledged a token. */
    enabled: prefs.serverAlerts && prefs.serverToken !== null,
    setEnabled,
    unregister,
    /** Shown in the settings row so the state is never a guess. */
    registered: prefs.serverToken !== null,
  };
}

/**
 * Keeps the registration honest while the app runs.
 *
 * Two things can make the stored row wrong without the user touching anything:
 * the language can change (the alert text is composed server-side, in the
 * locale we sent), and the device token can be rotated by Expo. Re-registering
 * costs one small RPC and closes both.
 *
 * Mounted only with an active session (App.tsx), and it renders nothing.
 */
export function PushRegistrationWatcher() {
  const prefs = useNotificationPrefs();
  const { lang } = useI18nStore();
  const set = useNotificationPrefs(s => s.set);

  useEffect(() => {
    if (!prefs.serverAlerts || !notificationsAvailable) return;

    let cancelled = false;
    (async () => {
      const token = prefs.serverToken ?? (await obtainToken());
      const payload = buildPushRegistration({
        available: true,
        enabled: prefs.serverAlerts,
        token,
        os: Platform.OS,
        lang,
      });
      if (!payload || cancelled) return;

      const { error } = await supabase.rpc('register_push_token', {
        p_token: payload.token,
        p_platform: payload.platform,
        p_locale: payload.locale,
      });
      if (!error && !cancelled && payload.token !== prefs.serverToken) {
        set({ serverToken: payload.token });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [prefs.serverAlerts, prefs.serverToken, lang, set]);

  return null;
}
