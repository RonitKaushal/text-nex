import React, { useMemo, useState, type CSSProperties } from 'react';
import { Button, Form, Input, message } from 'antd';
import {
  CheckCircleFilled,
  KeyOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons';
import auth from '../utils/auth';
import { userApi } from '../api/userApi';
import { WindowChromeBar } from '../components/common';
import { FONT_FAMILY, MESSAGES } from '../constants';
import { setStoredUsername, getStoredUsername } from '../utils/username';
import arcticSwitchLogo from '../assets/arctic-switch-login.png';

interface LoginProps {
  onSwitchTab?: (tab: string) => void;
  onLoginSuccess?: () => void;
}

type LicenseStatus = 'idle' | 'valid' | 'invalid';

const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [licenseStatus, setLicenseStatus] = useState<LicenseStatus>('idle');
  const [licenseError, setLicenseError] = useState<string | null>(null);

  React.useEffect(() => {
    const existing = getStoredUsername();
    if (existing) {
      form.setFieldsValue({ username: existing });
    }
  }, [form]);

  const licenseBorder = useMemo(() => {
    if (licenseStatus === 'valid') return '#ffffff';
    if (licenseStatus === 'invalid') return '#ffffff';
    return 'rgba(255,255,255,0.2)';
  }, [licenseStatus]);

  const fieldStyle: CSSProperties = {
    height: 50,
    borderRadius: 999,
    background: '#111111',
    border: '1px solid rgba(255,255,255,0.16)',
    color: '#f5f5f5',
    boxShadow: 'none',
  };

  const onFinish = async (values: {
    username: string;
    phone: string;
    licenseKey: string;
  }) => {
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

        // Only the display name is stored locally (not sent to the API)
        setStoredUsername(values.username.trim());

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
      className="tn-login"
      style={{
        minHeight: '100vh',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#000000',
        boxSizing: 'border-box',
        fontFamily: FONT_FAMILY,
        color: '#ffffff',
      }}
    >
      <WindowChromeBar isDarkMode />

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
          boxSizing: 'border-box',
          minHeight: 0,
          overflow: 'auto',
        }}
      >
      <div
        className="tn-login-panel"
        style={{
          width: '100%',
          maxWidth: 520,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          animation: 'tnLoginIn 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          <img
            src={arcticSwitchLogo}
            alt="Arctic Switch"
            style={{
              width: '100%',
              maxWidth: 480,
              height: 'auto',
              display: 'block',
              objectFit: 'contain',
              objectPosition: 'center',
              marginBottom: 28,
              animation: 'tnLoginLogo 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          />
          <h1
            style={{
              margin: 0,
              fontSize: 'clamp(28px, 5vw, 36px)',
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#ffffff',
            }}
          >
            Sign in to continue
          </h1>
          <p
            style={{
              margin: '12px 0 0',
              fontSize: 15,
              lineHeight: 1.5,
              color: 'rgba(255,255,255,0.5)',
              maxWidth: 320,
            }}
          >
            Enter your username, phone, and license key to open your workspace.
          </p>
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
            name="username"
            label={
              <span
                style={{
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Username
              </span>
            }
            rules={[
              { required: true, message: 'Please enter a username' },
              { min: 2, message: 'Username must be at least 2 characters' },
              { max: 32, message: 'Username must be 32 characters or less' },
            ]}
            style={{ marginBottom: 18 }}
          >
            <Input
              size="large"
              placeholder="e.g. Alex"
              maxLength={32}
              prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.35)' }} />}
              style={fieldStyle}
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label={
              <span
                style={{
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                Phone
              </span>
            }
            rules={[{ required: true, message: 'Please enter your phone number' }]}
            style={{ marginBottom: 18 }}
          >
            <Input
              size="large"
              placeholder="Your phone number"
              prefix={<PhoneOutlined style={{ color: 'rgba(255,255,255,0.35)' }} />}
              style={fieldStyle}
            />
          </Form.Item>

          <Form.Item
            name="licenseKey"
            label={
              <span
                style={{
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
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
                  <CheckCircleFilled style={{ color: '#ffffff' }} />
                ) : (
                  <KeyOutlined
                    style={{
                      color:
                        licenseStatus === 'invalid'
                          ? '#ffffff'
                          : 'rgba(255,255,255,0.35)',
                    }}
                  />
                )
              }
              style={{
                ...fieldStyle,
                borderColor: licenseBorder,
                color:
                  licenseStatus === 'valid'
                    ? '#ffffff'
                    : licenseStatus === 'invalid'
                      ? '#d9d9d9'
                      : '#f5f5f5',
                transition: 'border-color 0.2s ease, color 0.2s ease',
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 28 }}>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              loading={loading}
              block
              style={{
                height: 50,
                fontWeight: 600,
                fontSize: 15,
                border: 'none',
                borderRadius: 999,
                color: '#111111',
                background: '#ffffff',
                boxShadow: 'none',
              }}
            >
              {licenseStatus === 'valid' ? 'License verified' : 'Continue'}
            </Button>
          </Form.Item>
        </Form>

        <div
          style={{
            marginTop: 28,
            textAlign: 'center',
            fontSize: 12,
            color: 'rgba(255,255,255,0.28)',
            letterSpacing: 0.2,
          }}
        >
          Secure multi-service workspace
        </div>
      </div>
      </div>

      <style>{`
        @keyframes tnLoginIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes tnLoginLogo {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }

        .tn-login .ant-input-affix-wrapper {
          background: #111111 !important;
          border-radius: 999px !important;
        }
        .tn-login .ant-input-affix-wrapper > input.ant-input {
          background: transparent !important;
          color: inherit !important;
        }
        .tn-login .ant-input-affix-wrapper:hover,
        .tn-login .ant-input-affix-wrapper-focused {
          background: #161616 !important;
          border-color: rgba(255,255,255,0.32) !important;
        }
        .tn-login .ant-form-item-explain-error {
          color: #cfcfcf;
        }
        .tn-login .ant-form-item-explain-success {
          color: #ffffff;
        }
        .tn-login .ant-btn-primary:hover {
          background: #e8e8e8 !important;
          color: #111111 !important;
        }
      `}</style>
    </div>
  );
};

export default Login;
