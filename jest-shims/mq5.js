/**
 * Bundled MQL5 asset shim.
 *
 * `assets/ea/SevenJournalSync.mq5` is a real source file, not a module: jest's
 * transformer would try to parse it as JavaScript the moment anything requires
 * it (which `expo-asset` does). In a Metro bundle the same require returns an
 * asset id; here it returns one, so tests exercise the code path without
 * depending on a bundler being present.
 *
 * The FILE itself is still verified — by reading it from disk in
 * src/features/sync/__tests__/shippedEa.test.ts, which is where its version is
 * actually asserted.
 */
module.exports = 1;
