import React from 'react';
import { render } from '@testing-library/react-native';
import { CandleLoader } from '../CandleLoader';
import { BootScreen } from '../../common/BootScreen';

/**
 * The loader animates every candle through its own worklet, and it is mounted
 * on the boot path -- the one screen a crash would make the app look dead on
 * launch. So it gets a mount test.
 */
describe('CandleLoader', () => {
  it('mounts without throwing', () => {
    expect(() => render(<CandleLoader />)).not.toThrow();
  });

  it('mounts with a caption', () => {
    const { getByText } = render(<CandleLoader label="Chargement..." />);
    expect(getByText('Chargement...')).toBeTruthy();
  });

  it('exposes itself as a progress indicator to screen readers', () => {
    const { getByRole } = render(<CandleLoader label="Chargement..." />);
    expect(getByRole('progressbar')).toBeTruthy();
  });

  it('mounts at the small size used on the boot screen', () => {
    expect(() => render(<CandleLoader size={30} />)).not.toThrow();
  });

  it('mounts at a large size without collapsing', () => {
    expect(() => render(<CandleLoader size={120} />)).not.toThrow();
  });
});

describe('BootScreen', () => {
  it('mounts with the candle loader in place of the old progress bar', () => {
    expect(() => render(<BootScreen />)).not.toThrow();
  });
});
