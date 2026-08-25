import { cloneElement, isValidElement, type CSSProperties, type ReactElement } from 'react';
import { getServiceConfig, getServiceLogoSrc } from '../../utils/serviceConfig';

interface ServiceLogoProps {
  iconType: string;
  size?: number;
  style?: CSSProperties;
  customIcon?: string;
  /** Optional service URL — used to fetch official favicon for custom services. */
  url?: string;
}

/** Renders the official service brand logo (local asset or site favicon). */
export function ServiceLogo({ iconType, size = 48, style, customIcon, url }: ServiceLogoProps) {
  const logoSrc =
    customIcon ||
    getServiceLogoSrc({ iconType, customIcon, url }, url);

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt=""
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          borderRadius: Math.max(4, size * 0.12),
          ...style,
        }}
      />
    );
  }

  const { icon, color } = getServiceConfig(iconType);

  if (!isValidElement(icon)) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.22,
          background: color,
          ...style,
        }}
      />
    );
  }

  const el = icon as ReactElement<{ style?: CSSProperties; src?: string }>;

  if (el.type === 'img' || typeof el.props?.src === 'string') {
    return cloneElement(el, {
      style: {
        ...el.props.style,
        width: size,
        height: size,
        objectFit: 'contain' as const,
        display: 'block',
        ...style,
      },
    });
  }

  return cloneElement(el, {
    style: {
      ...el.props.style,
      fontSize: size,
      width: size,
      height: size,
      color,
      lineHeight: 1,
      display: 'block',
      ...style,
    },
  });
}
