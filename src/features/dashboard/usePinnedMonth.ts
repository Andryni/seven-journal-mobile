import { usePinnedCards } from './usePinnedCards';

/**
 * Pinned month card, expressed as a hook over the unified pinned-cards store.
 *
 * Kept as its own seam because the month card predates the week card: both
 * flags live in one persisted store, but the dashboard still reads them
 * through distinct, self-documenting hooks.
 */
export function usePinnedMonth() {
  const pinnedMonth = usePinnedCards(s => s.pinnedMonth);
  const toggleMonth = usePinnedCards(s => s.toggleMonth);
  return { pinned: pinnedMonth, toggle: toggleMonth };
}
