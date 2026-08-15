import { create } from 'zustand';

interface UIState {
  activeAccountId: string | null;
  setActiveAccountId: (id: string | null) => void;
  isDailySessionLocked: boolean;
  setDailySessionLocked: (locked: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeAccountId: null,
  setActiveAccountId: (id) => set({ activeAccountId: id }),
  isDailySessionLocked: false,
  setDailySessionLocked: (locked: boolean) => set({ isDailySessionLocked: locked }),
}));
