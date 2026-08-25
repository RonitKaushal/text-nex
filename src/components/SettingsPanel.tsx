import { useEffect, useState } from 'react';
import {
  Switch,
  Typography,
  Space,
  Button,
  message,
  Radio,
  Modal,
} from 'antd';
import {
  BellOutlined,
  MoonOutlined,
  SunOutlined,
  DeleteOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import { BrandLogo } from './common';
import { APP_VERSION, COLORS, FONT_FAMILY } from '../constants';

const { Title, Text } = Typography;

export interface SettingsPanelProps {
  isDarkMode: boolean;
  onToggleTheme: () => void;
  notificationsEnabled: boolean;
  onToggleNotifications: (enabled: boolean) => void;
  notificationsAfterClose: boolean;
  onToggleNotificationsAfterClose: (enabled: boolean) => void;
  onClearAllData: () => void;
}

export default function SettingsPanel({
  isDarkMode,
  onToggleTheme,
  notificationsEnabled,
  onToggleNotifications,
  notificationsAfterClose,
  onToggleNotificationsAfterClose,
  onClearAllData,
}: SettingsPanelProps) {
  const [localNotifications, setLocalNotifications] = useState(notificationsEnabled);
  const [localAfterClose, setLocalAfterClose] = useState(notificationsAfterClose);

  useEffect(() => {
    setLocalNotifications(notificationsEnabled);
    setLocalAfterClose(notificationsAfterClose);
  }, [notificationsEnabled, notificationsAfterClose]);

  const handleNotificationToggle = (checked: boolean) => {
    setLocalNotifications(checked);
    onToggleNotifications(checked);
    message.success(checked ? 'Notifications enabled' : 'Notifications disabled');
  };

  const handleAfterCloseChange = (value: boolean) => {
    setLocalAfterClose(value);
    onToggleNotificationsAfterClose(value);
    message.success(
      value
        ? 'Notifications will continue after closing the window'
        : 'App will quit on close — no background notifications'
    );
  };

  const handleClearStorage = () => {
    Modal.confirm({
      title: 'Clear Storage',
      content:
        'This clears local app data (workspaces, settings, saved preferences). Service login sessions in webviews may remain until you clear them separately. This cannot be undone.',
      okText: 'Clear Storage',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => {
        onClearAllData();
        message.success('Storage cleared');
      },
    });
  };

  const textColor = isDarkMode ? '#fff' : undefined;
  const muted = isDarkMode ? 'rgba(255,255,255,0.55)' : undefined;
  const border = isDarkMode ? COLORS.APP_BORDER : '#f0f0f0';
  const sectionBg = isDarkMode ? COLORS.APP_BG_PANEL : '#fafafa';

  const switchStyle = {
    background: isDarkMode ? 'rgba(255,255,255,0.12)' : undefined,
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div
        style={{
          marginBottom: 24,
          padding: '16px 18px',
          borderRadius: 12,
          background: sectionBg,
          border: `1px solid ${border}`,
        }}
      >
        <Title level={5} style={{ color: textColor, marginBottom: 12 }}>
          Appearance
        </Title>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 0',
          }}
        >
          <Space>
            {isDarkMode ? <MoonOutlined /> : <SunOutlined />}
            <Text style={{ color: textColor }}>Dark Mode</Text>
          </Space>
          <Switch
            checked={isDarkMode}
            onChange={onToggleTheme}
            checkedChildren="Dark"
            unCheckedChildren="Light"
            style={switchStyle}
          />
        </div>
      </div>

      <div
        style={{
          marginBottom: 24,
          padding: '16px 18px',
          borderRadius: 12,
          background: sectionBg,
          border: `1px solid ${border}`,
        }}
      >
        <Title level={5} style={{ color: textColor, marginBottom: 12 }}>
          Notifications
        </Title>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '4px 0 12px',
          }}
        >
          <Space align="start">
            <BellOutlined style={{ color: textColor, marginTop: 4 }} />
            <div>
              <Text style={{ color: textColor }}>Enable Notifications</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12, color: muted }}>
                WhatsApp, Instagram, Messenger, Telegram, and other message apps
              </Text>
            </div>
          </Space>
          <Switch
            checked={localNotifications}
            onChange={handleNotificationToggle}
            style={switchStyle}
          />
        </div>

        <div
          style={{
            padding: '14px 16px',
            borderRadius: 10,
            background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff',
            border: `1px solid ${border}`,
            opacity: localNotifications ? 1 : 0.45,
            pointerEvents: localNotifications ? 'auto' : 'none',
          }}
        >
          <Space align="start" style={{ marginBottom: 10 }}>
            <DesktopOutlined style={{ color: textColor, marginTop: 3 }} />
            <div>
              <Text strong style={{ color: textColor }}>
                When you close the app
              </Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12, color: muted }}>
                Choose whether message alerts continue in the background
              </Text>
            </div>
          </Space>
          <Radio.Group
            value={localAfterClose}
            onChange={(e) => handleAfterCloseChange(!!e.target.value)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              width: '100%',
              fontFamily: FONT_FAMILY,
            }}
          >
            <Radio value={true} style={{ color: textColor, whiteSpace: 'normal' }}>
              <div>
                <Text style={{ color: textColor }}>Keep notifying after close</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12, color: muted }}>
                  Window hides to tray; messaging apps can still alert you
                </Text>
              </div>
            </Radio>
            <Radio value={false} style={{ color: textColor, whiteSpace: 'normal' }}>
              <div>
                <Text style={{ color: textColor }}>Stop notifications after close</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12, color: muted }}>
                  Closing the window fully quits the app — no more alerts
                </Text>
              </div>
            </Radio>
          </Radio.Group>
        </div>
      </div>

      <div
        style={{
          marginBottom: 24,
          padding: '16px 18px',
          borderRadius: 12,
          background: sectionBg,
          border: `1px solid ${border}`,
        }}
      >
        <Title level={5} style={{ color: textColor, marginBottom: 12 }}>
          Storage
        </Title>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div>
            <Text style={{ color: textColor }}>Clear Storage</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12, color: muted }}>
              Remove workspaces, preferences, and local app data
            </Text>
          </div>
          <Button danger icon={<DeleteOutlined />} onClick={handleClearStorage}>
            Clear
          </Button>
        </div>
      </div>

      <div
        style={{
          padding: '16px 18px',
          borderRadius: 12,
          background: sectionBg,
          border: `1px solid ${border}`,
        }}
      >
        <Title level={5} style={{ color: textColor, marginBottom: 12 }}>
          About
        </Title>
        <Space align="start" size="middle">
          <BrandLogo
            isDarkMode={isDarkMode}
            size={48}
            style={{ borderRadius: 12 }}
          />
          <Space direction="vertical" size={0}>
              <Text strong style={{ color: textColor }}>
                TextNexus v{APP_VERSION}
              </Text>
            <Text type="secondary" style={{ fontSize: 12, color: muted }}>
              Multi-Account Messaging Application
            </Text>
          </Space>
        </Space>
      </div>
    </div>
  );
}
