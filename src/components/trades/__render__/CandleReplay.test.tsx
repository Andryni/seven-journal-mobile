import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
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
 * The capture path is tested at the seam: CandleReplay rasterizes its own Svg
 * (stubbed below) and hands the PNG to `onCapture`. The confirm/cancel flow
 * around replacing an existing image lives in TradeDetailModal.
 *
 * (The geometry itself — axis, domain, marker placement — is unit-tested in
 * src/utils/__tests__/candleChart.test.ts, where it can be checked without a
 * renderer.)
 */

/**
 * Rasterization is native work, so the Svg the chart mounts gets a ref handle
 * whose toDataURL hands back a plausible data URI. Long enough to pass the
 * component's sanity check on the rasterized bytes. The Proxy hands back
 * inert Views for every other primitive — Line, Rect, and anything lucide's
 * icons pull in — so no real Svg renders in tests and no icon breaks.
 */
const mockPngUri = 'data:image/png;base64,' + 'A'.repeat(96);

jest.mock('react-native-svg', () => {
  const React = require('react');
  const RN = require('react-native');
  const asView = (props: Record<string, unknown>) =>
    React.createElement(RN.View, { ...props, children: null });
  const mod: Record<string, unknown> = {
    __esModule: true,
    default: React.forwardRef(
      (props: Record<string, unknown>, ref: React.Ref<unknown>) => {
        React.useImperativeHandle(ref, () => ({
          toDataURL: (cb: (uri: string) => void) => cb(mockPngUri),
        }));
        return asView(props);
      }
    ),
  };
  return new Proxy(mod, {
    get: (target, key) =>
      key in target ? target[key as string] : React.forwardRef((props: Record<string, unknown>) => asView(props)),
  });
});

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

/** Same literal the Svg stub above resolves to. */
const PNG_URI = mockPngUri;;

const seedCandles = (client: QueryClient, bars = 2) => {
  client.setQueryData(['trade_candles', 't1'], {
    bars: Array.from({ length: bars }, (_, i) => ({
      t: `2026-09-15T11:5${i}:00Z`,
      o: 2399 + i,
      h: 2401 + i,
      l: 2398 + i,
      c: 2400.5 + i,
    })),
    timeframe: 'M1',
    truncated: false,
    fetchedAt: new Date().toISOString(),
  });
};

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

    expect(getByText(/EA v1.17/)).toBeTruthy();
  });
});

describe('CandleReplay — capture', () => {
  it('emits the PNG to the wired sink when the trader captures', async () => {
    const client = makeClient();
    seedCandles(client);

    const onCapture = jest.fn();
    const screen = render(
      <QueryClientProvider client={client}>
        <CandleReplay trade={trade()} onCapture={onCapture} />
      </QueryClientProvider>
    );

    expect(screen.getByTestId('candle-replay-chart')).toBeTruthy();
    fireEvent.press(screen.getByTestId('candle-replay-capture'));
    await waitFor(() => expect(onCapture).toHaveBeenCalledWith(PNG_URI));
  });

  it('offers no capture button when no sink is wired', () => {
    const client = makeClient();
    seedCandles(client, 1);

    const { queryByTestId } = render(
      <QueryClientProvider client={client}>
        <CandleReplay trade={trade()} />
      </QueryClientProvider>
    );

    expect(queryByTestId('candle-replay-chart')).toBeTruthy();
    expect(queryByTestId('candle-replay-capture')).toBeNull();
  });
});
