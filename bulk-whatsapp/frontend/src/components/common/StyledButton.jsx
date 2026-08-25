import React from 'react'
import { Button } from 'antd'

const COLORS = {
  primary: '#0095FF',
  primaryHover: '#33aaff',
  border: '#1a2a3d',
  elevated: '#122033',
  panel: '#0a1524',
  danger: '#EF4444',
  success: '#22C55E',
  text: '#ffffff',
}

const StyledButton = ({
  variant = 'primary',
  size = 'middle',
  children,
  icon,
  loading = false,
  disabled = false,
  onClick,
  style = {},
  ...props
}) => {
  const sizeStyles = {
    large: { height: 44, padding: '0 20px', fontSize: 15 },
    middle: { height: 40, padding: '0 16px', fontSize: 14 },
    small: { height: 32, padding: '0 12px', fontSize: 13 },
  }

  const variants = {
    primary: {
      border: `1px solid ${COLORS.primary}`,
      color: '#fff',
      background: COLORS.primary,
    },
    secondary: {
      border: `1px solid ${COLORS.border}`,
      color: COLORS.text,
      background: COLORS.elevated,
    },
    danger: {
      border: `1px solid rgba(239,68,68,0.45)`,
      color: COLORS.danger,
      background: 'rgba(239,68,68,0.12)',
    },
    success: {
      border: `1px solid rgba(34,197,94,0.45)`,
      color: COLORS.success,
      background: 'rgba(34,197,94,0.12)',
    },
    ghost: {
      border: `1px solid ${COLORS.border}`,
      color: 'rgba(255,255,255,0.75)',
      background: 'transparent',
    },
  }

  return (
    <Button
      icon={icon}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      size={size}
      style={{
        borderRadius: 8,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        boxShadow: 'none',
        transition: 'background 0.2s ease, border-color 0.2s ease, opacity 0.2s ease',
        ...sizeStyles[size],
        ...variants[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

export default StyledButton
