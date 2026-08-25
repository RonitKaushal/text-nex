import logoBlack from '../assets/logo_Black.png';
import logoLight from '../assets/logo_light.png';

/** Light logo on dark UI; black logo on light UI. */
export function getBrandLogo(isDarkMode: boolean): string {
  return isDarkMode ? logoLight : logoBlack;
}
