/**
 * Guarded access to expo-updates — same shape as the notifications module, and
 * for the same class of reason: a module that cannot load must degrade to
 * "no updates", never take the app down at import time.
 *
 * `isEnabled` is the honest answer to "can this build receive updates at all":
 * it is false in Expo Go, false in a dev client served by Metro, and true in a
 * build whose binary carries the `updates.url` configured in app.json. Every
 * caller checks it rather than assuming.
 */

export const Updates: typeof import('expo-updates') | null = (() => {
  try {
    return require('expo-updates') as typeof import('expo-updates');
  } catch {
    return null;
  }
})();

/** True when this build can fetch a JS update from the update server. */
export const updatesAvailable = Updates !== null && Updates.isEnabled;
