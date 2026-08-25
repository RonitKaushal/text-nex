import { getServiceConfig } from '../../utils/serviceConfig';
import { APP_BG_GRADIENT, COLORS } from '../../constants';
import { ServiceLogo } from './ServiceLogo';

interface ServiceLoadingOverlayProps {
  serviceName: string;
  iconType: string;
  customIcon?: string;
  isDarkMode?: boolean;
  url?: string;
}

/** Full-area service boot splash — navy glass card + shimmer (no Spin dots). */
export function ServiceLoadingOverlay({
  serviceName,
  iconType,
  customIcon,
  isDarkMode = true,
  url,
}: ServiceLoadingOverlayProps) {
  const brand = getServiceConfig(iconType).color || COLORS.PRIMARY;
  const muted = isDarkMode ? '#9aa8b8' : '#8c8c8c';
  const titleColor = isDarkMode ? '#f0f4f8' : '#1f1f1f';

  const hint =
    iconType === 'whatsapp'
      ? 'Preparing your chats…'
      : ['chatgpt', 'gemini', 'grok'].includes(iconType)
        ? 'Starting the AI assistant…'
        : 'Almost ready — hanging tight…';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        background: isDarkMode
          ? APP_BG_GRADIENT
          : 'radial-gradient(circle at 50% 35%, #f7fafc 0%, #e8eef5 100%)',
        zIndex: 1000,
        overflow: 'hidden',
      }}
    >
      {/* Brand-tinted ambient glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 380,
          height: 380,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${brand}33 0%, transparent 68%)`,
          top: '46%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          animation: 'svcLoaderGlow 2.8s ease-in-out infinite',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 360,
          textAlign: 'center',
          padding: '40px 32px 32px',
          borderRadius: 20,
          background: isDarkMode ? 'rgba(18, 38, 61, 0.62)' : 'rgba(255,255,255,0.9)',
          border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : 'rgba(0,0,0,0.06)'}`,
          boxShadow: isDarkMode
            ? `0 20px 50px rgba(0,0,0,0.45), 0 0 40px ${brand}22`
            : '0 16px 40px rgba(15, 40, 80, 0.1)',
          backdropFilter: 'blur(12px)',
          animation: 'svcLoaderIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: 24,
          }}
        >
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff',
              border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#eee'}`,
              boxShadow: `0 0 28px ${brand}55`,
              animation: 'svcLoaderLogoPulse 2.2s ease-in-out infinite',
            }}
          >
            <ServiceLogo
              iconType={iconType}
              customIcon={customIcon}
              url={url}
              size={64}
            />
          </div>
        </div>

        <div
          style={{
            fontSize: 18,
            fontWeight: 650,
            color: titleColor,
            letterSpacing: '-0.02em',
            lineHeight: 1.3,
            marginBottom: 8,
          }}
        >
          Loading {serviceName}
        </div>

        <div
          style={{
            fontSize: 13,
            color: muted,
            lineHeight: 1.5,
            marginBottom: 28,
          }}
        >
          {hint}
        </div>

        <div
          role="status"
          aria-label="Loading"
          style={{
            height: 3,
            borderRadius: 2,
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '42%',
              borderRadius: 2,
              background: `linear-gradient(90deg, transparent, ${brand}, transparent)`,
              animation: 'svcLoaderBar 1.35s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes svcLoaderIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes svcLoaderGlow {
          0%, 100% { opacity: 0.65; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
        }
        @keyframes svcLoaderLogoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes svcLoaderBar {
          0% { transform: translateX(-130%); }
          100% { transform: translateX(280%); }
        }
      `}</style>
    </div>
  );
}
