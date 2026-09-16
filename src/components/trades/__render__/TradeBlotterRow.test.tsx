import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TradeBlotterRow } from '../TradeBlotterRow';
import type { Trade } from '../../../types/domain';
import { darkTheme as theme } from '../../../theme';

/**
 * One blotter row is rendered by two screens (Trades list, Dashboard
 * preview). This locks the row's contract once, for both: the columns an
 * execution report needs (instrument, R, P&L, outcome), the open-trade
 * fallback, and the tap-through to the detail handler.
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

describe('TradeBlotterRow', () => {
  it('renders instrument, direction, R multiple, P&L and outcome', () => {
    const { getByText } = render(
      <Wrapper>
        <TradeBlotterRow trade={trade()} onPress={noop} />
      </Wrapper>
    );

    expect(getByText('XAUUSD')).toBeTruthy();
    expect(getByText('BUY')).toBeTruthy();
    expect(getByText('+1.0R')).toBeTruthy();
    expect(getByText('+$10.00')).toBeTruthy();
    expect(getByText('TP')).toBeTruthy();
  });

  it('announces an open trade instead of a P&L figure', () => {
    const { getByText, queryByText } = render(
      <Wrapper>
        <TradeBlotterRow trade={trade({ pnl: null, result: 'OPEN' })} onPress={noop} />
      </Wrapper>
    );

    expect(getByText('OPEN')).toBeTruthy();
    expect(queryByText('+$10.00')).toBeNull();
  });

  it('fires onPress with the trade when tapped', () => {
    const onPress = jest.fn();
    const tr = trade();
    const { getByText } = render(
      <Wrapper>
        <TradeBlotterRow trade={tr} onPress={onPress} />
      </Wrapper>
    );

    fireEvent.press(getByText('XAUUSD'));
    expect(onPress).toHaveBeenCalledWith(tr);
  });

  it('renders without an onPress (static list usage) without throwing', () => {
    expect(() =>
      render(
        <Wrapper>
          <TradeBlotterRow trade={trade()} />
        </Wrapper>
      )
    ).not.toThrow();
  });

  /**
   * The left rail states the OUTCOME.
   *
   * It used to be coloured by direction, which duplicated the BUY/SELL label
   * sitting two centimetres to its right while the question a blotter is
   * actually scanned for -- did this win or lose -- had no left-edge cue.
   */
  describe('outcome rail', () => {
    // The rail is the only 3px-wide view in the row.
    const railStyle = (json: any) => {
      const found: any[] = [];
      const walk = (node: any) => {
        if (!node || typeof node !== 'object') return;
        const st = StyleSheet.flatten(node.props?.style);
        if (st && st.width === 3 && st.height === 30) found.push(st);
        (node.children ?? []).forEach(walk);
      };
      walk(json);
      return found[0];
    };

    it('is green for a winning trade whatever its direction', () => {
      for (const direction of ['BUY', 'SELL'] as const) {
        const { toJSON } = render(
          <Wrapper>
            <TradeBlotterRow trade={trade({ direction, pnl: 250, result: 'TP' })} />
          </Wrapper>
        );
        expect(railStyle(toJSON()).backgroundColor).toBe(theme.colors.green);
      }
    });

    it('is red for a losing trade whatever its direction', () => {
      for (const direction of ['BUY', 'SELL'] as const) {
        const { toJSON } = render(
          <Wrapper>
            <TradeBlotterRow trade={trade({ direction, pnl: -120, result: 'SL' })} />
          </Wrapper>
        );
        expect(railStyle(toJSON()).backgroundColor).toBe(theme.colors.red);
      }
    });

    it('follows the money on a breakeven exit, not the label', () => {
      // A BE that banked a partial gain is a win; grey would hide it.
      const { toJSON } = render(
        <Wrapper>
          <TradeBlotterRow trade={trade({ pnl: 40, result: 'BE' })} />
        </Wrapper>
      );
      expect(railStyle(toJSON()).backgroundColor).toBe(theme.colors.green);
    });

    it('stays neutral for an open position, which has no outcome yet', () => {
      const { toJSON } = render(
        <Wrapper>
          <TradeBlotterRow trade={trade({ pnl: null as never, exit_time: null as never })} />
        </Wrapper>
      );
      const bg = railStyle(toJSON()).backgroundColor;
      expect(bg).not.toBe(theme.colors.green);
      expect(bg).not.toBe(theme.colors.red);
    });
  });
});
