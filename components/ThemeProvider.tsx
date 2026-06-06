'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');

  // Sync from the data-theme attribute that the no-flash script set before
  // React hydrated. This avoids a flash of wrong theme on load.
  useEffect(() => {
    let initial: Theme = 'dark';
    try {
      const saved = localStorage.getItem('pnl-theme') as Theme | null;
      if (saved === 'light' || saved === 'dark') initial = saved;
    } catch {
      // localStorage unavailable (private browsing, quota full) - stay dark
    }
    setThemeState(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    document.documentElement.setAttribute('data-theme', t);
    try {
      localStorage.setItem('pnl-theme', t);
    } catch {
      // localStorage unavailable - theme works for session but won't persist
    }
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
