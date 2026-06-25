'use client';

import { Sun, Moon } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

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
        <Sun size={13} className="theme-switch-icon theme-switch-icon--sun" />
        <Moon size={13} className="theme-switch-icon theme-switch-icon--moon" />
      </span>
      <span className="theme-switch-thumb">
        {isDark ? <Moon size={14} strokeWidth={2} /> : <Sun size={14} strokeWidth={2} />}
      </span>
    </button>
  );
}