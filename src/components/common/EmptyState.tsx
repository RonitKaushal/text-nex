import type { ReactNode } from 'react';
import { Button, Typography } from 'antd';
import { BrandLogo } from './BrandLogo';
import { APP_NAME, COLORS } from '../../constants';

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
        background: isDarkMode ? '#000000' : '#f5f5f5',
      }}
    >
      <div
        style={{
          textAlign: 'center',
          padding: '44px 40px 40px',
          borderRadius: 20,
          maxWidth: 440,
          width: '100%',
          background: isDarkMode ? '#000000' : '#fff',
          boxShadow: 'none',
          border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#e8e8e8'}`,
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
            className="tn-empty-cta"
            icon={actionIcon}
            size="large"
            onClick={onAction}
            style={{
              height: 48,
              paddingInline: 28,
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 999,
              marginTop: children ? 16 : 0,
              border: 'none',
              background: '#ffffff',
              color: '#111111',
              boxShadow: 'none',
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
        .tn-empty-cta.ant-btn-primary {
          background: #ffffff !important;
          color: #111111 !important;
        }
        .tn-empty-cta.ant-btn-primary:hover {
          background: #e8e8e8 !important;
          color: #111111 !important;
        }
        .tn-empty-cta.ant-btn-primary .anticon {
          color: #111111 !important;
        }
      `}</style>
    </div>
  );
}
