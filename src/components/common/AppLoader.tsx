import { BrandLogo } from './BrandLogo';
import {
  APP_NAME,
  APP_BG_GRADIENT,
  COLORS,
  MESSAGES,
} from '../../constants';

interface AppLoaderProps {
  message?: string;
  subtitle?: string;
  showLogo?: boolean;
  /** @deprecated Built-in loader is always shown when loading */
  showSpin?: boolean;
  isDarkMode?: boolean;
  /** @deprecated Ignored — custom brand loader is used */
  spin?: unknown;
}

/** Full-viewport brand splash for auth, theme boot, and license checks. */
export function AppLoader({
  message = MESSAGES.LOADING_APP,
  subtitle,
  showLogo = true,
  isDarkMode = true,
}: AppLoaderProps) {
  const muted = isDarkMode ? '#9aa8b8' : '#8c8c8c';
  const titleColor = isDarkMode ? '#f0f4f8' : '#1f1f1f';

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
      {/* Soft ambient glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 420,
          height: 420,
          borderRadius: '50%',
          background: isDarkMode
            ? 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(139,124,246,0.1) 0%, transparent 70%)',
          top: '42%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          animation: 'appLoaderGlow 3.2s ease-in-out infinite',
        }}
      />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
          maxWidth: 380,
          width: '100%',
          padding: '40px 36px 36px',
          borderRadius: 20,
          background: isDarkMode ? 'rgba(26, 26, 26, 0.85)' : 'rgba(255,255,255,0.85)',
          border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : 'rgba(0,0,0,0.06)'}`,
          boxShadow: isDarkMode
            ? '0 20px 50px rgba(0,0,0,0.45)'
            : '0 16px 40px rgba(0, 0, 0, 0.1)',
          backdropFilter: 'blur(12px)',
          animation: 'appLoaderIn 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {showLogo && (
          <div
            style={{
              marginBottom: 28,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <BrandLogo
              isDarkMode={isDarkMode}
              size={72}
              style={{
                borderRadius: 18,
                boxShadow: isDarkMode
                  ? `0 0 32px ${COLORS.PRIMARY}55`
                  : '0 8px 24px rgba(0,0,0,0.12)',
                animation: 'appLoaderLogoPulse 2.4s ease-in-out infinite',
              }}
            />
          </div>
        )}

        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: titleColor,
            letterSpacing: '-0.01em',
            lineHeight: 1.35,
            marginBottom: 8,
          }}
        >
          {message}
        </div>

        <div
          style={{
            fontSize: 13,
            color: muted,
            lineHeight: 1.5,
          }}
        >
          {subtitle || 'This only takes a moment'}
        </div>

        {/* Progress shimmer bar */}
        <div
          style={{
            marginTop: 28,
            height: 3,
            borderRadius: 2,
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: '40%',
              borderRadius: 2,
              background: `linear-gradient(90deg, transparent, ${COLORS.PRIMARY}, transparent)`,
              animation: 'appLoaderBar 1.4s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes appLoaderIn {
          from { opacity: 0; transform: translateY(14px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes appLoaderGlow {
          0%, 100% { opacity: 0.7; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.08); }
        }
        @keyframes appLoaderLogoPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        @keyframes appLoaderBar {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(320%); }
        }
      `}</style>
    </div>
  );
}
