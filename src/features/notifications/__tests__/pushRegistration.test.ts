import { buildPushRegistration } from '../pushRegistration';

/**
 * The rules that decide whether a device is registered for the server alerts.
 *
 * Each of these is a bug class that costs real money when it is wrong: a
 * placeholder token registered as real (nothing is ever delivered, and the
 * ledger believes it was), or a registration that outlives the switch the
 * trader turned off.
 */
const base = {
  available: true,
  enabled: true,
  token: 'ExponentPushToken[abcdef123456]',
  os: 'android',
  lang: 'fr',
};

describe('buildPushRegistration', () => {
  it('registers a real token', () => {
    expect(buildPushRegistration(base)).toEqual({
      token: 'ExponentPushToken[abcdef123456]',
      platform: 'android',
      locale: 'fr',
    });
  });

  it('refuses when the native module is missing', () => {
    // Expo Go: expo-notifications is not even loadable there, and a row with
    // a token nobody can deliver to is worse than no row.
    expect(buildPushRegistration({ ...base, available: false })).toBeNull();
  });

  it('refuses when the trader turned the switch off', () => {
    expect(buildPushRegistration({ ...base, enabled: false })).toBeNull();
  });

  it('refuses an empty, short or whitespace token', () => {
    expect(buildPushRegistration({ ...base, token: '' })).toBeNull();
    expect(buildPushRegistration({ ...base, token: '   ' })).toBeNull();
    expect(buildPushRegistration({ ...base, token: 'abc' })).toBeNull();
    expect(buildPushRegistration({ ...base, token: null })).toBeNull();
    expect(buildPushRegistration({ ...base, token: undefined })).toBeNull();
  });

  it('trims the token it does accept', () => {
    const reg = buildPushRegistration({ ...base, token: '  ExponentPushToken[x]  ' });
    expect(reg?.token).toBe('ExponentPushToken[x]');
  });

  it('maps the platform to the two values the column accepts', () => {
    expect(buildPushRegistration({ ...base, os: 'ios' })?.platform).toBe('ios');
    expect(buildPushRegistration({ ...base, os: 'android' })?.platform).toBe('android');
    // Anything unexpected lands on android: the column has a check constraint,
    // and a rejected write would look like a server fault.
    expect(buildPushRegistration({ ...base, os: 'web' })?.platform).toBe('android');
  });

  it('carries the language, because the alert text is composed server-side', () => {
    expect(buildPushRegistration({ ...base, lang: 'en' })?.locale).toBe('en');
    expect(buildPushRegistration({ ...base, lang: 'fr' })?.locale).toBe('fr');
    // An unknown language falls back to the app's default.
    expect(buildPushRegistration({ ...base, lang: 'de' })?.locale).toBe('fr');
  });
});
