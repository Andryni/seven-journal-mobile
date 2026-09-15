import Constants, { ExecutionEnvironment } from 'expo-constants';

/**
 * Guarded access to expo-notifications.
 *
 * Since SDK 53, importing expo-notifications inside Expo Go throws at module
 * scope: the library registers a push-token listener while loading, and Expo
 * Go removed remote-push support. The throw happens during the import itself,
 * before any of our code runs, so a try/catch around the *call sites* is
 * useless and a Platform check is too late -- the whole app dies with
 * "[runtime not ready]" on the very first screen.
 *
 * The only thing that works is never evaluating the module in Expo Go, which
 * means a conditional require rather than a static import. This is one of the
 * rare places where require() is correct and `import` is not.
 *
 * Consequence, stated plainly: notifications are fully disabled in Expo Go,
 * including the local ones that the library itself supports. That is the cost
 * of the import-time throw. In a development or production build everything
 * below loads normally and every feature works.
 */

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

/** The expo-notifications module, or null when it cannot be loaded safely. */
export const Notifications: typeof import('expo-notifications') | null = (() => {
  if (isExpoGo) return null;
  try {
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    // Missing native module (e.g. a build without the plugin). Degrade to
    // "no notifications" rather than taking the app down.
    return null;
  }
})();

/** True when scheduling will actually do something. */
export const notificationsAvailable = Notifications !== null;
