import React from 'react';
import { Animated as RNAnimated, StyleSheet } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { AnimatedSplashScreen } from '../AnimatedSplashScreen';
import { BRAND_WORDMARK, requiredBoxWidth } from '../../brand/lockupGeometry';

/**
 * The entire app is gated behind onAnimationFinish, so the only thing that
 * really matters here is that it always fires.
 *
 * Reported twice: the app intermittently sat on the logo and had to be
 * relaunched. Animated.start(cb) does not guarantee its callback -- an
 * interrupted animation simply never calls it -- so a failsafe timer and the
 * unmount path both have to release the gate.
 */
describe('AnimatedSplashScreen', () => {
  beforeEach(() => jest.useFakeTimers());

  /**
   * jest-expo's Animated mock invokes start()'s callback synchronously, so a
   * plain render proves nothing about the interrupted case. These tests stub
   * start() to never call back -- which is exactly the device behaviour being
   * guarded against.
   */
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('mounts without throwing', () => {
    expect(() => render(<AnimatedSplashScreen onAnimationFinish={() => {}} />)).not.toThrow();
  });

  it('releases the gate even when the animation callback never arrives', () => {
    const onFinish = jest.fn();
    const seq = jest
      .spyOn(RNAnimated, 'sequence')
      .mockReturnValue({ start: () => {}, stop: () => {}, reset: () => {} } as never);

    render(<AnimatedSplashScreen onAnimationFinish={onFinish} />);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(onFinish).toHaveBeenCalled();
    seq.mockRestore();
  });

  it('releases the gate exactly once, however many paths fire', () => {
    // Animation callback, failsafe and unmount can all race; a double call
    // would re-enter the app's state setter for no reason.
    const onFinish = jest.fn();
    const { unmount } = render(<AnimatedSplashScreen onAnimationFinish={onFinish} />);

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    unmount();

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('releases the gate when unmounted before the animation completes', () => {
    const onFinish = jest.fn();
    const seq = jest
      .spyOn(RNAnimated, 'sequence')
      .mockReturnValue({ start: () => {}, stop: () => {}, reset: () => {} } as never);

    const { unmount } = render(<AnimatedSplashScreen onAnimationFinish={onFinish} />);

    // Torn down mid-sequence: without the unmount path this is a dead app.
    act(() => {
      jest.advanceTimersByTime(200);
    });
    unmount();

    expect(onFinish).toHaveBeenCalledTimes(1);
    seq.mockRestore();
  });
});

/**
 * The lockup's typography, which failed intermittently on the device.
 *
 * Reported as "sometimes the word TERMINAL is invisible, sometimes the L of
 * Journal": the texts were MOUNTED (at opacity 0) while the Google fonts were
 * still loading, so they were laid out in the fallback face -- and the family
 * NAME does not change when the real file lands, so nothing invalidated that
 * layout and the wider real face painted over a box measured for the narrower
 * one. Hence the two rules asserted here: do not mount before the fonts are
 * ready, and never let the box depend on a measurement.
 */
describe('AnimatedSplashScreen — lockup typography', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('does not mount the wordmark or tagline before the fonts are ready', () => {
    const { queryByText } = render(
      <AnimatedSplashScreen onAnimationFinish={() => {}} fontsReady={false} />
    );
    expect(queryByText(/SEVEN/)).toBeNull();
    expect(queryByText(/FINTECH/)).toBeNull();
  });

  it('renders the whole wordmark and tagline once the fonts are ready', () => {
    const { getByText } = render(<AnimatedSplashScreen onAnimationFinish={() => {}} fontsReady />);
    expect(getByText('FINTECH TERMINAL')).toBeTruthy();
    // One parent Text with two nested runs: the brand must read as one line.
    expect(getByText('SEVEN JOURNAL')).toBeTruthy();
  });

  it('gives both brand lines a computed box, never a measured one', () => {
    // '100%' of a parent is resolved by a layout pass -- and a resolved (or
    // stale) width is what cut the tail off this brand. The box is arithmetic
    // now: wide enough for the worst-case run with the headroom to spare.
    const { getByText } = render(<AnimatedSplashScreen onAnimationFinish={() => {}} fontsReady />);
    const wordmark = getByText('SEVEN JOURNAL');
    expect(wordmark).toHaveStyle({ textAlign: 'center' });

    const box = StyleSheet.flatten(wordmark.props.style).width;
    expect(typeof box).toBe('number');
    expect(box as number).toBeGreaterThanOrEqual(
      requiredBoxWidth({ text: BRAND_WORDMARK, fontSize: 17, letterSpacing: 3.4, mono: true })
    );
    // Same computed box for the tagline: the two must stay a lockup.
    expect(StyleSheet.flatten(getByText('FINTECH TERMINAL').props.style).width).toBe(box);
  });
});
