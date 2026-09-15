/**
 * Two projects on purpose.
 *
 * The 561 logic tests are pure TypeScript and run in a plain node environment
 * in ~4s. Putting them behind the React Native preset would make every one of
 * them pay for the RN transform pipeline for no benefit.
 *
 * Render tests need the real thing: the jest-expo preset, so components that
 * touch Reanimated, SVG and Expo modules actually mount. These are the tests
 * that catch what tsc, the unit tests and a successful Metro bundle all miss --
 * hooks called after an early return, and worklets calling JS closures.
 */
module.exports = {
  projects: [
    {
      displayName: 'logic',
      testEnvironment: 'node',
      testPathIgnorePatterns: [
        '/node_modules/',
        '/android/',
        '/ios/',
        '/.expo/',
        '/__render__/',
      ],
      moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
      transform: {
        '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json', diagnostics: false }],
      },
    },
    {
      displayName: 'render',
      preset: 'jest-expo',
      // See jest-shims/setup-env.js: preset 0.87 vs react-native 0.86.
      moduleNameMapper: {
        '^react-native/setup-env$': '<rootDir>/jest-shims/setup-env.js',
        // ESM-only package with 1000+ icon modules; see jest-shims/lucide.js.
        '^lucide-react-native$': '<rootDir>/jest-shims/lucide.js',
      },
      testMatch: ['**/__render__/**/*.test.tsx'],
      // Runs before the module registry loads anything, so supabaseClient.ts
      // sees a valid URL at import time.
      setupFiles: ['<rootDir>/jest.render-env.js'],
      setupFilesAfterEnv: ['<rootDir>/jest.render-setup.js'],
      transformIgnorePatterns: [
        'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-reanimated|react-native-worklets|lucide-react-native|@tanstack)',
      ],
    },
  ],
};
