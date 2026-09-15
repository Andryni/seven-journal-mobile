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
