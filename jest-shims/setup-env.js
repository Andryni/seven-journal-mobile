/* eslint-disable */
/**
 * Shim for `react-native/setup-env`.
 *
 * @react-native/jest-preset 0.87 maps that secondary entry point to
 * react-native/src/setup-env.js, but the installed react-native is 0.86, where
 * the file does not exist yet -- so the preset fails to load before a single
 * test runs. Mapping it to this empty module restores the 0.86 behaviour,
 * where the preset simply had nothing to set up there.
 *
 * Delete this once react-native and @react-native/jest-preset are on the same
 * minor version.
 */
module.exports = {};
