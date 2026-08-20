import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, type Language } from './translations';

interface I18nState {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
}

export const useI18nStore = create<I18nState>()(
  persist(
    set => ({
      lang: 'fr',
      setLang: lang => set({ lang }),
      toggleLang: () => set(s => ({ lang: s.lang === 'fr' ? 'en' : 'fr' })),
    }),
    {
      name: 'seven-language',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

type FrKeys = keyof (typeof translations)['fr'];
type EnKeys = keyof (typeof translations)['en'];

/** Signature de la fonction de traduction `t` retournée par `useT()`. */
export type TFunction = (key: FrKeys, ...args: unknown[]) => string;

// Mappings id (stocké en DB) → clé i18n (libellé de données)
const MENTAL_STATE_KEYS: Record<string, FrKeys> = {
  focused: 'mentalFocused',
  anxious: 'mentalAnxious',
  greedy: 'mentalGreedy',
  revenge: 'mentalRevenge',
  fomo: 'mentalFomo',
  tired: 'mentalTired',
};

const SESSION_KEYS: Record<string, FrKeys> = {
  '': 'sessionNone',
  Asia: 'sessionAsia',
  London: 'sessionLondon',
  'New York': 'sessionNewYork',
  'Over Session': 'sessionOver',
};

const ACCOUNT_TYPE_KEYS: Record<string, FrKeys> = {
  challenge: 'accountTypeChallenge',
  funded: 'accountTypeFunded',
  personal: 'accountTypePersonal',
  demo: 'accountTypeDemo',
};

/** Libellé traduit d'un état mental (ids stockés en DB : focused, anxious, greedy, revenge, fomo, tired). */
export function mentalStateLabel(t: TFunction, id: string | null | undefined): string {
  const key = id !== null && id !== undefined ? MENTAL_STATE_KEYS[id] : undefined;
  return key ? t(key) : id || '—';
}

/** Libellé traduit d'une session (ids stockés en DB : '', 'Asia', 'London', 'New York', 'Over Session'). */
export function sessionLabel(t: TFunction, id: string | null | undefined): string {
  const key = id !== null && id !== undefined ? SESSION_KEYS[id] : undefined;
  return key ? t(key) : id ? id.toUpperCase() : '—';
}

/** Libellé traduit d'un type de compte (ids stockés en DB : challenge, funded, personal, demo). */
export function accountTypeLabel(t: TFunction, id: string | null | undefined): string {
  const key = id !== null && id !== undefined ? ACCOUNT_TYPE_KEYS[id] : undefined;
  return key ? t(key) : id ? id.toUpperCase() : '—';
}

/**
 * Locale BCP-47 pour le formatage des dates, selon la langue courante.
 */
export function localeFor(lang: Language): string {
  return lang === 'fr' ? 'fr-FR' : 'en-US';
}

/**
 * Hook de traduction : retourne `t(key)` et le langage courant.
 * Les dictionnaires FR et EN partagent exactement les mêmes clés.
 */
export function useT() {
  const lang = useI18nStore(s => s.lang);
  const toggleLang = useI18nStore(s => s.toggleLang);
  const dict = translations[lang] as Record<FrKeys & EnKeys, unknown>;

  const t: TFunction = (key, ...args) => {
    const value = dict[key];
    if (typeof value === 'function') {
      return (value as (...a: unknown[]) => string)(...args);
    }
    return value as string;
  };

  return { t, lang, toggleLang };
}
