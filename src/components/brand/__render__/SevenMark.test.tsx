import React from 'react';
import { render } from '@testing-library/react-native';
import { SevenMark } from '../SevenMark';
import { TopAccountBar } from '../../common/TopAccountBar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
  >
    {children}
  </QueryClientProvider>
);

describe('SevenMark', () => {
  it('mounts at the dashboard size', () => {
    expect(() => render(<SevenMark size={36} plate />)).not.toThrow();
  });

  it('mounts at the boot screen size', () => {
    expect(() => render(<SevenMark size={46} />)).not.toThrow();
  });

  it('mounts tiny, where the scene is dropped', () => {
    // Below 28px the candles would alias into noise, so only the numeral and
    // its rule are drawn. It must still render.
    expect(() => render(<SevenMark size={16} />)).not.toThrow();
  });

  it('mounts monochrome, for watermarks and disabled states', () => {
    expect(() => render(<SevenMark size={40} monochrome />)).not.toThrow();
  });

  it('honours an explicit scene override in both directions', () => {
    expect(() => render(<SevenMark size={16} scene />)).not.toThrow();
    expect(() => render(<SevenMark size={80} scene={false} />)).not.toThrow();
  });
});

describe('TopAccountBar', () => {
  it('mounts with the vector mark in place of the old PNG', () => {
    expect(() =>
      render(
        <Wrapper>
          <TopAccountBar />
        </Wrapper>
      )
    ).not.toThrow();
  });
});
