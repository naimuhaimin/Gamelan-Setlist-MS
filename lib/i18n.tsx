'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { MS } from './i18n-ms';

/**
 * App language: English (default) or Bahasa Melayu (Malaysia, not Indonesian).
 * English text is the key; `MS` maps it to Malay. `{name}` placeholders are filled from `vars`.
 * Saved per device in localStorage (`anjung_lang`).
 */
export type Lang = 'en' | 'ms';
const LANG_KEY = 'anjung_lang';

type Vars = Record<string, string | number | null | undefined>;

let currentLang: Lang = 'en';

const fill = (s: string, vars?: Vars) =>
  vars ? s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] === undefined || vars[k] === null ? m : String(vars[k]))) : s;

export const getLang = () => currentLang;

/** Translate outside React components (toasts, lock screen, helpers). Uses the current language. */
export function tr(en: string, vars?: Vars): string {
  if (currentLang === 'ms') {
    const ms = MS[en];
    if (ms === undefined && process.env.NODE_ENV !== 'production') console.warn('[i18n] missing Malay for:', en);
    return fill(ms ?? en, vars);
  }
  return fill(en, vars);
}

/** "1 song" / "2 songs" in English; Malay has no plural form ("1 lagu", "2 lagu"). */
export function plural(n: number, one: string, many: string): string {
  return tr(n === 1 ? one : many, { n });
}

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: typeof tr;
}

const LangContext = createContext<LangContextType>({ lang: 'en', setLang: () => undefined, t: tr });

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'ms' || saved === 'en') {
        currentLang = saved;
        setLangState(saved);
      }
    } catch {
      // private mode: stay in English
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'ms' ? 'ms-MY' : 'en';
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    currentLang = l;
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      // not remembered, fine
    }
  }, []);

  // `t` changes identity with the language so memoised values recompute
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const t = useCallback<typeof tr>((en, vars) => tr(en, vars), [lang]);

  return <LangContext.Provider value={{ lang, setLang, t }}>{children}</LangContext.Provider>;
}

export function useT() {
  return useContext(LangContext);
}
