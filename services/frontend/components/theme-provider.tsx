'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Read whatever the inline head script already stamped onto <html>
  // so React's first render matches the DOM exactly (no flash / no mismatch).
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stampedTheme = document.documentElement.getAttribute('data-theme');
      if (stampedTheme === 'light' || stampedTheme === 'dark') {
        return stampedTheme;
      }
    }

    return 'light';
  });

  // Hydrate saved theme on mount (covers edge cases where the inline
  // script didn't run for some reason, e.g. localStorage was empty).
  useEffect(() => {
    const saved = localStorage.getItem('vs-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    }
  }, []);

  // Apply theme to <html data-theme="..."> and persist
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('vs-theme', theme);
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