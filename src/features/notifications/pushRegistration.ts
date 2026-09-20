/**
 * What to register with the server, and when NOT to.
 *
 * Pure on purpose: this file must stay importable by the `logic` jest project,
 * which has no React Native and no Expo — so no `expo-constants`, no
 * `Platform`, no module-level side effects. The hook that actually talks to
 * Expo lives next door in usePushServerAlerts.ts.
 *
 * The decisions here are the ones that were each a separate bug class when
 * written inline:
 *
 *   * an empty or placeholder token must never reach the database (Expo
 *     returns '' in Expo Go, and a row with '' would be claimed by every sweep
 *     and delivered to nobody);
 *   * the locale travels WITH the token, because the push text is composed by
 *     the database, before any app can translate it;
 *   * nothing is registered while the feature is off — a phone that starts
 *     receiving notifications it did not ask for is a phone that uninstalls.
 */

export interface PushRegistration {
  token: string;
  platform: 'ios' | 'android';
  /** Language of the device at registration, for server-composed alert text. */
  locale: 'fr' | 'en';
}

export interface PushRegistrationInput {
  /** False in Expo Go and in a build without the native module. */
  available: boolean;
  /** The user's switch. */
  enabled: boolean;
  /** Raw token from expo-notifications; null before it is obtained. */
  token: string | null | undefined;
  /** `Platform.OS`, passed in so this stays a pure function. */
  os: string;
  /** The app's current language. */
  lang: string;
}

/** Shortest plausible Expo token length; anything below is not a token. */
const MIN_TOKEN_LENGTH = 10;

export function buildPushRegistration(input: PushRegistrationInput): PushRegistration | null {
  if (!input.available || !input.enabled) return null;

  const token = (input.token ?? '').trim();
  if (token.length < MIN_TOKEN_LENGTH) return null;

  return {
    token,
    // Anything that is not iOS is registered as Android: the two platforms are
    // the only values the column accepts, and a wrong guess is visible in the
    // alert ledger rather than silently dropped.
    platform: input.os === 'ios' ? 'ios' : 'android',
    locale: input.lang === 'en' ? 'en' : 'fr',
  };
}
