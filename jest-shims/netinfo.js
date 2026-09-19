/**
 * NetInfo shim for the logic test project.
 *
 * The real package ships TypeScript in its commonjs entry, which plain node
 * cannot parse; the logic tests only need the module to IMPORT cleanly
 * (offlineQueue registers its listener lazily). The API below mirrors the
 * surface offlineQueue/OfflineBanner use: a listener registry and a fetch
 * the tests can drive.
 */
let listener = null;
let currentState = { isConnected: true, isInternetReachable: true, type: 'wifi' };

module.exports = {
  addEventListener(fn) {
    listener = fn;
    return () => {
      listener = null;
    };
  },
  fetch() {
    return Promise.resolve(currentState);
  },
  /** Test-only: push a state to the registered listener. */
  __emit(state) {
    currentState = state;
    if (listener) listener(currentState);
  },
  /** Test-only: reset between tests. */
  __reset() {
    listener = null;
    currentState = { isConnected: true, isInternetReachable: true, type: 'wifi' };
  },
};
