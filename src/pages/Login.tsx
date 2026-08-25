import React, { useMemo, useState, type CSSProperties } from 'react';
import { Button, Form, Input, message } from 'antd';
import {
  AppstoreOutlined,
  CheckCircleFilled,
  KeyOutlined,
  MessageOutlined,
  PhoneOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import auth from '../utils/auth';
import { userApi } from '../api/userApi';
import { BrandLogo } from '../components/common';
import { APP_NAME, APP_BG_GRADIENT, COLORS, MESSAGES } from '../constants';

interface LoginProps {
  onSwitchTab?: (tab: string) => void;
  onLoginSuccess?: () => void;
}

type LicenseStatus = 'idle' | 'valid' | 'invalid';

const FEATURES = [
  {
    icon: <AppstoreOutlined />,
    title: 'All your services',
    body: 'WhatsApp, Instagram, Gmail and more — one workspace.',
  },
  {
    icon: <MessageOutlined />,
    title: 'Stay in the loop',
    body: 'Desktop notifications so you never miss a message.',
  },
  {
    icon: <SyncOutlined />,
    title: 'Switch instantly',
    body: 'Jump between accounts and workspaces in a click.',
  },
] as const;

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>('idle');
  const [licenseError, setLicenseError] = useState<string | null>(null);

  const licenseBorder = useMemo(() => {
    if (licenseStatus === 'valid') return '#52c41a';
    if (licenseStatus === 'invalid') return '#ff4d4f';
    return 'rgba(255,255,255,0.18)';
  }, [licenseStatus]);

  const licenseGlow =
    licenseStatus === 'valid'
      ? '0 0 0 3px rgba(82, 196, 26, 0.22)'
      : licenseStatus === 'invalid'
        ? '0 0 0 3px rgba(255, 77, 79, 0.18)'
        : 'none';

  const fieldStyle: CSSProperties = {
    height: 48,
    borderRadius: 12,
    background: 'rgba(8, 16, 28, 0.65)',
    border: '1.5px solid rgba(255,255,255,0.18)',
    color: '#f0f4f8',
    boxShadow: 'none',
  };

  const onFinish = async (values: { phone: string; licenseKey: string }) => {
    setLoading(true);
    setLicenseStatus('idle');
    setLicenseError(null);
    try {
      await auth.logout();

      const response = await userApi.loginWithLicense({
        licenseKey: values.licenseKey.trim(),
        phone: values.phone.trim(),
        deviceType: 'software',
        appType: 'text-next',
      });

      if (response.data?.success) {
        const { token: newToken, user, refreshToken } = response.data;

        const userData = {
          token: newToken,
          email: user?.email,
          phone: user?.phone,
        };

        const authResult = await auth.setUser(userData);
        if (!authResult) {
          auth.emergencyAuthRestore(userData);
        }

        if (refreshToken) {
          try {
            localStorage.setItem('refreshToken', refreshToken);
          } catch {
            /* ignore */
          }
        }

        setLicenseStatus('valid');
        message.success(MESSAGES.LOGIN_SUCCESS);
        window.setTimeout(() => {
          onLoginSuccess?.();
        }, 420);
      } else {
        setLicenseStatus('invalid');
        setLicenseError(MESSAGES.LOGIN_FAILED);
        message.error(MESSAGES.LOGIN_FAILED);
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      const msg =
        err?.response?.data?.message || 'Login failed. Please check your connection.';
      setLicenseStatus('invalid');
      setLicenseError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: APP_BG_GRADIENT,
        padding: '32px 24px',
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 560,
          height: 560,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(139,124,246,0.16) 0%, transparent 68%)',
          top: '28%',
          left: '38%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="login-shell"
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 1040,
          display: 'grid',
          gridTemplateColumns: '1.05fr 0.95fr',
          gap: 48,
          alignItems: 'center',
        }}
      >
        {/* Left brand column */}
        <div className="login-brand" style={{ padding: '8px 12px' }}>
          <BrandLogo
            isDarkMode
            size={64}
            style={{
              borderRadius: 16,
              marginBottom: 28,
              boxShadow: `0 0 36px ${COLORS.PRIMARY}44`,
            }}
          />

          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(32px, 4vw, 44px)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#fff',
            }}
          >
            All your messaging.
            <br />
            <span style={{ fontWeight: 500, color: 'rgba(255,255,255,0.78)' }}>
              One app.
            </span>
          </h1>

          <div
            className="login-features"
            style={{ marginTop: 36, display: 'flex', flexDirection: 'column', gap: 18 }}
          >
            {FEATURES.map((f) => (
              <div
                key={f.title}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: COLORS.APP_BG_ELEVATED,
                    border: `1px solid ${COLORS.APP_BORDER}`,
                    color: COLORS.PRIMARY,
                    fontSize: 16,
                  }}
                >
                  {f.icon}
                </div>
                <div>
                  <div
                    style={{
                      color: '#f0f4f8',
                      fontWeight: 600,
                      fontSize: 15,
                      marginBottom: 2,
                    }}
                  >
                    {f.title}
                  </div>
                  <div style={{ color: '#9aa8b8', fontSize: 13, lineHeight: 1.45 }}>
                    {f.body}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 40,
              fontSize: 12,
              color: 'rgba(255,255,255,0.38)',
              letterSpacing: 0.2,
            }}
          >
            {APP_NAME} · Secure multi-service workspace
          </div>
        </div>

        {/* Right form card */}
        <div
          className="login-card"
          style={{
            background: 'rgba(12, 24, 40, 0.72)',
            border: `1px solid ${COLORS.APP_BORDER}`,
            borderRadius: 22,
            padding: '36px 32px 32px',
            boxShadow:
              '0 0 0 1px rgba(139,124,246,0.12), 0 24px 60px rgba(0,0,0,0.45), 0 0 80px rgba(139,124,246,0.08)',
            backdropFilter: 'blur(14px)',
            animation: 'loginCardIn 0.45s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <div style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: '-0.02em',
                marginBottom: 8,
              }}
            >
              Get started
            </div>
            <div style={{ fontSize: 14, color: '#9aa8b8', lineHeight: 1.5 }}>
              Enter your phone number and license key to access {APP_NAME}.
            </div>
          </div>

          <Form
            form={form}
            name="login"
            onFinish={onFinish}
            layout="vertical"
            requiredMark={false}
            onValuesChange={(changed) => {
              if ('licenseKey' in changed && licenseStatus !== 'idle') {
                setLicenseStatus('idle');
                setLicenseError(null);
              }
            }}
          >
            <Form.Item
              name="phone"
              label={
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>
                  Phone
                </span>
              }
              rules={[{ required: true, message: 'Please enter your phone number' }]}
              style={{ marginBottom: 18 }}
            >
              <Input
                size="large"
                placeholder="Your phone number"
                prefix={<PhoneOutlined style={{ color: '#7a8796' }} />}
                style={fieldStyle}
              />
            </Form.Item>

            <Form.Item
              name="licenseKey"
              label={
                <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500 }}>
                  License key
                </span>
              }
              rules={[{ required: true, message: 'Please enter your license key' }]}
              validateStatus={
                licenseStatus === 'invalid'
                  ? 'error'
                  : licenseStatus === 'valid'
                    ? 'success'
                    : undefined
              }
              help={
                licenseStatus === 'invalid'
                  ? licenseError
                  : licenseStatus === 'valid'
                    ? 'License verified'
                    : undefined
              }
              style={{ marginBottom: 8 }}
            >
              <Input
                size="large"
                placeholder="XXXX-XXXX-XXXX-XXXX"
                prefix={
                  licenseStatus === 'valid' ? (
                    <CheckCircleFilled style={{ color: '#52c41a' }} />
                  ) : (
                    <KeyOutlined
                      style={{
                        color:
                          licenseStatus === 'invalid' ? '#ff4d4f' : '#7a8796',
                      }}
                    />
                  )
                }
                style={{
                  ...fieldStyle,
                  borderColor: licenseBorder,
                  boxShadow: licenseGlow,
                  color:
                    licenseStatus === 'valid'
                      ? '#73d13d'
                      : licenseStatus === 'invalid'
                        ? '#ff7875'
                        : '#f0f4f8',
                  transition:
                    'border-color 0.25s ease, box-shadow 0.25s ease, color 0.25s ease',
                }}
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 24 }}>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                loading={loading}
                block
                style={{
                  height: 48,
                  fontWeight: 600,
                  fontSize: 15,
                  border: 'none',
                  borderRadius: 999,
                  background:
                    licenseStatus === 'valid'
                      ? 'linear-gradient(135deg, #52c41a, #389e0d)'
                      : 'linear-gradient(135deg, #a99bf8 0%, #8b7cf6 55%, #6f5ee0 100%)',
                  boxShadow:
                    licenseStatus === 'valid'
                      ? '0 8px 24px rgba(82, 196, 26, 0.35)'
                      : '0 8px 24px rgba(22, 119, 255, 0.35)',
                  transition: 'background 0.3s ease, box-shadow 0.3s ease',
                }}
              >
                {licenseStatus === 'valid' ? 'License verified' : 'Continue'}
              </Button>
            </Form.Item>
          </Form>
        </div>
      </div>

      <style>{`
        @keyframes loginCardIn {
          from { opacity: 0; transform: translateY(18px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        .login-card .ant-input-affix-wrapper {
          background: rgba(8, 16, 28, 0.65) !important;
        }
        .login-card .ant-input-affix-wrapper > input.ant-input {
          background: transparent !important;
          color: inherit !important;
        }
        .login-card .ant-input-affix-wrapper:hover,
        .login-card .ant-input-affix-wrapper-focused {
          background: rgba(8, 16, 28, 0.85) !important;
        }
        .login-card .ant-form-item-explain-error {
          color: #ff7875;
        }
        .login-card .ant-form-item-explain-success {
          color: #73d13d;
        }

        @media (max-width: 880px) {
          .login-shell {
            grid-template-columns: 1fr !important;
            gap: 28px !important;
            max-width: 440px !important;
          }
          .login-brand {
            text-align: center;
            padding: 0 !important;
          }
          .login-brand img {
            margin-left: auto;
            margin-right: auto;
          }
          .login-brand .login-features {
            text-align: left;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
