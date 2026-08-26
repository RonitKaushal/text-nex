import { useState, type ReactNode } from 'react';
import { Button, Typography } from 'antd';
import {
  ApiOutlined,
  ReloadOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { BrandLogo } from './BrandLogo';
import {
  APP_NAME,
  APP_BG_GRADIENT,
  COLORS,
} from '../../constants';

const { Text } = Typography;

interface ErrorStateProps {
  title: string;
  description?: ReactNode;
  onRetry?: () => void | Promise<void>;
  retryLabel?: string;
  isDarkMode?: boolean;
  /** @deprecated Unused — visual uses a clear status icon instead of Spin */
  showSpin?: boolean;
  tips?: string[];
}

/** Full-page recoverable error (e.g. network failure during license check). */
export function ErrorState({
  title,
  description,
  onRetry,
  retryLabel = 'Try Again',
  isDarkMode = true,
  tips,
}: ErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  const muted = isDarkMode ? '#a8b4c4' : '#5f6368';
  const titleColor = isDarkMode ? '#f0f4f8' : '#1a1a1a';
  const tipBg = isDarkMode ? 'rgba(8, 20, 36, 0.65)' : 'rgba(0,0,0,0.04)';
  const tipBorder = isDarkMode ? COLORS.APP_BORDER : 'rgba(0,0,0,0.08)';

  const defaultTips = [
    'Check Wi‑Fi or ethernet is connected',
    'Disable VPN / proxy briefly and retry',
    'Confirm you can open other websites',
  ];
  const tipList = tips?.length ? tips : defaultTips;

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: isDarkMode
          ? APP_BG_GRADIENT
          : 'radial-gradient(circle at 50% 30%, #f7fafc 0%, #e8eef5 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 480,
          height: 480,
          borderRadius: '50%',
          background: isDarkMode
            ? 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 68%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 68%)',
          top: '38%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          animation: 'errorGlow 3.6s ease-in-out infinite',
        }}
      />

      <div
        role="alert"
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: 420,
          width: '100%',
          textAlign: 'center',
          padding: '36px 32px 28px',
          borderRadius: 20,
          background: isDarkMode ? 'rgba(18, 38, 61, 0.72)' : 'rgba(255,255,255,0.92)',
          border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : 'rgba(0,0,0,0.06)'}`,
          boxShadow: isDarkMode
            ? '0 24px 56px rgba(0,0,0,0.5)'
            : '0 16px 40px rgba(15, 40, 80, 0.12)',
          backdropFilter: 'blur(14px)',
          animation: 'errorIn 0.42s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 18,
          }}
        >
          <BrandLogo
            isDarkMode={isDarkMode}
            size={44}
            style={{
              borderRadius: 12,
              opacity: 0.95,
            }}
          />
        </div>

        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 20px',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDarkMode
              ? 'rgba(255,255,255,0.16)'
              : 'rgba(255,255,255,0.16)',
            border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.16)'}`,
            position: 'relative',
            animation: 'errorIconPulse 2.8s ease-in-out infinite',
          }}
        >
          <WifiOutlined
            style={{
              fontSize: 30,
              color: '#bfbfbf',
            }}
          />
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: 14,
              bottom: 14,
              width: 18,
              height: 18,
              borderRadius: '50%',
              background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff',
              border: '2px solid #bfbfbf',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 700,
              color: '#bfbfbf',
              lineHeight: 1,
            }}
          >
            !
          </span>
        </div>

        <div
          style={{
            fontSize: 20,
            fontWeight: 650,
            color: titleColor,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            marginBottom: 10,
          }}
        >
          {title}
        </div>

        {description && (
          <Text
            style={{
              display: 'block',
              fontSize: 14,
              lineHeight: 1.55,
              color: muted,
              marginBottom: 22,
            }}
          >
            {description}
          </Text>
        )}

        <div
          style={{
            textAlign: 'left',
            background: tipBg,
            border: `1px solid ${tipBorder}`,
            borderRadius: 12,
            padding: '12px 14px',
            marginBottom: 22,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              color: muted,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            <ApiOutlined style={{ fontSize: 13 }} />
            Quick checks
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              color: isDarkMode ? '#d0d7e0' : '#3c4043',
              fontSize: 13,
              lineHeight: 1.55,
            }}
          >
            {tipList.map((tip) => (
              <li key={tip} style={{ marginBottom: 4 }}>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        {onRetry && (
          <Button
            type="primary"
            size="large"
            block
            loading={retrying}
            icon={!retrying ? <ReloadOutlined /> : undefined}
            onClick={() => void handleRetry()}
            style={{
              height: 48,
              borderRadius: 12,
              fontWeight: 600,
              fontSize: 15,
              color: '#111111',
              background: '#ffffff',
              borderColor: '#ffffff',
              boxShadow: '0 8px 24px rgba(255,255,255,0.16)',
            }}
          >
            {retrying ? 'Checking connection…' : retryLabel}
          </Button>
        )}

        <div
          style={{
            marginTop: 16,
            fontSize: 12,
            color: isDarkMode ? '#7a8796' : '#8c8c8c',
          }}
        >
          Your account stays signed in — we only need a connection to verify access.
        </div>
      </div>

      <style>{`
        @keyframes errorIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes errorGlow {
          0%, 100% { opacity: 0.65; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
        }
        @keyframes errorIconPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
