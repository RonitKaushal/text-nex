import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Input,
  Form,
  Button,
  Typography,
  Divider,
  Flex,
  Upload,
  Radio,
  Select,
  message,
} from 'antd';
import {
  CloudServerOutlined,
  UserOutlined,
  KeyOutlined,
  TagOutlined,
  EyeInvisibleOutlined,
  EyeTwoTone,
  UploadOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { SshHostConfig, SshKeychainEntry } from '../types';
import ubuntuLogo from '../assets/brands/ubuntu.svg';
import serverLogo from '../assets/brands/server.svg';
import { fileToDataUrl } from '../utils/imageFile';
import { detectKeyType, loadKeychain } from '../utils/sshKeychain';
import SshKeychainDrawer from './SshKeychainDrawer';

const { Text } = Typography;

export interface HostDetailsModalProps {
  open: boolean;
  isDarkMode?: boolean;
  /** ubuntu | ssh-server */
  serverType: string;
  serverName: string;
  onCancel: () => void;
  onConnect: (label: string, ssh: SshHostConfig, customIcon?: string) => void;
}

const fieldStyle = (dark: boolean): React.CSSProperties => ({
  background: dark ? 'rgba(255,255,255,0.04)' : '#f5f7fa',
  borderColor: dark ? 'rgba(255,255,255,0.12)' : '#d9d9d9',
  color: dark ? '#e8eaed' : undefined,
});

export function HostDetailsModal({
  open,
  isDarkMode = true,
  serverType,
  serverName,
  onCancel,
  onConnect,
}: HostDetailsModalProps) {
  const [form] = Form.useForm();
  const [customIcon, setCustomIcon] = useState<string | undefined>();
  const [authMode, setAuthMode] = useState<'password' | 'key'>('password');
  const [keys, setKeys] = useState<SshKeychainEntry[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string | undefined>();
  const [keychainOpen, setKeychainOpen] = useState(false);

  const isUbuntu = serverType === 'ubuntu';
  const brandColor = isUbuntu ? '#E95420' : '#1a73e8';
  const defaultLogo = isUbuntu ? ubuntuLogo : serverLogo;
  const logo = customIcon || defaultLogo;

  const refreshKeys = async () => {
    setKeys(await loadKeychain());
  };

  useEffect(() => {
    if (!open) return;
    setCustomIcon(undefined);
    setAuthMode('password');
    setSelectedKeyId(undefined);
    setKeychainOpen(false);
    form.setFieldsValue({
      host: '',
      label: `${serverName} Server`,
      port: 22,
      username: isUbuntu ? 'root' : '',
      password: '',
    });
    void refreshKeys();
  }, [open, form, isUbuntu, serverName]);

  const handleConnect = async () => {
    try {
      const values = await form.validateFields();
      const host = String(values.host || '').trim();
      const label =
        String(values.label || '').trim() || `${serverName} ${host}`;
      const username = String(values.username || '').trim();

      const ssh: SshHostConfig = {
        host,
        port: Number(values.port) > 0 ? Number(values.port) : 22,
        username,
      };

      if (authMode === 'key') {
        const entry = keys.find((k) => k.id === selectedKeyId);
        if (!entry?.privateKey) {
          message.error('Select a key from Keychain');
          return;
        }
        ssh.privateKey = entry.privateKey;
        ssh.passphrase = entry.passphrase;
        ssh.keyId = entry.id;
      } else {
        const password = String(values.password || '');
        if (!password) {
          message.error('Enter password or use Keychain');
          return;
        }
        ssh.password = password;
      }

      onConnect(label, ssh, logo);
    } catch {
      /* validation */
    }
  };

  return (
    <>
      <Drawer
        title={`Add ${serverName}`}
        open={open}
        onClose={onCancel}
        width={420}
        destroyOnClose
        styles={{
          body: { paddingTop: 12 },
          header: isDarkMode
            ? { background: 'transparent', borderBottomColor: 'rgba(255,255,255,0.08)' }
            : undefined,
        }}
        footer={
          <Flex justify="flex-end" gap={8}>
            <Button onClick={onCancel}>Cancel</Button>
            <Button
              type="primary"
              onClick={() => void handleConnect()}
              style={{
                background: brandColor,
                borderColor: brandColor,
              }}
            >
              Connect
            </Button>
          </Flex>
        }
      >
        <Flex align="center" gap={16} style={{ marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: isDarkMode ? '#1f1f1f' : `${brandColor}14`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <img
              src={logo}
              alt={serverName}
              style={{
                width: 40,
                height: 40,
                objectFit: 'contain',
                display: 'block',
              }}
            />
          </div>
          <Upload
            accept="image/*"
            showUploadList={false}
            beforeUpload={(file) => {
              void fileToDataUrl(file).then((data) => {
                setCustomIcon(data);
                message.success('Icon updated');
              });
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>Change icon</Button>
          </Upload>
        </Flex>

        <Form form={form} layout="vertical" requiredMark={false}>
          <Form.Item
            name="label"
            label="Service name"
            rules={[{ required: true, message: 'Enter a name' }]}
          >
            <Input
              size="large"
              placeholder="Enter a name"
              maxLength={50}
              prefix={<TagOutlined style={{ color: '#8b949e' }} />}
              style={fieldStyle(isDarkMode)}
            />
          </Form.Item>

          <Form.Item
            name="host"
            label="Address"
            rules={[{ required: true, message: 'Enter IP and host' }]}
          >
            <Input
              size="large"
              placeholder="IP and host"
              style={fieldStyle(isDarkMode)}
            />
          </Form.Item>

          <Divider style={{ margin: '8px 0 16px' }} />

          <Flex align="center" gap={8} style={{ marginBottom: 16 }}>
            <CloudServerOutlined style={{ color: brandColor }} />
            <Text strong>SSH on</Text>
            <Form.Item name="port" noStyle initialValue={22}>
              <Input
                style={{
                  width: 72,
                  textAlign: 'center',
                  ...fieldStyle(isDarkMode),
                }}
              />
            </Form.Item>
            <Text type="secondary">port</Text>
          </Flex>

          <Text
            type="secondary"
            style={{ display: 'block', marginBottom: 8, fontSize: 12, letterSpacing: 0.4 }}
          >
            CREDENTIALS
          </Text>

          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Enter username' }]}
            style={{ marginBottom: 12 }}
          >
            <Input
              size="large"
              placeholder="Username"
              prefix={<UserOutlined style={{ color: '#8b949e' }} />}
              style={fieldStyle(isDarkMode)}
            />
          </Form.Item>

          <Radio.Group
            value={authMode}
            onChange={(e) => setAuthMode(e.target.value)}
            style={{ marginBottom: 12 }}
            optionType="button"
            buttonStyle="solid"
            size="small"
            options={[
              { label: 'Password', value: 'password' },
              { label: 'Keychain', value: 'key' },
            ]}
          />

          {authMode === 'password' ? (
            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Enter password' }]}
              style={{ marginBottom: 8 }}
            >
              <Input.Password
                size="large"
                placeholder="Password"
                prefix={<KeyOutlined style={{ color: '#8b949e' }} />}
                iconRender={(visible) =>
                  visible ? <EyeTwoTone /> : <EyeInvisibleOutlined />
                }
                style={fieldStyle(isDarkMode)}
              />
            </Form.Item>
          ) : (
            <div style={{ marginBottom: 8 }}>
              <Select
                size="large"
                placeholder="Select key from Keychain"
                value={selectedKeyId}
                onChange={setSelectedKeyId}
                style={{ width: '100%', marginBottom: 8 }}
                options={keys.map((k) => ({
                  value: k.id,
                  label: `${k.label} (${detectKeyType(k.privateKey)})`,
                }))}
                notFoundContent="No keys — open Keychain to add one"
              />
              {selectedKeyId ? (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Using saved private key for SSH auth
                </Text>
              ) : null}
            </div>
          )}

          <Button
            type="dashed"
            block
            icon={<PlusOutlined />}
            onClick={() => setKeychainOpen(true)}
            style={{ marginTop: 8, marginBottom: 8 }}
          >
            + SSH ID, Key, Certificate (Keychain)
          </Button>

          <Text type="secondary" style={{ fontSize: 12 }}>
            Connects over SSH — terminal opens after connect.
          </Text>
        </Form>
      </Drawer>

      <SshKeychainDrawer
        open={keychainOpen}
        isDarkMode={isDarkMode}
        selectMode
        onClose={() => {
          setKeychainOpen(false);
          void refreshKeys();
        }}
        onSelectKey={(entry) => {
          setAuthMode('key');
          setSelectedKeyId(entry.id);
          setKeychainOpen(false);
          void refreshKeys();
          message.success(`Using key: ${entry.label}`);
        }}
      />
    </>
  );
}

export default HostDetailsModal;
