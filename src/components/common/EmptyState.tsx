import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { BrandLogo } from './BrandLogo';
import { APP_NAME, APP_BG_GRADIENT, COLORS } from '../../constants';

const { Text } = Typography;

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  isDarkMode?: boolean;
  showLogo?: boolean;
  titleColor?: string;
  children?: ReactNode;
}

/** Reusable empty / CTA panel (welcome, license expired, etc.). */
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  isDarkMode = false,
  showLogo = true,
  titleColor,
  children,
}: EmptyStateProps) {
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        padding: 24,
        background: isDarkMode ? APP_BG_GRADIENT : 'radial-gradient(circle at center, #fafafa 0%, #f0f2f5 100%)',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '44px 40px 40px',
          borderRadius: 20,
          maxWidth: 440,
          width: '100%',
          background: isDarkMode ? 'rgba(18, 38, 61, 0.72)' : '#fff',
          boxShadow: isDarkMode
            ? '0 16px 48px rgba(0,0,0,0.4)'
            : '0 12px 40px rgba(0,0,0,0.08)',
          border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#f0f0f0'}`,
          animation: 'emptyStateIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {showLogo && (
          <div
            style={{
              marginBottom: 28,
              display: 'flex',
              justifyContent: 'center',
              width: '100%',
            }}
          >
            <BrandLogo
              isDarkMode={isDarkMode}
              size={88}
              alt={`${APP_NAME} Logo`}
              style={{
                borderRadius: 22,
                boxShadow: isDarkMode
                  ? `0 0 28px ${COLORS.PRIMARY}44`
                  : '0 8px 24px rgba(0,0,0,0.1)',
              }}
            />
          </div>
        )}
        <Text
          style={{
            fontSize: 26,
            display: 'block',
            marginBottom: 12,
            fontWeight: 700,
            letterSpacing: -0.3,
            color: titleColor ?? (isDarkMode ? '#fff' : '#141414'),
          }}
        >
          {title}
        </Text>
        {description && (
          <Text
            style={{
              fontSize: 15,
              display: 'block',
              marginBottom: 28,
              maxWidth: 340,
              marginInline: 'auto',
              lineHeight: 1.55,
              color: isDarkMode ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)',
            }}
          >
            {description}
          </Text>
        )}
        {children}
        {actionLabel && onAction && (
          <Button
            type="primary"
            icon={actionIcon}
            size="large"
            onClick={onAction}
            style={{
              height: 48,
              paddingInline: 28,
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 24,
              marginTop: children ? 16 : 0,
              border: 'none',
              background: 'linear-gradient(135deg, #a99bf8 0%, #8b7cf6 55%, #6f5ee0 100%)',
              boxShadow: '0 6px 20px rgba(22, 119, 255, 0.4)',
            }}
          >
            {actionLabel}
          </Button>
        )}
      </div>
      <style>{`
        @keyframes emptyStateIn {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
