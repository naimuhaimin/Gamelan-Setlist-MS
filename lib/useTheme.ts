'use client';

import { useCallback, useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';
export const THEME_KEY = 'anjung_theme';
const THEME_COLOR: Record<Theme, string> = { dark: '#0d0b09', light: '#f7f2e9' };

/** Applies the theme to <html> and the browser chrome colour. */
function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'light') root.dataset.theme = 'light';
  else delete root.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[theme]);
}

/** Per-device theme; dark is the default. */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    let saved: Theme = 'dark';
    try {
      saved = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
    } catch {
      // storage blocked: keep dark
    }
    setThemeState(saved);
    apply(saved);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    apply(t);
    try {
      localStorage.setItem(THEME_KEY, t);
    } catch {
      // ignore
    }
  }, []);

  return { theme, setTheme };
}

/** Runs before first paint so a light-mode device never flashes dark. */
export const themeBootScript = `try{if(localStorage.getItem('${THEME_KEY}')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}`;
