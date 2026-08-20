import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'dark' | 'light';

export interface Theme {
  colors: {
    background: string;
    backgroundElevated: string;
    inputBg: string;
    modalBg: string;
    chartBg: string;
    card: string;
    cardBorder: string;
    cardBorderGlow: string;
    borderStrong: string;
    surface: string;
    surfaceLight: string;
    primary: string;
    primaryLight: string;
    primaryDeep: string;
    primaryGlow: string;
    gold: string;
    goldLight: string;
    goldGlow: string;
    green: string;
    greenLight: string;
    greenGlow: string;
    red: string;
    redLight: string;
    redGlow: string;
    cyan: string;
    cyanLight: string;
    cyanGlow: string;
    borderBright: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    textDark: string;
  };
  fonts: {
    mono: string;
    monoMedium: string;
    monoBold: string;
    monoExtraBold: string;
    sans: string;
    sansMedium: string;
    sansSemiBold: string;
    sansBold: string;
    sansExtraBold: string;
  };
  spacing: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    xxl: number;
  };
  borderRadius: {
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
    full: number;
  };
}

const fonts = {
  // JetBrains Mono for financial tickers, numbers and math
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  monoExtraBold: 'JetBrainsMono_800ExtraBold',
  // Plus Jakarta Sans for high-end FinTech headers and UI
  sans: 'PlusJakartaSans_400Regular',
  sansMedium: 'PlusJakartaSans_500Medium',
  sansSemiBold: 'PlusJakartaSans_600SemiBold',
  sansBold: 'PlusJakartaSans_700Bold',
  sansExtraBold: 'PlusJakartaSans_800ExtraBold',
};

const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
};

const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
};

const darkColors: Theme['colors'] = {
  background: '#07080a', // Deep Bloomberg dark
  backgroundElevated: '#0d0f15',
  inputBg: '#0a0c12',
  modalBg: '#181920',
  chartBg: '#12141c',
  card: '#12141c',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  cardBorderGlow: 'rgba(99, 102, 241, 0.3)',
  borderStrong: '#262833',
  surface: '#161922',
  surfaceLight: '#1f2330',
  primary: '#6366f1', // High-tech Indigo
  primaryLight: '#818cf8',
  primaryDeep: '#4f46e5',
  primaryGlow: 'rgba(99, 102, 241, 0.25)',
  gold: '#f59e0b',
  goldLight: '#fbbf24',
  goldGlow: 'rgba(245, 158, 11, 0.2)',
  green: '#10b981', // Neon Emerald
  greenLight: '#34d399',
  greenGlow: 'rgba(16, 185, 129, 0.2)',
  red: '#ef4444', // Crimson Red
  redLight: '#f87171',
  redGlow: 'rgba(239, 68, 68, 0.2)',
  cyan: '#06b6d4',
  cyanLight: '#67e8f9',
  cyanGlow: 'rgba(6, 182, 212, 0.2)',
  borderBright: 'rgba(255, 255, 255, 0.15)',
  textPrimary: '#ffffff',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  textDark: '#475569',
};

const lightColors: Theme['colors'] = {
  background: '#f1f2f7', // Soft paper grey
  backgroundElevated: '#ffffff',
  inputBg: '#ffffff',
  modalBg: '#ffffff',
  chartBg: '#ffffff',
  card: '#ffffff',
  cardBorder: 'rgba(15, 23, 42, 0.1)',
  cardBorderGlow: 'rgba(99, 102, 241, 0.35)',
  borderStrong: '#cbd5e1',
  surface: '#eef0f5',
  surfaceLight: '#e2e6ee',
  primary: '#4f46e5', // Indigo (darker for light bg)
  primaryLight: '#6366f1',
  primaryDeep: '#4338ca',
  primaryGlow: 'rgba(79, 70, 229, 0.15)',
  gold: '#b45309',
  goldLight: '#d97706',
  goldGlow: 'rgba(180, 83, 9, 0.15)',
  green: '#059669', // Emerald (darker for light bg)
  greenLight: '#047857',
  greenGlow: 'rgba(5, 150, 105, 0.15)',
  red: '#dc2626', // Crimson (darker for light bg)
  redLight: '#b91c1c',
  redGlow: 'rgba(220, 38, 38, 0.15)',
  cyan: '#0891b2',
  cyanLight: '#0e7490',
  cyanGlow: 'rgba(8, 145, 178, 0.15)',
  borderBright: 'rgba(15, 23, 42, 0.2)',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#64748b',
  textDark: '#94a3b8',
};

export const darkTheme: Theme = {
  colors: darkColors,
  fonts,
  spacing,
  borderRadius,
};

export const lightTheme: Theme = {
  colors: lightColors,
  fonts,
  spacing,
  borderRadius,
};

// ── Store de préférences (mode sombre/clair) ──

interface ThemeState {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      mode: 'dark',
      toggleTheme: () => set(s => ({ mode: s.mode === 'dark' ? 'light' : 'dark' })),
      setMode: mode => set({ mode }),
    }),
    {
      name: 'seven-theme-mode',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Hook principal : retourne le thème actif + le mode + le toggle. */
export function useTheme() {
  const mode = useThemeStore(s => s.mode);
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  return { theme: mode === 'light' ? lightTheme : darkTheme, mode, toggleTheme };
}

export type { Theme as AppTheme };
