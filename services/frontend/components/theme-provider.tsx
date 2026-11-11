'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
});

const COOKIE_NAME = 'vs-theme';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/* The server (app/layout.tsx) stamps an inline background colour on <html>
   for the very first paint. That inline colour used to stay on <html> after
   the user toggled the theme, so on a phone — when the browser bar collapses
   and the screen becomes taller than the page — the OLD theme's colour showed
   as a light strip below the dark page (or the other way round).

   IMPORTANT: these two values must be the same two colours layout.tsx stamps
   (search for `backgroundColor` in app/layout.tsx and copy them here), so the
   first paint and later toggles always match. */
const THEME_BACKGROUND: Record<Theme, string> = {
  dark: '#0f172a',
  light: '#d9ecf7',
};

function setThemeCookie(theme: Theme) {
  document.cookie = `${COOKIE_NAME}=${theme}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

export function ThemeProvider({
  children,
  initialTheme,
}: {
  children: React.ReactNode;
  initialTheme: Theme;
}) {
  // The server already resolved the theme from the cookie and stamped it
  // onto <html data-theme="..."> before this component ever mounts, so
  // this first render matches the server exactly — no client-only
  // guessing, no mismatch, no flash.
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Keep <html>, localStorage (kept for any other code still reading it),
  // and the cookie (so the *next* server render already knows the choice)
  // all in sync whenever the theme changes.
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    root.style.backgroundColor = THEME_BACKGROUND[theme]; // NEW: keep in step with the theme
    localStorage.setItem('vs-theme', theme);
    setThemeCookie(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useThemeContext = () => useContext(ThemeContext);