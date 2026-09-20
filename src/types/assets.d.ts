/**
 * Asset modules Metro has to be told about (see metro.config.js).
 *
 * `require()` of one of these returns an opaque asset id, which is what
 * `expo-asset` resolves at runtime. Typing it as a number keeps a future
 * `import` from failing with "cannot find module" without a hint of why.
 */
declare module '*.mq5' {
  const assetId: number;
  export default assetId;
}
