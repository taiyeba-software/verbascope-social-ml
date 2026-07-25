'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const isDark = theme === 'dark';

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <button type="button" className="theme-switch" aria-label="Toggle dark mode" />;
  }

  return (
    <button
      type="button"
      className={`theme-switch ${isDark ? 'theme-switch--dark' : 'theme-switch--light'}`}
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle dark mode"
      onClick={toggleTheme}
    >
      <span className="theme-switch-track">
        <Sun size={15} className="theme-switch-icon theme-switch-icon--sun" />
        <Moon size={15} className="theme-switch-icon theme-switch-icon--moon" />
      </span>
      <span className="theme-switch-thumb">
        {isDark ? <Moon size={15} strokeWidth={4} /> : <Sun size={15} strokeWidth={4} />}
      </span>
    </button>
  );
}