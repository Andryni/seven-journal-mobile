import React from 'react';
import { render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DisciplineCostCard } from '../DisciplineCostCard';
import type { Trade } from '../../../types/domain';

/** `useMoney` reads the account from react-query, so the card needs a client. */
const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <QueryClientProvider
    client={
      new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
    }
  >
    {children}
  </QueryClientProvider>
);

/**
 * The card's whole claim to being trustworthy is what it refuses to print, so
 * that is what is tested: nothing below the sample floor, and no invented cost
 * when the trader's own record shows none.
 */
let clock = Date.UTC(2026, 8, 1, 10, 0, 0);

const trade = (over: Partial<Trade> = {}): Trade =>
  ({
    id: `t-${Math.random().toString(36).slice(2, 8)}`,
    user_id: 'u',
    account_id: 'a',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2405,
    stop_loss: 2395,
    take_profit: 2415,
    size: 1,
    entry_time: new Date(clock).toISOString(),
    exit_time: new Date(clock + 20 * 60 * 1000).toISOString(),
    pnl: 50,
    r_multiple: 1,
    timeframe: 'M15',
    setup_structures: ['FVG'],
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
    created_at: new Date(clock).toISOString(),
    ...over,
  }) as Trade;

function baseline(n: number): Trade[] {
  const out: Trade[] = [];
  for (let i = 0; i < n; i++) {
    clock += 4 * 60 * 60 * 1000;
    out.push(trade());
  }
  return out;
}

describe('DisciplineCostCard', () => {
  beforeEach(() => {
    clock = Date.UTC(2026, 8, 1, 10, 0, 0);
  });

  it('renders nothing on a thin sample', () => {
    const { toJSON } = render(<DisciplineCostCard trades={baseline(6)} />, {
      wrapper: Wrapper,
    });
    expect(toJSON()).toBeNull();
  });

  it('names the behaviour responsible for the cost', () => {
    const trades = baseline(20);
    for (let i = 0; i < 6; i++) {
      clock += 4 * 60 * 60 * 1000;
      trades.push(trade({ mental_state: 'revenge', pnl: -100 }));
    }

    const { getByText } = render(<DisciplineCostCard trades={trades} />, {
      wrapper: Wrapper,
    });
    expect(getByText(/tilt/i)).toBeTruthy();
    // The count is the honest denominator: a cost without it reads like magic.
    expect(getByText(/6 trade\(s\)/)).toBeTruthy();
  });

  it('says so plainly when no bucket cost anything, instead of showing a zero', () => {
    // Twenty clean winners, then six trades the trader could not attribute to
    // any plan — which earned exactly the same. There is a bucket and it costs
    // nothing, and a lone "0" would read as praise for a book with no plan.
    const trades = [...baseline(20)];
    for (let i = 0; i < 6; i++) {
      clock += 4 * 60 * 60 * 1000;
      trades.push(trade({ setup_structures: [], pnl: 50 }));
    }

    const { getByText } = render(<DisciplineCostCard trades={trades} />, {
      wrapper: Wrapper,
    });
    expect(getByText(/Aucun coût/i)).toBeTruthy();
  });
});
