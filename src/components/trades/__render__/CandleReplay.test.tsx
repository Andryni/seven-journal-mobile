import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CandleReplay } from '../CandleReplay';
import type { Trade } from '../../../types/domain';

/**
 * The replay states, which matter more than the drawing.
 *
 * There is no market data provider behind this chart: the candles come from
 * the trader's own terminal, on request. So the section must never render an
 * empty chart, and it must never promise prices it does not have — "not asked
 * yet" and "cannot be asked" look identical on screen unless the component
 * distinguishes them.
 *
 * (The geometry itself — axis, domain, marker placement — is unit-tested in
 * src/utils/__tests__/candleChart.test.ts, where it can be checked without a
 * renderer.)
 */

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>
);

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: 't1',
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2410,
    stop_loss: 2395,
    take_profit: 2415,
    size: 1,
    entry_time: '2026-09-15T12:00:00Z',
    exit_time: '2026-09-15T12:45:00Z',
    pnl: 10,
    r_multiple: 2,
    timeframe: 'M15',
    setup_structures: [],
    setup_fvg: false,
    setup_ob: false,
    setup_liquidity_sweep: false,
    bookmap_absorption: null,
    bookmap_passive_orders: null,
    bookmap_aggressive_orders: null,
    bookmap_vwap_position: null,
    mental_state: 'focused',
    cookie_jar_ref: false,
    rule_40_percent: false,
    screenshot_before_url: null,
    screenshot_after_url: null,
    notes: null,
    result: 'TP',
    session: 'London',
    created_at: '2026-09-15T12:45:00Z',
    sync_source_id: 'staging-1',
    ...over,
  }) as Trade;

describe('CandleReplay — states', () => {
  it('mounts for a bridge trade without throwing', () => {
    expect(() =>
      render(
        <Wrapper>
          <CandleReplay trade={trade()} />
        </Wrapper>
      )
    ).not.toThrow();
  });

  it('asks the terminal rather than drawing an empty chart', () => {
    // No candles in the cache: the section offers the request and says when an
    // answer is expected. What it must NOT do is render a blank chart, which
    // reads as a trade with no price action.
    const { getByText, queryByTestId } = render(
      <Wrapper>
        <CandleReplay trade={trade()} />
      </Wrapper>
    );

    expect(getByText(/Demander les bougies|Ask the terminal/)).toBeTruthy();
    expect(queryByTestId('candle-replay-chart')).toBeNull();
  });

  it('explains what the terminal needs to answer', () => {
    const { getByText } = render(
      <Wrapper>
        <CandleReplay trade={trade()} />
      </Wrapper>
    );
    // The version requirement is part of the promise: a terminal older than
    // v1.17 will never answer, and the trader has to be able to find that out
    // here rather than by tapping forever.
    expect(getByText(/v1\.17/)).toBeTruthy();
  });
});
