import { usePinnedCards } from './usePinnedCards';

/**
 * Pinned week card — the week-card twin of usePinnedMonth, reading the same
 * persisted store so Settings controls both shortcuts from one place.
 */
export function usePinnedWeek() {
  const pinnedWeek = usePinnedCards(s => s.pinnedWeek);
  const toggleWeek = usePinnedCards(s => s.toggleWeek);
  return { pinned: pinnedWeek, toggle: toggleWeek };
}
