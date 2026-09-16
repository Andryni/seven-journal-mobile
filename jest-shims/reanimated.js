/* eslint-disable */
/**
 * Self-contained Reanimated stand-in for render tests.
 *
 * Reanimated 4 delegates to react-native-worklets, which needs a native
 * runtime; its own shipped mock still imports the real index, so it throws in
 * Jest too. This replacement depends on nothing but react-native.
 *
 * The important property: worklet callbacks are EXECUTED, as ordinary JS. That
 * is what makes these tests able to catch the bug this shim was written after
 * -- a useAnimatedStyle body calling a helper that is not available to it
 * still blows up here, exactly as it did on the device.
 */
const React = require('react');
const { View, Text, Image, ScrollView, Animated: RNAnimated } = require('react-native');

const identity = v => v;
const noopObj = () => ({});

// Shared values are plain mutable boxes; reading .value is all the components do.
const makeShared = initial => ({ value: initial, addListener() {}, removeListener() {}, modify() {} });

// Animation helpers resolve immediately to their target so a style computed
// from them is the final, asserted-on value.
const toValue = (v, _cfg, cb) => {
  if (typeof cb === 'function') cb(true);
  return v;
};

const createAnimatedComponent = Component => {
  const Wrapped = React.forwardRef((props, ref) =>
    React.createElement(Component, { ...props, ref })
  );
  Wrapped.displayName = `Animated(${Component?.displayName || Component?.name || 'Component'})`;
  return Wrapped;
};

// Entering/exiting animations are chainable no-op builders.
const makeTransition = () => {
  const handler = {
    get: (_t, prop) => {
      if (prop === 'build') return () => () => ({ initialValues: {}, animations: {} });
      return () => proxy;
    },
  };
  const proxy = new Proxy(function () {}, handler);
  return proxy;
};

const Animated = {
  View: createAnimatedComponent(View),
  Text: createAnimatedComponent(Text),
  Image: createAnimatedComponent(Image),
  ScrollView: createAnimatedComponent(ScrollView),
  createAnimatedComponent,
};

module.exports = {
  __esModule: true,
  default: Animated,
  ...Animated,

  useSharedValue: makeShared,
  // Executed, not skipped: this is the whole point of the shim.
  useAnimatedStyle: fn => fn(),
  useAnimatedProps: fn => fn(),
  useDerivedValue: fn => makeShared(fn()),
  useAnimatedScrollHandler: () => () => {},
  useAnimatedRef: () => ({ current: null }),
  useAnimatedReaction: () => {},
  useFrameCallback: () => ({ setActive() {} }),

  withTiming: toValue,
  withSpring: toValue,
  withDecay: toValue,
  withDelay: (_d, v) => v,
  withRepeat: v => v,
  withSequence: (...vs) => vs[vs.length - 1],
  cancelAnimation: () => {},

  runOnJS: fn => fn,
  runOnUI: fn => fn,
  interpolate: identity,
  interpolateColor: identity,
  clamp: (v, min, max) => Math.min(Math.max(v, min), max),
  measure: noopObj,
  scrollTo: () => {},

  Extrapolate: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  Easing: new Proxy({}, { get: () => (...a) => (typeof a[0] === 'number' ? a[0] : identity) }),
  ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },

  /**
   * Every entering/exiting builder the app uses, plus the obvious siblings.
   *
   * Listing them by hand meant a screen using one I had not thought of --
   * FadeInLeft, on Analytics -- crashed the render test with "Cannot read
   * properties of undefined (reading 'duration')". That reads like an app
   * bug and is not one, which is the worst kind of test failure. The proxy
   * below answers for any name in this family instead.
   */
  ...Object.fromEntries(
    [
      'Fade',
      'Slide',
      'Zoom',
      'Bounce',
      'Flip',
      'Stretch',
      'Pinwheel',
      'Roll',
      'Rotate',
      'Lightspeed',
    ].flatMap(base =>
      ['In', 'Out'].flatMap(dir =>
        ['', 'Up', 'Down', 'Left', 'Right', 'X', 'Y', 'Easy'].map(suffix => [
          `${base}${dir}${suffix}`,
          makeTransition(),
        ])
      )
    )
  ),
  Layout: makeTransition(),
  LinearTransition: makeTransition(),
  CurvedTransition: makeTransition(),
  FadingTransition: makeTransition(),
  JumpingTransition: makeTransition(),
  SequencedTransition: makeTransition(),
  EntryExitTransition: makeTransition(),

  // Reanimated re-exports these RN bindings in a few places.
  Animated: RNAnimated,
};
