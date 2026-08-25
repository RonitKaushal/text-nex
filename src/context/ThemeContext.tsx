import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ConfigProvider } from 'antd';
import { getAntdTheme } from '../config/theme';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../constants';
import { AppLoader } from '../components/common';

interface ThemeContextValue {
  isDarkMode: boolean;
  themeLoaded: boolean;
  toggleTheme: () => void;
  setDarkMode: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [themeLoaded, setThemeLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await storage.loadData(STORAGE_KEYS.IS_DARK_MODE);
        if (!cancelled) {
          // New users (no saved preference) get dark mode by default
          setIsDarkMode(typeof saved === 'boolean' ? saved : true);
        }
      } catch {
        if (!cancelled) setIsDarkMode(true);
      } finally {
        if (!cancelled) setThemeLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setDarkMode = useCallback(async (value: boolean) => {
    setIsDarkMode(value);
    await storage.saveData(STORAGE_KEYS.IS_DARK_MODE, value);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDarkMode((prev) => {
      const next = !prev;
      void storage.saveData(STORAGE_KEYS.IS_DARK_MODE, next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      isDarkMode,
      themeLoaded,
      toggleTheme,
      setDarkMode,
    }),
    [isDarkMode, themeLoaded, toggleTheme, setDarkMode]
  );

  if (!themeLoaded) {
    return <AppLoader isDarkMode />;
  }

  return (
    <ThemeContext.Provider value={value}>
      <ConfigProvider theme={getAntdTheme(isDarkMode)}>{children}</ConfigProvider>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
