import React from 'react';
import { Animated as RNAnimated } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { AnimatedSplashScreen } from '../AnimatedSplashScreen';

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
