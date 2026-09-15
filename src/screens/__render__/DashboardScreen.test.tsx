import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { DashboardScreen } from '../DashboardScreen';

/**
 * The dashboard mounts a long chain of hooks (accounts, trades, metrics,
 * daily lock, notifications) and several animated panels. Restructuring it is
 * exactly the kind of change that reorders hooks by accident, so it gets a
 * mount test.
 */

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
  >
    <NavigationContainer>{children}</NavigationContainer>
  </QueryClientProvider>
);

describe('DashboardScreen', () => {
  it('mounts with no data without throwing', () => {
    expect(() =>
      render(
        <Wrapper>
          <DashboardScreen />
        </Wrapper>
      )
    ).not.toThrow();
  });

  it('survives repeated re-renders without changing hook order', () => {
    const { rerender } = render(
      <Wrapper>
        <DashboardScreen />
      </Wrapper>
    );
    expect(() => {
      rerender(
        <Wrapper>
          <DashboardScreen />
        </Wrapper>
      );
      rerender(
        <Wrapper>
          <DashboardScreen />
        </Wrapper>
      );
    }).not.toThrow();
  });
});
