import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NavigationContainer } from '@react-navigation/native';
import { render } from '@testing-library/react-native';
import type { Trade, TradingAccount } from '../types/domain';

/**
 * Shared harness for screen render tests.
 *
 * Every screen sits behind react-query and most read navigation, so each test
 * file was about to repeat the same two providers. More importantly this lets
 * a test SEED the cache: mounting a screen with no data only proves it does
 * not crash while empty, and the bugs that actually reached the device --
 * an axis labelled in dollars, a rail coloured by direction -- only appear
 * once there are trades to draw.
 */

export function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
    },
  });
}

export interface ScreenHarness {
  client: QueryClient;
  trades?: Trade[];
  accounts?: TradingAccount[];
}

/**
 * Seeds the query cache directly rather than mocking supabase.
 *
 * The hooks own their query keys; writing to the cache exercises the real
 * selecting, scoping and memoising code instead of replacing it.
 */
export function seed(client: QueryClient, data: { trades?: Trade[]; accounts?: TradingAccount[] }) {
  if (data.trades) {
    /**
     * useTrades keys on ['trades', activeAccountId], and that id comes from
     * the UI store rather than from props. Seeding only ['trades'] left the
     * real key unresolved, so every screen rendered its loading skeleton and
     * the tests asserted against a tree that contained nothing.
     *
     * Both shapes are written: the bare key for anything reading it directly,
     * and the null-account key that a fresh store produces.
     */
    client.setQueryData(['trades'], data.trades);
    client.setQueryData(['trades', null], data.trades);
    client.setQueryData(['trades', undefined], data.trades);
  }
  if (data.accounts) client.setQueryData(['trading_accounts'], data.accounts);
  // Playbook screens read these two; an undefined cache entry keeps them in
  // a loading state forever inside a test.
  client.setQueryData(['playbook_setups'], []);
  client.setQueryData(['daily_debriefs'], []);
  return client;
}

export function renderScreen(
  ui: React.ReactElement,
  data: { trades?: Trade[]; accounts?: TradingAccount[] } = {}
) {
  const client = makeClient();
  seed(client, data);

  const result = render(
    <QueryClientProvider client={client}>
      <NavigationContainer>{ui}</NavigationContainer>
    </QueryClientProvider>
  );

  return { ...result, client };
}

/** A closed, winning trade. Override anything a test cares about. */
export function makeTrade(over: Partial<Trade> = {}): Trade {
  return {
    id: 't1',
    user_id: 'u',
    account_id: 'acc1',
    pair: 'XAUUSD',
    direction: 'BUY',
    entry_price: 2400,
    exit_price: 2418,
    stop_loss: 2390,
    take_profit: 2430,
    size: 1,
    entry_time: '2026-03-12T09:30:00',
    exit_time: '2026-03-12T11:00:00',
    pnl: 180,
    r_multiple: 1.8,
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
    created_at: '2026-03-12T09:30:00',
    ...over,
  } as unknown as Trade;
}

export function makeAccount(over: Partial<TradingAccount> = {}): TradingAccount {
  return {
    id: 'acc1',
    user_id: 'u',
    name: 'Main',
    type: 'personal',
    balance: 10000,
    initial_balance: 10000,
    currency: 'USD',
    created_at: '2026-01-01T00:00:00',
    ...over,
  } as unknown as TradingAccount;
}

/**
 * A history with enough shape to drive every breakdown: both directions,
 * wins and losses, a scratch, several sessions, instruments and timeframes.
 */
export function makeHistory(n = 30): Trade[] {
  const pairs = ['XAUUSD', 'EURUSD', 'NQ', 'BTCUSD'];
  // Exact domain values: the type caught 'NewYork', which the app never
  // produces and which would have made session breakdowns silently empty.
  const sessions: Trade['session'][] = ['London', 'New York', 'Asia'];
  const frames: Trade['timeframe'][] = ['M5', 'M15', 'H1'];
  const states: Trade['mental_state'][] = ['focused', 'fomo', 'revenge'];

  return Array.from({ length: n }, (_, i) => {
    // Deterministic: a flaky fixture makes a failing screen test useless.
    const win = i % 3 !== 0;
    const scratch = i % 11 === 0;
    const day = (i % 27) + 1;
    return makeTrade({
      id: `t${i}`,
      pair: pairs[i % pairs.length],
      direction: i % 2 === 0 ? 'BUY' : 'SELL',
      pnl: scratch ? 0 : win ? 120 + i * 3 : -(60 + i * 2),
      r_multiple: scratch ? 0 : win ? 1.5 : -1,
      result: scratch ? 'BE' : win ? 'TP' : 'SL',
      session: sessions[i % sessions.length],
      timeframe: frames[i % frames.length],
      mental_state: states[i % states.length],
      entry_time: `2026-03-${String(day).padStart(2, '0')}T09:${String(i % 60).padStart(2, '0')}:00`,
      exit_time: `2026-03-${String(day).padStart(2, '0')}T12:00:00`,
      commission: 2,
      tags: i % 4 === 0 ? ['news'] : [],
    });
  });
}
