import type { CSSProperties } from 'react';
import { Modal, Input, Button, Typography } from 'antd';
import { KeyOutlined, CalendarOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { APP_NAME, COLORS } from '../../constants';
import { BrandLogo } from './BrandLogo';

const { Text } = Typography;

interface RenewLicenseModalProps {
  open: boolean;
  licenseKey: string;
  loading?: boolean;
  currentExpiry?: string | null;
  isDarkMode?: boolean;
  onKeyChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
}

function formatExpiry(value?: string | null) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return null;
  }
}

/** Polished renew-license dialog — navy glass card matching app chrome. */
export function RenewLicenseModal({
  open,
  licenseKey,
  loading = false,
  currentExpiry,
  isDarkMode = true,
  onKeyChange,
  onCancel,
  onSubmit,
}: RenewLicenseModalProps) {
  const expiryLabel = formatExpiry(currentExpiry);
  const border = isDarkMode ? COLORS.APP_BORDER : '#e8e8e8';
  const muted = isDarkMode ? '#9aa8b8' : '#8c8c8c';
  const text = isDarkMode ? '#f0f4f8' : '#1f1f1f';

  const inputWrap: CSSProperties = {
    height: 48,
    borderRadius: 12,
    background: isDarkMode ? 'rgba(8, 16, 28, 0.75)' : '#fafafa',
    border: `1.5px solid ${border}`,
    color: text,
  };

  return (
    <Modal
      open={open}
      onCancel={() => {
        if (!loading) onCancel();
      }}
      footer={null}
      destroyOnClose
      centered
      width={440}
      styles={{
        content: {
          background: isDarkMode ? 'rgba(12, 24, 40, 0.96)' : '#fff',
          border: `1px solid ${border}`,
          borderRadius: 20,
          boxShadow: isDarkMode
            ? '0 0 0 1px rgba(255,255,255,0.16), 0 24px 60px rgba(0,0,0,0.5)'
            : '0 16px 40px rgba(0,0,0,0.12)',
          padding: 0,
          overflow: 'hidden',
        },
        mask: {
          backdropFilter: 'blur(6px)',
        },
      }}
      closeIcon={
        <span style={{ color: muted, fontSize: 16, lineHeight: 1 }}>×</span>
      }
    >
      <div style={{ padding: '28px 28px 24px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 22,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDarkMode ? COLORS.APP_BG_ELEVATED : 'rgba(255,255,255,0.12)',
              border: `1px solid ${border}`,
              overflow: 'hidden',
            }}
          >
            <BrandLogo
              isDarkMode={isDarkMode}
              size={36}
              style={{ borderRadius: 8 }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: text,
                letterSpacing: '-0.02em',
              }}
            >
              Renew license
            </div>
            <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>
              Extend your {APP_NAME} access
            </div>
          </div>
        </div>

        {expiryLabel && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 12,
              marginBottom: 18,
              background: isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.12)',
              border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.28)'}`,
            }}
          >
            <CalendarOutlined style={{ color: COLORS.PRIMARY }} />
            <div>
              <div style={{ fontSize: 11, color: muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Current expiry
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: text }}>{expiryLabel}</div>
            </div>
          </div>
        )}

        <div style={{ marginBottom: 8 }}>
          <Text style={{ color: muted, fontSize: 13, fontWeight: 500 }}>
            <KeyOutlined style={{ marginRight: 6 }} />
            New license key
          </Text>
        </div>
        <Input
          size="large"
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={licenseKey}
          onChange={(e) => onKeyChange(e.target.value)}
          disabled={loading}
          onPressEnter={onSubmit}
          prefix={<SafetyCertificateOutlined style={{ color: muted }} />}
          style={inputWrap}
        />

        <div
          style={{
            display: 'flex',
            gap: 10,
            marginTop: 24,
          }}
        >
          <Button
            size="large"
            onClick={onCancel}
            disabled={loading}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 999,
              borderColor: border,
              color: muted,
              background: 'transparent',
            }}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            size="large"
            loading={loading}
            onClick={onSubmit}
            style={{
              flex: 1.4,
              height: 44,
              borderRadius: 999,
              border: 'none',
              fontWeight: 600,
              background:
                'linear-gradient(135deg, #ffffff 0%, #ffffff 55%, #b0b0b0 100%)',
              boxShadow: '0 8px 22px rgba(255,255,255,0.16)',
            }}
          >
            Renew now
          </Button>
        </div>
      </div>
    </Modal>
  );
}
