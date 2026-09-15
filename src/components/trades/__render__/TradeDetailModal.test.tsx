import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TradeDetailModal } from '../TradeDetailModal';
import { ExcursionBar } from '../ExcursionBar';
import type { Trade } from '../../../types/domain';

/**
 * Render tests for the trade detail screen.
 *
 * These exist because of two bugs that shipped: a hook placed after an early
 * return ("Rendered more hooks than during the previous render") and a worklet
 * calling a plain JS closure ("Tried to synchronously call a Remote Function").
 *
 * Neither was visible to tsc, to the unit tests, or to a successful Metro
 * bundle -- they only appear when the component actually mounts. So these
 * tests mount it.
 */

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>
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
    stop_loss: 90,
    take_profit: 130,
    size: 1,
    entry_time: '2025-01-01T10:00:00Z',
    exit_time: '2025-01-01T12:00:00Z',
    pnl: 10,
    r_multiple: 1,
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
    commission: 0,
    swap: 0,
    mae_price: null,
    mfe_price: null,
    tags: [],
    created_at: '2025-01-01T10:00:00Z',
    ...over,
  } as Trade;
}

const noop = () => {};

describe('TradeDetailModal — mounting', () => {
  it('mounts with a trade without throwing', () => {
    expect(() =>
      render(
        <Wrapper>
          <TradeDetailModal
            visible
            trade={trade()}
            onClose={noop}
            onEdit={noop}
            onDelete={noop}
          />
        </Wrapper>
      )
    ).not.toThrow();
  });

  it('mounts with a null trade without throwing', () => {
    expect(() =>
      render(
        <Wrapper>
          <TradeDetailModal
            visible
            trade={null}
            onClose={noop}
            onEdit={noop}
            onDelete={noop}
          />
        </Wrapper>
      )
    ).not.toThrow();
  });

  it('survives going from a null trade to a real one and back', () => {
    // This is the exact sequence that produced "Rendered more hooks than
    // during the previous render": a hook that only ran when trade was set.
    const { rerender } = render(
      <Wrapper>
        <TradeDetailModal
          visible
          trade={null}
          onClose={noop}
          onEdit={noop}
          onDelete={noop}
        />
      </Wrapper>
    );

    expect(() => {
      rerender(
        <Wrapper>
          <TradeDetailModal
            visible
            trade={trade()}
            onClose={noop}
            onEdit={noop}
            onDelete={noop}
          />
        </Wrapper>
      );
      rerender(
        <Wrapper>
          <TradeDetailModal
            visible
            trade={null}
            onClose={noop}
            onEdit={noop}
            onDelete={noop}
          />
        </Wrapper>
      );
    }).not.toThrow();
  });

  it('mounts a trade carrying excursions, costs and tags', () => {
    // The combination that exercises every panel added recently.
    expect(() =>
      render(
        <Wrapper>
          <TradeDetailModal
            visible
            trade={trade({
              mae_price: 95,
              mfe_price: 130,
              commission: 7,
              swap: 1.5,
              tags: ['fvg', 'london'],
            })}
            onClose={noop}
            onEdit={noop}
            onDelete={noop}
          />
        </Wrapper>
      )
    ).not.toThrow();
  });
});

describe('ExcursionBar — animated styles', () => {
  it('mounts without calling a JS closure from a worklet', () => {
    // The worklet crash fired on the first animation frame, so simply
    // mounting an ExcursionBar with real excursions reproduces it.
    expect(() =>
      render(<ExcursionBar trade={trade({ mae_price: 95, mfe_price: 130 })} />)
    ).not.toThrow();
  });

  it('renders nothing when the trade has no excursions', () => {
    const { toJSON } = render(<ExcursionBar trade={trade()} />);
    expect(toJSON()).toBeNull();
  });

  it('mounts for a short position', () => {
    expect(() =>
      render(
        <ExcursionBar
          trade={trade({
            direction: 'SELL',
            entry_price: 100,
            stop_loss: 110,
            exit_price: 90,
            mae_price: 105,
            mfe_price: 70,
          })}
        />
      )
    ).not.toThrow();
  });

  it('mounts when only one side of the excursion is recorded', () => {
    expect(() =>
      render(<ExcursionBar trade={trade({ mae_price: 95, mfe_price: null })} />)
    ).not.toThrow();
  });
});
