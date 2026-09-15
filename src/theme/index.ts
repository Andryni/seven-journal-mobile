import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SEVEN JOURNAL — DESIGN TOKENS
 * North star: "Trading Desk", not "SaaS dashboard".
 *
 * Rules enforced by this file:
 *  1. No Tailwind default palette. Accent is amber phosphor (#FF9F1C), the
 *     colour language of real financial terminals — not indigo-500.
 *  2. Neutrals are warm-tinted, never blue-violet, never pure #000.
 *  3. No glows. Depth comes from hairlines + a single elevation step.
 *  4. Dark only. A half-broken light mode doubled the cost of every screen.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type ThemeMode = 'dark';

export interface Theme {
  colors: {
    // Surfaces (warm neutral ramp, darkest → lightest)
    background: string;
    backgroundElevated: string;
    inputBg: string;
    modalBg: string;
    chartBg: string;
    card: string;
    surface: string;
    surfaceLight: string;

    // Lines
    cardBorder: string;
    cardBorderGlow: string;
    borderStrong: string;
    borderBright: string;
    hairline: string;

    // Brand — amber phosphor
    primary: string;
    primaryLight: string;
    primaryDeep: string;
    primaryGlow: string;
    primaryMuted: string;

    // Prop firm / target
    gold: string;
    goldLight: string;
    goldGlow: string;

    // P&L
    green: string;
    greenLight: string;
    greenGlow: string;
    greenMuted: string;
    red: string;
    redLight: string;
    redGlow: string;
    redMuted: string;

    // Informational
    cyan: string;
    cyanLight: string;
    cyanGlow: string;

    // Text ramp
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
  /**
   * Typographic scale. The old system had everything between 9–16px, so
   * nothing read as a hierarchy. This scale is intentionally gapped:
   * a hero number, a heading, and small uppercase labels — nothing in between.
   */
  type: {
    hero: number;
    display: number;
    metric: number;
    metricSm: number;
    title: number;
    body: number;
    label: number;
    micro: number;
  };
  /** Single elevation step. There is no "elevation 2". */
  elevation: {
    flat: object;
    raised: object;
  };
}

const fonts = {
  // JetBrains Mono — every number, ticker and technical token.
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  monoExtraBold: 'JetBrainsMono_800ExtraBold',
  // Plus Jakarta Sans — UI chrome only.
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

/** Tighter than before: panels, not floating pills. */
const borderRadius = {
  xs: 3,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 14,
  full: 9999,
};

const type = {
  hero: 40,
  display: 26,
  metric: 19,
  metricSm: 15,
  title: 13,
  body: 12,
  label: 10,
  micro: 9,
};

const elevation = {
  flat: {},
  raised: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
};

const darkColors: Theme['colors'] = {
  // Warm near-black. Not #000 (crushes OLED detail), not blue-violet.
  background: '#0A0A0B',
  backgroundElevated: '#101012',
  inputBg: '#0E0E10',
  modalBg: '#141416',
  chartBg: '#0E0E10',
  card: '#121214',
  surface: '#161618',
  surfaceLight: '#1C1C1F',

  cardBorder: 'rgba(255, 255, 255, 0.07)',
  cardBorderGlow: 'rgba(255, 159, 28, 0.32)',
  borderStrong: '#26262A',
  borderBright: 'rgba(255, 255, 255, 0.14)',
  hairline: 'rgba(255, 255, 255, 0.06)',

  // Amber phosphor — the signature. Reads as "terminal", not "startup".
  primary: '#FF9F1C',
  primaryLight: '#FFB74D',
  primaryDeep: '#E08600',
  primaryGlow: 'rgba(255, 159, 28, 0.14)',
  primaryMuted: 'rgba(255, 159, 28, 0.10)',

  // Prop firm keeps a distinct warmer/brassier tone vs the accent.
  gold: '#D4A24C',
  goldLight: '#E8BF74',
  goldGlow: 'rgba(212, 162, 76, 0.14)',

  // P&L — desaturated so they never scream, only inform.
  green: '#2BD576',
  greenLight: '#5FE49A',
  greenGlow: 'rgba(43, 213, 118, 0.14)',
  greenMuted: 'rgba(43, 213, 118, 0.10)',
  red: '#FF4D4D',
  redLight: '#FF7A7A',
  redGlow: 'rgba(255, 77, 77, 0.14)',
  redMuted: 'rgba(255, 77, 77, 0.10)',

  cyan: '#4EC9E8',
  cyanLight: '#8BDDF0',
  cyanGlow: 'rgba(78, 201, 232, 0.14)',

  // Warm-tinted text ramp (slightly off-white, easier on OLED at night).
  textPrimary: '#F5F3F0',
  textSecondary: '#A3A09B',
  textMuted: '#6E6B67',
  textDark: '#4A4845',
};

export const darkTheme: Theme = {
  colors: darkColors,
  fonts,
  spacing,
  borderRadius,
  type,
  elevation,
};

/**
 * Light mode was removed in the "Trading Desk" redesign: it was only ~60%
 * implemented (145 hardcoded rgba() in components bypassed it anyway) and a
 * light trading terminal is not a real use case. Kept as an alias so any
 * lingering import does not crash.
 * @deprecated use `darkTheme`
 */
export const lightTheme: Theme = darkTheme;

interface ThemeState {
  mode: ThemeMode;
  toggleTheme: () => void;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    set => ({
      mode: 'dark' as const,
      toggleTheme: () => set({ mode: 'dark' }),
      setMode: () => set({ mode: 'dark' }),
    }),
    {
      name: 'seven-theme-mode',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/** Main hook: active theme + mode. The app is dark-only by design. */
export function useTheme() {
  const toggleTheme = useThemeStore(s => s.toggleTheme);
  return { theme: darkTheme, mode: 'dark' as ThemeMode, toggleTheme };
}

/** Semantic helper: pick the P&L colour for a value. */
export function pnlColor(theme: Theme, value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return theme.colors.textSecondary;
  return value > 0 ? theme.colors.green : theme.colors.red;
}

export type { Theme as AppTheme };
