import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Which dashboard shortcut cards are pinned.
 *
 * A useState inside DashboardScreen would be the wrong memory: a pin is a
 * persistent preference, not session state, and unmounting the tab (every tab
 * switch) must not silently disarm it. The re-arm control lives in Settings,
 * so the preference has to survive there too — one store shared by both
 * surfaces.
 */
interface PinnedCardsState {
  /** The month export shortcut. */
  pinnedMonth: boolean;
  /** The week export shortcut. */
  pinnedWeek: boolean;
  toggleMonth: () => void;
  toggleWeek: () => void;
}

export const usePinnedCards = create<PinnedCardsState>()(
  persist(
    set => ({
      pinnedMonth: false,
      pinnedWeek: false,
      toggleMonth: () => set(s => ({ pinnedMonth: !s.pinnedMonth })),
      toggleWeek: () => set(s => ({ pinnedWeek: !s.pinnedWeek })),
    }),
    {
      name: 'seven-pinned-cards',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
