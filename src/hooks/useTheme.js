import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'guitar-theme';

// Resolve the initial theme: an explicit saved choice wins; otherwise fall back
// to the OS preference. Guarded for SSR / non-DOM environments.
function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(STORAGE_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Theme state manager. Applies `data-theme` to <html> so the token overrides in
 * tokens.css take effect, persists an explicit choice to localStorage, and — as
 * long as the user has not made an explicit choice — tracks the OS preference.
 */
export default function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme);

  // Reflect the current theme onto the document element.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Follow OS preference changes only while no explicit choice is stored.
  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = (e) => {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        setThemeState(e.matches ? 'light' : 'dark');
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((next) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  return { theme, setTheme, toggleTheme };
}
