/* eslint-disable */
/**
 * supabaseClient.ts calls createClient() at module scope, and the Supabase SDK
 * rejects an empty URL outright -- so importing any feature hook would throw
 * before a component could mount.
 *
 * These are syntactically valid placeholders pointing nowhere. No render test
 * performs a network call: react-query is configured with retry disabled and
 * the hooks under test read from the cache.
 */
process.env.EXPO_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

/*
 * React Fabric's global error reporter (ReactFabric-dev.js, reportGlobalError)
 * builds a `window.ErrorEvent` and dispatches it when an uncaught error
 * escapes a commit. The RN test environment defines `window.ErrorEvent` but
 * NOT `window.dispatchEvent`, so the reporter itself crashed with
 * "window.dispatchEvent is not a function" — masking the real error behind
 * a misleading TypeError, and only under load (full-suite runs), which made
 * the DashboardScreen rerender test look flaky.
 *
 * Shim the dispatcher to log the event like a browser uncaught error would.
 * Now the genuine error surfaces in the output instead of a fake one.
 */
if (typeof window !== 'undefined' && typeof window.dispatchEvent !== 'function') {
  window.dispatchEvent = event => {
    if (event && (event.error || event.message)) {
      // eslint-disable-next-line no-console
      console.error('uncaught (via ErrorEvent):', event.error ?? event.message);
    }
    return true;
  };
}
