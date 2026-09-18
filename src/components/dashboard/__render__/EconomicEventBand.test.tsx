import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { EconomicEventBand } from '../EconomicEventBand';
import { parseFeed } from '../../../features/calendar/economicEvents';

/**
 * The real client starts an auth refresh timer at module scope, which keeps
 * the Jest environment alive long after the test ends. Nothing here touches
 * the network -- the cache is seeded directly -- so a stub is enough.
 */
jest.mock('../../../api/supabaseClient', () => ({
  supabase: { functions: { invoke: jest.fn(async () => ({ data: null, error: null })) } },
}));

/**
 * The band must be invisible unless it has something to say.
 *
 * It sits on a dashboard held to a nine-section budget, so "renders nothing"
 * is the behaviour that earns it a place there — an empty frame saying "no
 * events" would cost the same space as the information it lacks.
 */

function renderBand(events: unknown[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  // Seed the cache the hook reads, so no network is involved.
  client.setQueryData(['economic_calendar'], {
    events: parseFeed(events),
    stale: false,
  });
  return render(
    <QueryClientProvider client={client}>
      <EconomicEventBand />
    </QueryClientProvider>
  );
}

const soon = (minutes: number, over: Record<string, unknown> = {}) => ({
  title: 'Core CPI m/m',
  country: 'USD',
  date: new Date(Date.now() + minutes * 60000).toISOString(),
  impact: 'High',
  forecast: '0.2%',
  previous: '0.3%',
  ...over,
});

describe('EconomicEventBand', () => {
  it('renders nothing when the calendar is empty', () => {
    expect(renderBand([]).toJSON()).toBeNull();
  });

  it('renders nothing when every event is days away', () => {
    expect(renderBand([soon(60 * 48)]).toJSON()).toBeNull();
  });

  it('shows the next release with its currency', () => {
    const { getByText } = renderBand([soon(120)]);
    expect(getByText('USD')).toBeTruthy();
    expect(getByText('Core CPI m/m')).toBeTruthy();
  });

  it('counts down in hours and minutes', () => {
    const { getByText } = renderBand([soon(150)]);
    expect(getByText(/dans 2 h 30/)).toBeTruthy();
  });

  it('counts down in minutes when close', () => {
    const { getByText } = renderBand([soon(25)]);
    expect(getByText(/dans 25 min/)).toBeTruthy();
  });

  it('says "now" inside the release window', () => {
    const { getByText } = renderBand([soon(1)]);
    expect(getByText(/maintenant/)).toBeTruthy();
  });

  it('still reports a release that just happened', () => {
    // "CPI was 20 minutes ago" explains a chaotic chart; silence does not.
    const { getByText } = renderBand([soon(-20)]);
    expect(getByText(/il y a 20 min/)).toBeTruthy();
  });

  it('picks the soonest upcoming event, not the first in the list', () => {
    const { getByText } = renderBand([
      soon(300, { title: 'Later one' }),
      soon(45, { title: 'Sooner one' }),
    ]);
    expect(getByText('Sooner one')).toBeTruthy();
  });

  it('mounts without throwing when the query has no data at all', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    expect(() =>
      render(
        <QueryClientProvider client={client}>
          <EconomicEventBand />
        </QueryClientProvider>
      )
    ).not.toThrow();
  });
});
