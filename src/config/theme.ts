import type { ThemeConfig } from 'antd';
import { theme } from 'antd';
import { COLORS, FONT_FAMILY, FONT_FAMILY_MONO } from '../constants';

const { defaultAlgorithm, darkAlgorithm } = theme;

/** Single source of truth for Ant Design theme tokens (removes 4× duplication in App). */
export function getAntdTheme(isDarkMode: boolean): ThemeConfig {
  return {
    algorithm: isDarkMode ? darkAlgorithm : defaultAlgorithm,
    token: {
      colorPrimary: COLORS.PRIMARY,
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
    },
  };
}
