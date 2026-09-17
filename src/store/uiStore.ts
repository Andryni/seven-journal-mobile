import { create } from 'zustand';

/**
 * A drill-down from an analytics bar to the trades behind it. `kind` maps to
 * the filter dimension; `value` is the raw (unlocalized) category value the
 * filter engine understands — 'FOCUSED' is stored lowercase, a weekday as
 * its Monday-first index, a holding bucket as "min-max" in minutes.
 */
export interface TradesDrill {
  kind: 'pair' | 'timeframe' | 'session' | 'mental' | 'weekday' | 'holding' | 'setup';
  value: string;
  /** Already-localized label for the active-filter chip. */
  label: string;
}

interface UIState {
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
  isDailySessionLocked: boolean;
  setDailySessionLocked: (locked: boolean) => void;
  tradesDrill: TradesDrill | null;
  setTradesDrill: (drill: TradesDrill | null) => void;
  /** Name of the active tab route, published by the navigator (see App.tsx). */
  activeRouteName: string | null;
  setActiveRouteName: (name: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeAccountId: null,
  setActiveAccountId: (id) => set({ activeAccountId: id }),
  isDailySessionLocked: false,
  setDailySessionLocked: (locked) => set({ isDailySessionLocked: locked }),
  tradesDrill: null,
  setTradesDrill: (drill) => set({ tradesDrill: drill }),
  activeRouteName: null,
  setActiveRouteName: (name) => set({ activeRouteName: name }),
}));
