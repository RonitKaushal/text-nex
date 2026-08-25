import React from 'react'

const icon = (file) => `${import.meta.env.BASE_URL}icons/${file}`

export const APP_ICON_256 = icon('icon-256x256.png')
export const APP_ICON_32 = icon('icon-32x32.png')

export const APP_ICON_UI_SIZE = 32

export function AppLogo({ size = APP_ICON_UI_SIZE, style = {} }) {
  const src = size <= 32 ? APP_ICON_32 : APP_ICON_256
  return (
    <img
      src={src}
      alt="Bulk WhatsApp"
      width={size}
      height={size}
      draggable={false}
      style={{ display: 'block', flexShrink: 0, objectFit: 'contain', ...style }}
    />
  )
}

export default function AppBrand({
  iconSize = APP_ICON_UI_SIZE,
  showText = true,
  iconOnly = false,
  centered = false,
  textColor = '#ffffff',
  subTextColor = '#a0a0a0',
  style = {},
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        justifyContent: centered ? 'center' : 'flex-start',
        ...style,
      }}
    >
      <AppLogo size={iconSize} />
      {showText && !iconOnly && (
        <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', textAlign: centered ? 'center' : 'left' }}>
          <div style={{ color: subTextColor, fontSize: '10px', lineHeight: 1 }}>BULK</div>
          <div style={{ color: textColor, fontSize: '14px', fontWeight: 'bold', lineHeight: 1 }}>WHATSAPP</div>
        </div>
      )}
    </div>
  )
}
