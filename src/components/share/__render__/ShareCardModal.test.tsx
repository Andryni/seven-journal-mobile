import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShareCardModal } from '../ShareCardModal';
import type { Trade } from '../../../types/domain';

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'file:///tmp/card.png'),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider
    client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })}
  >
    {children}
  </QueryClientProvider>
);

function trade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 100,
    exit_price: 110,
    size: 1,
    entry_time: '2025-03-12T09:00:00',
    exit_time: '2025-03-12T11:00:00',
    pnl: 120,
    r_multiple: 1.5,
    timeframe: 'M15',
    commission: 0,
    swap: 0,
    tags: [],
    created_at: '2025-03-12T09:00:00',
    ...over,
  } as unknown as Trade;
}

describe('ShareCardModal', () => {
  it('mounts for an account-wide card', () => {
    expect(() =>
      render(
        <Wrapper>
          <ShareCardModal visible onClose={() => {}} trades={[trade()]} />
        </Wrapper>
      )
    ).not.toThrow();
  });

  it('mounts with no trades at all', () => {
    expect(() =>
      render(
        <Wrapper>
          <ShareCardModal visible onClose={() => {}} trades={[]} />
        </Wrapper>
      )
    ).not.toThrow();
  });

  it('offers the single-trade scope only when opened from a trade', () => {
    const withTrade = render(
      <Wrapper>
        <ShareCardModal visible onClose={() => {}} trades={[trade()]} trade={trade()} />
      </Wrapper>
    );
    expect(withTrade.queryAllByText('CE TRADE').length).toBeGreaterThan(0);

    const withoutTrade = render(
      <Wrapper>
        <ShareCardModal visible onClose={() => {}} trades={[trade()]} />
      </Wrapper>
    );
    expect(withoutTrade.queryAllByText('CE TRADE')).toHaveLength(0);
  });

  it('switches scope without throwing', () => {
    const { getByText } = render(
      <Wrapper>
        <ShareCardModal visible onClose={() => {}} trades={[trade()]} />
      </Wrapper>
    );
    expect(() => {
      fireEvent.press(getByText('SEMAINE'));
      fireEvent.press(getByText('MOIS'));
      fireEvent.press(getByText('TOUT'));
    }).not.toThrow();
  });

  it('says so when the chosen period holds no closed trades', () => {
    // A trade closed long ago: today's card must be empty, not stale.
    const old = trade({ exit_time: '2020-01-05T10:00:00' });
    const { getByText } = render(
      <Wrapper>
        <ShareCardModal visible onClose={() => {}} trades={[old]} />
      </Wrapper>
    );
    expect(getByText('Aucun trade clôturé sur cette période.')).toBeTruthy();
  });

  it('never builds a card out of an open position', () => {
    const open = trade({ pnl: null as never, exit_time: null as never });
    const { getByText } = render(
      <Wrapper>
        <ShareCardModal visible onClose={() => {}} trades={[open]} />
      </Wrapper>
    );
    expect(getByText('Aucun trade clôturé sur cette période.')).toBeTruthy();
  });
});
