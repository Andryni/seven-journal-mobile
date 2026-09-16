import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AppLockPrefs {
  /** Require biometric/passcode auth to open the app. */
  enabled: boolean;
  setEnabled: (v: boolean) => void;
}

export const useAppLockPrefs = create<AppLockPrefs>()(
  persist(
    set => ({
      enabled: false,
      setEnabled: enabled => set({ enabled }),
    }),
    {
      name: 'seven-app-lock',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Re-lock after this long in the background. */
const GRACE_MS = 60_000;

/**
 * Biometric app lock.
 *
 * The app shows account balances and full trade history — on a borrowed or
 * stolen phone that is sensitive. Expected on any finance app, and cheap:
 * Face ID / Touch ID / device passcode via expo-local-authentication.
 *
 * Re-locks when the app returns from background after a grace period, so
 * switching to TradingView for ten seconds does not force a re-auth.
 */
export function useAppLock() {
  const { enabled, setEnabled } = useAppLockPrefs();
  const [isUnlocked, setIsUnlocked] = useState(!enabled);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [backgroundedAt, setBackgroundedAt] = useState<number | null>(null);
  // Persisted prefs hydrate asynchronously: before that, `enabled` is the
  // default false and must not be trusted for gating decisions.
  const [ready, setReady] = useState(() => useAppLockPrefs.persist.hasHydrated());

  useEffect(() => {
    if (ready) return;
    const unsub = useAppLockPrefs.persist.onFinishHydration(() => {
      setReady(true);
      // Arm the gate from the hydrated value. Without this, `isUnlocked`
      // kept its pre-hydration `!false` and a persisted lock never engaged
      // on cold start — only on background-return.
      setIsUnlocked(!useAppLockPrefs.getState().enabled);
    });
    return unsub;
  }, [ready]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    setIsAuthenticating(true);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      // No biometrics configured: refusing to unlock would brick the app.
      if (!hasHardware || !isEnrolled) {
        setIsUnlocked(true);
        return true;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Déverrouiller Seven Journal',
        fallbackLabel: 'Code',
        cancelLabel: 'Annuler',
      });

      setIsUnlocked(result.success);
      return result.success;
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  /** Turning the lock on must prove the user can pass it. */
  const enable = useCallback(async (): Promise<boolean> => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !isEnrolled) return false;

    const ok = await authenticate();
    if (ok) setEnabled(true);
    return ok;
  }, [authenticate, setEnabled]);

  const disable = useCallback(() => {
    setEnabled(false);
    setIsUnlocked(true);
  }, [setEnabled]);

  useEffect(() => {
    if (!enabled) {
      setIsUnlocked(true);
      return;
    }

    const onChange = (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        setBackgroundedAt(Date.now());
      } else if (state === 'active') {
        if (backgroundedAt !== null && Date.now() - backgroundedAt > GRACE_MS) {
          setIsUnlocked(false);
        }
        setBackgroundedAt(null);
      }
    };

    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, backgroundedAt]);

  return {
    ready,
    enabled,
    isUnlocked,
    isAuthenticating,
    authenticate,
    enable,
    disable,
  };
}
