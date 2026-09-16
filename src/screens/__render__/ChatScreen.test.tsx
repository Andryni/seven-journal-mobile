import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChatScreen } from '../ChatScreen';

// Jest only allows a mock factory to close over names prefixed with `mock`.
const mockInvoke = jest.fn(async () => ({ data: { reply: 'ok' }, error: null }));
jest.mock('../../api/supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...a: unknown[]) => mockInvoke(...(a as [])) },
    auth: {
      getSession: jest.fn(async () => ({ data: { session: null } })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({ order: jest.fn(async () => ({ data: [], error: null })) })),
    })),
  },
}));

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
  >
    {children}
  </QueryClientProvider>
);

describe('ChatScreen', () => {
  beforeEach(() => mockInvoke.mockClear());

  it('mounts with no history without throwing', () => {
    expect(() =>
      render(
        <Wrapper>
          <ChatScreen />
        </Wrapper>
      )
    ).not.toThrow();
  });

  it('states the privacy trade-off before anything is sent', () => {
    // This is the only screen that forwards trades off the device, so the
    // disclosure belongs in the empty state, not buried in settings.
    const { getByText } = render(
      <Wrapper>
        <ChatScreen />
      </Wrapper>
    );
    expect(getByText(/n\u2019est pas|ne quittent l\u2019appareil|never leave the device/i)).toBeTruthy();
  });

  it('does not call the function on an empty draft', () => {
    const { getByLabelText } = render(
      <Wrapper>
        <ChatScreen />
      </Wrapper>
    );
    fireEvent.press(getByLabelText(/Envoyer|Send/i));
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('survives repeated re-renders without reordering hooks', () => {
    const { rerender } = render(
      <Wrapper>
        <ChatScreen />
      </Wrapper>
    );
    expect(() => {
      rerender(
        <Wrapper>
          <ChatScreen />
        </Wrapper>
      );
      rerender(
        <Wrapper>
          <ChatScreen />
        </Wrapper>
      );
    }).not.toThrow();
  });
});
