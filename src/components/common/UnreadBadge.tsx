import type { CSSProperties } from 'react';

/** Crisp unread count pill for sidebar service icons. */
export function UnreadBadge({
  count,
  size = 'md',
  style,
}: {
  count: number;
  size?: 'sm' | 'md';
  style?: CSSProperties;
}) {
  if (!count || count <= 0) return null;

  const isSm = size === 'sm';
  const label = count > 99 ? '99+' : String(count);

  return (
    <span
      aria-label={`${count} unread`}
      style={{
        position: 'absolute',
        top: isSm ? -3 : -1,
        right: isSm ? -4 : -1,
        zIndex: 20,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
        minWidth: isSm ? 16 : 20,
        height: isSm ? 16 : 20,
        padding: label.length > 1 ? (isSm ? '0 4px' : '0 5px') : 0,
        borderRadius: 999,
        background: '#e53935',
        color: '#ffffff',
        fontSize: isSm ? 10 : 11,
        fontWeight: 800,
        fontFamily:
          "'Gilroy', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        lineHeight: 1,
        letterSpacing: 0,
        whiteSpace: 'nowrap',
        border: '2px solid #000000',

        boxShadow: '0 1px 3px rgba(0,0,0,0.45)',
        pointerEvents: 'none',
        // Keep text sharp (avoid blur from parent filters / compositing)
        transform: 'translateZ(0)',
        WebkitFontSmoothing: 'antialiased',
        ...style,
      }}
    >
      {label}
    </span>
  );
}
