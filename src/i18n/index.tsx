/*
 * Conditional Probability Explorer - language provider and formatting
 * (c) 2026 Richard Lipka <lipka@fav.zcu.cz> - MIT license
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { en, type TranslationKey } from './en';
import { cs } from './cs';

export type Lang = 'en' | 'cs';

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { en, cs };

export type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translate;
  /** Locale-aware number formatting. */
  n: (value: number, digits?: number) => string;
  pct: (value: number, digits?: number) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

const STORAGE_KEY = 'cpe.lang';

function initialLang(): Lang {
  // A shared link states the language it was written in, and that wins over
  // this browser's own preference — otherwise a Czech link opens in English.
  try {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'en' || fromUrl === 'cs') return fromUrl;
  } catch {
    /* no location (tests) */
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'cs') return saved;
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('cs')
    ? 'cs'
    : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* ignore */
    }
    document.documentElement.lang = l;
  }, []);

  // Keep <html lang> in step, including on first load from a shared link, so
  // assistive technology pronounces the page in the right language.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nValue>(() => {
    const locale = lang === 'cs' ? 'cs-CZ' : 'en-GB';
    const t: Translate = (key, vars) => {
      let s = dictionaries[lang][key] ?? dictionaries.en[key] ?? String(key);
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          s = s.split(`{${k}}`).join(String(v));
        }
      }
      return s;
    };
    const n = (v: number, digits = 0) =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(v);
    const pct = (v: number, digits = 1) => `${n(v * 100, digits)} %`;
    return { lang, setLang, t, n, pct };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export type { TranslationKey };
