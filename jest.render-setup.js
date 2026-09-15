/* eslint-disable */
// See jest-shims/reanimated.js for why the library's own mock cannot be used.
jest.mock('react-native-reanimated', () => require('./jest-shims/reanimated'));

// Official mock from the package: an in-memory store, which is all the
// persisted zustand stores need to hydrate during a render test.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Silence the noisy-but-harmless animation warnings so a real failure stands out.
const origWarn = console.warn;
console.warn = (...args) => {
  const msg = String(args[0] ?? '');
  if (msg.includes('useNativeDriver') || msg.includes('Animated:')) return;
  origWarn(...args);
};
