import { useMemo } from 'react';
import { queryClient } from '../../api/queryClient';
import type { CalendarResult } from './useEconomicCalendar';
import { useEconomicCalendar } from './useEconomicCalendar';
import { newsContextAt, newsWarningAt, type NewsContext } from './newsContext';

/**
 * News context from the calendar ALREADY in cache.
 *
 * Synchronous and cache-only, on purpose: saving a trade must never wait for
 * the network, and a form that blocks on a second request to annotate itself
 * would trade a certain annoyance for an uncertain annotation. The calendar is
 * fetched by the dashboard band and the coach, and persisted by
 * PersistQueryClientProvider, so "no cache" is the rare case — and it records
 * NOTHING rather than "no news", which is the only honest answer.
 */
export function resolveNewsContext(
  entryIso: string | null | undefined
): NewsContext | null {
  if (!entryIso) return null;
  const cached = queryClient.getQueryData<CalendarResult>(['economic_calendar']);
  if (!cached || cached.events.length === 0) return null;
  return newsContextAt(entryIso, cached.events);
}

/**
 * The context back out of a saved row.
 *
 * Structural on purpose: the trade may come from a database that predates the
 * columns, so every field is optional and a missing offset means "not
 * recorded" rather than "at no news".
 */
export function newsFromTrade(trade: {
  news_event?: string | null;
  news_currency?: string | null;
  news_offset_min?: number | null;
}): NewsContext | null {
  const { news_event: event, news_currency: currency, news_offset_min: offsetMin } = trade;
  if (!event || offsetMin === null || offsetMin === undefined) return null;
  return { event, currency: currency ?? '', offsetMin };
}

/** The columns a trade row carries once the context has been resolved. */
export function newsColumns(ctx: NewsContext | null): {
  news_event: string | null;
  news_currency: string | null;
  news_offset_min: number | null;
} {
  return {
    news_event: ctx?.event ?? null,
    news_currency: ctx?.currency ?? null,
    news_offset_min: ctx?.offsetMin ?? null,
  };
}

/**
 * The warning shown BEFORE saving, when the clock is inside the tight window.
 * Reactive (it re-renders as the minute passes), unlike resolveNewsContext:
 * this one is on screen while the trader decides, so it has to be able to
 * appear and disappear on its own.
 */
export function useNewsWarning(at: string | number | Date | null | undefined) {
  const { events } = useEconomicCalendar();

  return useMemo(() => {
    if (at === null || at === undefined) return null;
    return newsWarningAt(at, events);
  }, [at, events]);
}
