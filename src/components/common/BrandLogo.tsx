import type { CSSProperties, ImgHTMLAttributes } from 'react';
import { APP_NAME } from '../../constants';
import { getBrandLogo } from '../../utils/brandLogo';

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'alt'> {
  isDarkMode?: boolean;
  size?: number;
  alt?: string;
  style?: CSSProperties;
}

/** Theme-aware TextNexus mark — light logo in dark mode, black logo in light mode. */
export function BrandLogo({
  isDarkMode = true,
  size,
  alt = APP_NAME,
  style,
  ...rest
}: BrandLogoProps) {
  return (
    <img
      src={getBrandLogo(isDarkMode)}
      alt={alt}
      style={{
        ...(size != null ? { width: size, height: size } : null),
        objectFit: 'contain',
        display: 'block',
        ...style,
      }}
      {...rest}
    />
  );
}
