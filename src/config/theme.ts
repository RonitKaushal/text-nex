import type { ThemeConfig } from 'antd';
import { theme } from 'antd';
import { COLORS, FONT_FAMILY, FONT_FAMILY_MONO, accentColor } from '../constants';

const { defaultAlgorithm, darkAlgorithm } = theme;

/** Single source of truth for Ant Design theme tokens (removes 4× duplication in App). */
export function getAntdTheme(isDarkMode: boolean): ThemeConfig {
  const primary = accentColor(isDarkMode);
  return {
    algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
    token: {
      colorPrimary: primary,
      colorInfo: primary,
      colorSuccess: isDarkMode ? '#d9d9d9' : '#262626',
      colorWarning: isDarkMode ? '#bfbfbf' : '#595959',
      colorError: isDarkMode ? '#f5f5f5' : '#141414',
      colorLink: primary,
      borderRadius: 8,
      fontFamily: FONT_FAMILY,
      fontFamilyCode: FONT_FAMILY_MONO,
      colorBgContainer: isDarkMode ? COLORS.APP_BG_PANEL : '#fff',
      colorBgElevated: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff',
      colorBgLayout: isDarkMode ? COLORS.APP_BG_BASE : '#f0f2f5',
      colorText: isDarkMode ? '#fff' : 'rgba(0, 0, 0, 0.88)',
      colorTextSecondary: isDarkMode
        ? 'rgba(255, 255, 255, 0.65)'
        : 'rgba(0, 0, 0, 0.45)',
      colorBorder: isDarkMode ? COLORS.APP_BORDER : '#d9d9d9',
      colorSplit: isDarkMode ? COLORS.APP_BORDER : '#f0f0f0',
      controlOutline: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)',
    },
    components: {
      Button: {
        primaryShadow: 'none',
        defaultShadow: 'none',
        dangerShadow: 'none',
      },
    },
  };
}
