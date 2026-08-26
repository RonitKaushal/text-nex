import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import {
  Typography,
  Space,
  Tag,
  Button,
  Spin,
  Row,
  Col,
  Descriptions,
  Divider,
  Alert,
  theme,
  message,
  Popover,
  Progress,
  Tooltip,
  Modal,
} from 'antd';
import {
  UserOutlined,
  PhoneOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  CalendarOutlined,
  DesktopOutlined,
  KeyOutlined,
  SettingOutlined,
  BookOutlined,
  CloudDownloadOutlined,
  InfoCircleOutlined,
  CloudSyncOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useAppUpdate } from '../context/AppUpdateContext';
import type { LicenseInfo, UserProfile } from '../types';
import { isLicenseExpired } from '../utils/licenseStatus';
import { getStoredUsername } from '../utils/username';
import { APP_TOP_BAR_HEIGHT, APP_BG_GRADIENT, COLORS } from '../constants';
import { BrandLogo, RenewLicenseModal } from '../components/common';
import SettingsPanel from '../components/SettingsPanel';
import KeyboardShortcutsGuide from '../components/KeyboardShortcutsGuide';

const { Title, Text } = Typography;

export type AccountSection = 'profile' | 'settings' | 'guide';

interface ProfilePageProps {
  isDarkMode?: boolean;
  section?: AccountSection;
  onSectionChange?: (section: AccountSection) => void;
  onToggleTheme?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: (enabled: boolean) => void;
  notificationsAfterClose?: boolean;
  onToggleNotificationsAfterClose?: (enabled: boolean) => void;
  onClearAllData?: () => void;
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function daysLeft(expireAt?: string) {
  if (!expireAt) return 0;
  const diff = new Date(expireAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function LicenseCard({
  license,
  isActive,
  isDarkMode,
}: {
  license: LicenseInfo;
  isActive?: boolean;
  isDarkMode?: boolean;
}) {
  const expired = license.isExpired || license.status === 'expired';
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 10,
        border: `1px solid ${
          isActive ? '#ffffff' : isDarkMode ? COLORS.APP_BORDER : '#f0f0f0'
        }`,
        background: isActive
          ? isDarkMode
            ? '#1a1a1a'
            : 'rgba(255,255,255,0.12)'
          : isDarkMode
            ? COLORS.APP_BG_PANEL
            : '#fafafa',
        marginBottom: 10,
      }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between' }} wrap>
        <Space>
          <KeyOutlined />
          <Text code copyable={{ text: license.key }} style={{ fontSize: 13 }}>
            {license.key}
          </Text>
        </Space>
        <Space>
          {isActive && <Tag color="default">Current</Tag>}
          <Tag color={expired ? 'error' : 'success'}>
            {expired ? 'Expired' : license.status}
          </Tag>
          <Tag>{license.type}</Tag>
        </Space>
      </Space>
      <Row gutter={16} style={{ marginTop: 10 }}>
        <Col span={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Activated
          </Text>
          <div style={{ fontSize: 13 }}>{formatDate(license.activateAt)}</div>
        </Col>
        <Col span={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Expires
          </Text>
          <div style={{ fontSize: 13 }}>{formatDate(license.expireAt)}</div>
        </Col>
        <Col span={8}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Days left
          </Text>
          <div style={{ fontSize: 13, fontWeight: 600 }}>
            {expired ? 0 : daysLeft(license.expireAt)} / {license.valid}
          </div>
        </Col>
      </Row>
    </div>
  );
}

/** Account hub: Profile + Settings with a left side navbar. */
export default function Profile({
  isDarkMode = false,
  section: controlledSection,
  onSectionChange,
  onToggleTheme,
  notificationsEnabled = true,
  onToggleNotifications,
  notificationsAfterClose = true,
  onToggleNotificationsAfterClose,
  onClearAllData,
}: ProfilePageProps) {
  const { token } = theme.useToken();
  const { userProfile, refreshProfile, renewLicense, logout } = useAuth();
  const {
    checking: checkingUpdate,
    downloading,
    updateAvailable,
    currentVersion,
    latestVersion,
    release,
    progress,
    checkForUpdate,
    downloadUpdate,
  } = useAppUpdate();
  const [loading, setLoading] = useState(!userProfile);
  const [profile, setProfile] = useState<UserProfile | null>(userProfile);
  const [error, setError] = useState<string | null>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [renewKey, setRenewKey] = useState('');
  const [renewLoading, setRenewLoading] = useState(false);
  const [localSection, setLocalSection] = useState<AccountSection>('profile');

  const section = controlledSection ?? localSection;
  const setSection = (next: AccountSection) => {
    if (onSectionChange) onSectionChange(next);
    else setLocalSection(next);
  };

  const fetchProfile = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);
      try {
        const user = await refreshProfile(force);
        if (!user || !user.id) {
          throw new Error('Failed to load profile');
        }
        setProfile(user);
      } catch (e: unknown) {
        const err = e as {
          message?: string;
          response?: { status?: number; data?: { message?: string } };
          request?: unknown;
        };
        if (err.response) {
          setError(
            err.response.data?.message ||
              `Server error (${err.response.status ?? 'unknown'})`
          );
        } else if (err.request) {
          setError('No response from server. Check your internet connection.');
        } else {
          setError(err.message || 'Failed to load profile');
        }
        if (!userProfile) setProfile(null);
      } finally {
        setLoading(false);
      }
    },
    [refreshProfile, userProfile]
  );

