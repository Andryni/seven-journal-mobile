import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../api/supabaseClient';
import { parseFeed, filterEvents, type EconomicEvent } from './economicEvents';

/**
 * High-impact economic events, via the `calendar` Edge Function.
 *
 * Cached aggressively on purpose. A calendar is a schedule: entries are
 * published days ahead and do not move, so refetching on every screen focus
 * would spend requests to re-learn the same thing. The Edge Function caches
 * for 30 minutes server-side; this adds an hour client-side on top.
 *
 * It never retries and never blocks. The dashboard band is a courtesy, not a
 * figure the trader acts on directly -- if the feed is down, the right
 * outcome is a quiet absence, not a spinner or an error the user must dismiss.
 */

export interface CalendarResult {
  events: EconomicEvent[];
  /** True when the server served a cache it could not refresh. */
  stale: boolean;
}

const EMPTY: CalendarResult = { events: [], stale: true };

export function useEconomicCalendar() {
  const query = useQuery<CalendarResult>({
    queryKey: ['economic_calendar'],
    // Persisted by PersistQueryClientProvider, so the band survives a cold
    // start with no network -- yesterday's schedule is still today's truth.
    staleTime: 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<CalendarResult> => {
      const { data, error } = await supabase.functions.invoke('calendar', {
        body: {},
      });

      // A missing or failed function is not an error worth surfacing here;
      // the band simply does not render.
      if (error || !data) return EMPTY;

      const events = filterEvents(parseFeed(data.events));
      return { events, stale: data.stale === true };
    },
  });

  return {
    events: query.data?.events ?? [],
    stale: query.data?.stale ?? false,
    isLoading: query.isLoading,
  };
}
