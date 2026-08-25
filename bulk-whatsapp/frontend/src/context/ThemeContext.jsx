import React, { createContext, useContext } from 'react';

const ThemeContext = createContext();

/** TextNexus-aligned deep navy theme */
export const APP_COLORS = {
  APP_BG_BASE: '#000d18',
  APP_BG_GLOW: '#0b1325',
  APP_BG_DEEP: '#050a12',
  APP_BG_PANEL: '#0a1524',
  APP_BG_ELEVATED: '#122033',
  APP_BORDER: '#1a2a3d',
  PRIMARY: '#8b7cf6',
};

export const APP_BG_GRADIENT =
  'radial-gradient(ellipse 120% 80% at 40% 0%, #0b1325 0%, #000d18 50%, #050a12 100%)';

export const ThemeProvider = ({ children }) => {
  const isDarkMode = true;
  const toggleTheme = () => {};

  const theme = {
    isDarkMode: true,
    background: APP_COLORS.APP_BG_BASE,
    contentBackground: 'transparent',
    componentBackground: 'transparent',
    sidebarBackground: APP_COLORS.APP_BG_BASE,
    headerBackground: 'rgba(10, 21, 36, 0.72)',
    text: '#ffffff',
    subText: '#a0a0a0',
    border: APP_COLORS.APP_BORDER,
    accent: APP_COLORS.PRIMARY,
    highlight: APP_COLORS.APP_BG_ELEVATED,
    panel: APP_COLORS.APP_BG_PANEL,
    elevated: APP_COLORS.APP_BG_ELEVATED,
    gradient: APP_BG_GRADIENT,
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