  useEffect(() => {
    if (userProfile) {
      setProfile(userProfile);
      setLoading(false);
      return;
    }
    void fetchProfile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (userProfile) {
      setProfile(userProfile);
    }
  }, [userProfile]);

  const handleRenew = async () => {
    if (!renewKey.trim()) {
      message.error('Please enter a license key');
      return;
    }
    setRenewLoading(true);
    try {
      const result = await renewLicense(renewKey.trim());
      if (result.success) {
        message.success(
          result.licenseExpiry
            ? `License renewed! Expires ${new Date(result.licenseExpiry).toLocaleDateString()}`
            : 'License renewed successfully'
        );
        setRenewOpen(false);
        setRenewKey('');
        await fetchProfile(true);
      } else {
        message.error(result.message || 'Failed to renew license');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      message.error(err.response?.data?.message || err.message || 'Failed to renew');
    } finally {
      setRenewLoading(false);
    }
  };

  const phone = profile?.phone ? String(profile.phone) : '—';
  const storedUsername = getStoredUsername();
  const displayName = storedUsername || (phone !== '—' ? `+${phone}` : 'User');
  const expireAt = profile?.activeLicense?.expireAt;
  const expired = isLicenseExpired(profile);
  const expiryShort = expireAt
    ? new Date(expireAt).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
  const daysRemaining = daysLeft(expireAt);

  const headerBtnBase: CSSProperties = {
    height: 34,
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
  };

  const navBorder = isDarkMode ? COLORS.APP_BORDER : '#d9d9d9';
  const navItems: { id: AccountSection; label: string; icon: ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: <UserOutlined /> },
    { id: 'settings', label: 'Settings', icon: <SettingOutlined /> },
    { id: 'guide', label: 'Guide', icon: <BookOutlined /> },
  ];

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isDarkMode ? APP_BG_GRADIENT : '#fff',
      }}
    >
      <div
        style={{
          height: APP_TOP_BAR_HEIGHT,
          boxSizing: 'border-box',
          padding: '0 20px',
          borderBottom: `1px solid ${navBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexShrink: 0,
          background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fafafa',
        }}
      >
        <Space size={10} wrap>
          {section === 'settings' ? (
            <SettingOutlined style={{ color: isDarkMode ? '#c8cdd3' : undefined }} />
          ) : section === 'guide' ? (
            <BookOutlined style={{ color: isDarkMode ? '#c8cdd3' : undefined }} />
          ) : (
            <UserOutlined style={{ color: isDarkMode ? '#c8cdd3' : undefined }} />
          )}
          <Text strong style={{ fontSize: 16 }}>
            {section === 'settings' ? 'Settings' : section === 'guide' ? 'Guide' : 'Profile'}
          </Text>
          {section === 'profile' && expiryShort && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 12px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 500,
                color: expired ? '#d9d9d9' : isDarkMode ? '#d9d9d9' : '#d9d9d9',
                background: expired
                  ? 'rgba(255,255,255,0.16)'
                  : isDarkMode
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(255,255,255,0.08)',
                border: `1px solid ${
                  expired
                    ? 'rgba(255,255,255,0.16)'
                    : isDarkMode
                      ? 'rgba(255,255,255,0.16)'
                      : '#b7eb8f'
                }`,
              }}
            >
              <CalendarOutlined />
              Expires {expiryShort}
              {!expired && daysRemaining > 0 ? ` · ${daysRemaining}d left` : ''}
            </span>
          )}
        </Space>

        {section === 'profile' && (
          <Space size={8} wrap>
            <Tooltip title="Refresh profile">
              <Button
                icon={<ReloadOutlined />}
                onClick={() => void fetchProfile(true)}
                loading={loading}
                style={{
                  ...headerBtnBase,
                  color: isDarkMode ? '#e8eaed' : '#262626',
                  background: isDarkMode ? COLORS.APP_ICON_BTN : '#fff',
                  border: `1px solid ${navBorder}`,
                }}
              />
            </Tooltip>

            <Popover
              trigger="click"
              placement="bottomRight"
              title={
                release
                  ? release.title || `What's new in v${release.version}`
                  : 'Software update'
              }
              content={
                <div style={{ maxWidth: 320 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Installed: v{currentVersion}
                    {latestVersion ? ` · Latest: v${latestVersion}` : ''}
                  </Text>
                  {updateAvailable && release ? (
                    <ul
                      style={{
                        margin: '10px 0 0',
                        paddingLeft: 18,
                        maxHeight: 220,
                        overflow: 'auto',
                      }}
                    >
                      {(release.changes?.length
                        ? release.changes
                        : release.changelog
                          ? [release.changelog]
                          : ['Bug fixes and improvements']
                      ).map((line, i) => (
                        <li key={i} style={{ marginBottom: 4, fontSize: 13 }}>
                          {line}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div style={{ marginTop: 10, fontSize: 13 }}>
                      You are on the latest version. No update available.
                    </div>
                  )}
                  {downloading && (
                    <div style={{ marginTop: 12 }}>
                      <Progress
                        percent={progress.percent}
                        size="small"
                        status={progress.status === 'error' ? 'exception' : 'active'}
                      />
                    </div>
                  )}
                </div>
              }
            >
              <Button
                type="text"
                icon={
                  <InfoCircleOutlined
                    style={{
                      color: updateAvailable ? '#ffffff' : '#ffffff',
                      fontSize: 16,
                    }}
                  />
                }
                style={{
                  width: 36,
                  height: 36,
                  padding: 0,
                  color: updateAvailable ? '#ffffff' : '#ffffff',
                }}
                aria-label="Update info"
              />
            </Popover>

            <Button
              icon={
                updateAvailable ? <CloudDownloadOutlined /> : <CloudSyncOutlined />
              }
              loading={checkingUpdate || downloading}
              onClick={async () => {
                if (downloading) return;
                if (!updateAvailable) {
                  const result = await checkForUpdate();
                  if (result?.updateAvailable) {
                    message.success(`Update v${result.latestVersion} available`);
                  } else if (result) {
                    message.info('You are up to date');
                  }
                  return;
                }
                await downloadUpdate();
              }}
              style={{
                ...headerBtnBase,
                color: '#111111',
                background: '#ffffff',
                border: '1px solid #d9d9d9',
                fontWeight: 600,
              }}
            >
              {downloading
                ? `Downloading ${progress.percent}%`
                : updateAvailable
                  ? `Update v${latestVersion}`
                  : 'Update'}
            </Button>

            <Button
              icon={<KeyOutlined />}
              onClick={() => setRenewOpen(true)}
              style={{
                ...headerBtnBase,
                color: '#111111',
                background: '#ffffff',
                border: '1px solid #d9d9d9',
                fontWeight: 600,
                paddingInline: 16,
              }}
            >
              Renew License
            </Button>
          </Space>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* Side navbar */}
        <nav
          style={{
            width: 200,
            flexShrink: 0,
            borderRight: `1px solid ${navBorder}`,
            padding: '16px 10px',
            background: isDarkMode ? COLORS.APP_BG_BASE : '#fafafa',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {navItems.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontSize: 14,
                  fontWeight: active ? 600 : 500,
                  color: active
                    ? isDarkMode
                      ? '#fff'
                      : COLORS.PRIMARY
                    : isDarkMode
                      ? '#c8cdd3'
                      : '#595959',
                  background: active
                    ? isDarkMode
                      ? COLORS.APP_BG_ELEVATED
                      : COLORS.PRIMARY_SOFT
                    : 'transparent',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{item.icon}</span>
                {item.label}
              </button>
            );
          })}

          <div style={{ flex: 1, minHeight: 12 }} />

          <button
            type="button"
            onClick={() => {
              Modal.confirm({
                title: 'Log out?',
                content: 'You will need your phone and license key to sign in again.',
                okText: 'Log out',
                okType: 'danger',
                cancelText: 'Cancel',
                centered: true,
                onOk: async () => {
                  await logout();
                  message.success('Logged out');
                },
              });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 14,
              fontWeight: 500,
              color: isDarkMode ? '#f5f5f5' : '#141414',
              background: 'transparent',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkMode
                ? 'rgba(255,255,255,0.08)'
                : 'rgba(0,0,0,0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>
              <LogoutOutlined />
            </span>
            Log out
          </button>
        </nav>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 32px' }}>
          {section === 'settings' ? (
            onToggleTheme &&
            onToggleNotifications &&
            onToggleNotificationsAfterClose &&
            onClearAllData ? (
              <SettingsPanel
                isDarkMode={isDarkMode}
                onToggleTheme={onToggleTheme}
                notificationsEnabled={notificationsEnabled}
                onToggleNotifications={onToggleNotifications}
                notificationsAfterClose={notificationsAfterClose}
                onToggleNotificationsAfterClose={onToggleNotificationsAfterClose}
                onClearAllData={onClearAllData}
              />
            ) : (
              <Alert type="warning" message="Settings are unavailable." />
            )
          ) : section === 'guide' ? (
            <KeyboardShortcutsGuide isDarkMode={isDarkMode} />
          ) : (
            <div style={{ width: '100%', maxWidth: 1100 }}>
              {loading ? (
                <div style={{ textAlign: 'center', padding: 64 }}>
                  <Spin size="large" />
                  <div style={{ marginTop: 12 }}>
                    <Text type="secondary">Loading profile…</Text>
                  </div>
                </div>
              ) : error ? (
                <Alert
                  type="error"
                  showIcon
                  message="Could not load profile"
                  description={error}
                  action={
                    <Button size="small" onClick={() => void fetchProfile(true)}>
                      Retry
                    </Button>
                  }
                />
              ) : profile ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      marginBottom: 24,
                      padding: 20,
                      borderRadius: 12,
                      background: isDarkMode ? COLORS.APP_BG_PANEL : '#f5f5f5',
                      border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#f0f0f0'}`,
                    }}
                  >
                    <BrandLogo
                      isDarkMode={isDarkMode}
                      size={64}
                      style={{ borderRadius: 14 }}
                    />
                    <div style={{ flex: 1 }}>
                      <Title level={3} style={{ margin: 0, color: token.colorText }}>
                        {displayName}
                      </Title>
                      <Space size={8} wrap style={{ marginTop: 8 }}>
                        <Tag
                          color={profile.isActive ? 'success' : 'error'}
                          icon={
                            profile.isActive ? (
                              <CheckCircleOutlined />
                            ) : (
                              <CloseCircleOutlined />
                            )
                          }
                        >
                          {profile.isActive ? 'Active' : 'Inactive'}
                        </Tag>
                        {profile.licenseExpired ? (
                          <Tag color="error">License Expired</Tag>
                        ) : (
                          <Tag color="processing">License OK</Tag>
                        )}
                        {profile.software && <Tag>Software</Tag>}
                        {profile.mobile && <Tag color="purple">Mobile</Tag>}
                      </Space>
                    </div>
                  </div>

                  <Title level={5}>Account</Title>
                  <Descriptions
                    size="small"
                    column={2}
                    bordered
                    labelStyle={{ width: 140 }}
                  >
                    <Descriptions.Item
                      label={
                        <Space>
                          <UserOutlined /> Username
                        </Space>
                      }
                    >
                      {storedUsername || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item
                      label={
                        <Space>
                          <PhoneOutlined /> Phone
                        </Space>
                      }
                    >
                      {phone !== '—' ? `+${phone}` : '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="User ID">
                      <Text code copyable style={{ fontSize: 12 }}>
                        {profile.id}
                      </Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="Created">
                      {formatDate(profile.createdAt)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Updated">
                      {formatDate(profile.updatedAt)}
                    </Descriptions.Item>
                  </Descriptions>

                  <Title level={5} style={{ marginTop: 28 }}>
                    <DesktopOutlined /> Device
                  </Title>
                  <Descriptions size="small" column={2} bordered>
                    <Descriptions.Item label="Type">
                      {profile.device?.deviceType || '—'}
                    </Descriptions.Item>
                    <Descriptions.Item label="Last Active">
                      <Space>
                        <CalendarOutlined />
                        {formatDate(profile.device?.lastActive)}
                      </Space>
                    </Descriptions.Item>
                  </Descriptions>

                  {!!profile.allLicenses?.length && (
                    <>
                      <Divider />
                      <Title level={5} style={{ marginTop: 28 }}>
                        All Licenses ({profile.allLicenses.length})
                      </Title>
                      {profile.allLicenses.map((lic) => (
                        <LicenseCard
                          key={lic.id}
                          license={lic}
                          isActive={lic.id === profile.activeLicense?.id}
                          isDarkMode={isDarkMode}
                        />
                      ))}
                    </>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <RenewLicenseModal
        open={renewOpen}
        licenseKey={renewKey}
        loading={renewLoading}
        currentExpiry={expireAt}
        isDarkMode={isDarkMode}
        onKeyChange={setRenewKey}
        onCancel={() => setRenewOpen(false)}
        onSubmit={() => void handleRenew()}
      />
    </div>
  );
}
