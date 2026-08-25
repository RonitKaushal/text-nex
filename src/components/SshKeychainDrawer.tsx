import React, { useEffect, useState } from 'react';
import {
  Drawer,
  Input,
  Button,
  Typography,
  Flex,
  Upload,
  Empty,
  Popconfirm,
  message,
} from 'antd';
import {
  KeyOutlined,
  DeleteOutlined,
  PlusOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import type { SshKeychainEntry } from '../types';
import { COLORS } from '../constants';
import {
  detectKeyType,
  loadKeychain,
  removeKeychainEntry,
  upsertKeychainEntry,
} from '../utils/sshKeychain';

const { Text, Title } = Typography;
const { TextArea } = Input;

interface SshKeychainDrawerProps {
  open: boolean;
  isDarkMode?: boolean;
  /** When picking a key for connect */
  selectMode?: boolean;
  onClose: () => void;
  onSelectKey?: (entry: SshKeychainEntry) => void;
}

export function SshKeychainDrawer({
  open,
  isDarkMode = true,
  selectMode = false,
  onClose,
  onSelectKey,
}: SshKeychainDrawerProps) {
  const [keys, setKeys] = useState<SshKeychainEntry[]>([]);
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [editId, setEditId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setKeys(await loadKeychain());
  };

  useEffect(() => {
    if (open) void refresh();
  }, [open]);

  const resetForm = () => {
    setEditing(false);
    setEditId(undefined);
    setLabel('');
    setPrivateKey('');
    setPublicKey('');
    setPassphrase('');
  };

  const openNew = () => {
    resetForm();
    setEditing(true);
  };

  const openEdit = (entry: SshKeychainEntry) => {
    setEditId(entry.id);
    setLabel(entry.label);
    setPrivateKey(entry.privateKey);
    setPublicKey(entry.publicKey || '');
    setPassphrase(entry.passphrase || '');
    setEditing(true);
  };

  const importKeyFile = async (file: File) => {
    try {
      const text = await file.text();
      if (!/PRIVATE KEY/i.test(text) && !text.includes('-----BEGIN')) {
        message.warning('This does not look like a private key file');
      }
      setPrivateKey(text);
      if (!label.trim()) {
        setLabel(file.name.replace(/\.(pem|key|ppk)$/i, '') || 'Imported key');
      }
      setEditing(true);
      message.success('Private key imported');
    } catch {
      message.error('Could not read key file');
    }
    return false;
  };

  const handleSave = async () => {
    if (!privateKey.trim()) {
      message.error('Private key is required');
      return;
    }
    setSaving(true);
    try {
      const next = await upsertKeychainEntry({
        id: editId,
        label: label.trim() || 'Untitled key',
        privateKey: privateKey.trim(),
        publicKey: publicKey.trim() || undefined,
        passphrase: passphrase || undefined,
      });
      setKeys(next);
      message.success(editId ? 'Key updated' : 'Key saved to Keychain');
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setKeys(await removeKeychainEntry(id));
    if (editId === id) resetForm();
    message.success('Key removed');
  };

  const panelBg = isDarkMode ? COLORS.APP_BG_GLOW : '#fff';
  const cardBg = isDarkMode ? 'rgba(255,255,255,0.04)' : '#f5f7fa';
  const border = isDarkMode ? 'rgba(255,255,255,0.1)' : '#d9d9d9';

  return (
    <Drawer
      title="Keychain"
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      width={520}
      destroyOnClose
      styles={{
        body: { padding: 0, display: 'flex', height: '100%' },
        header: isDarkMode
          ? { background: 'transparent', borderBottomColor: border }
          : undefined,
      }}
    >
      <div style={{ display: 'flex', width: '100%', minHeight: 0, flex: 1 }}>
        {/* Keys list */}
        <div
          style={{
            width: editing ? '42%' : '100%',
            borderRight: editing ? `1px solid ${border}` : undefined,
            padding: 16,
            overflow: 'auto',
            background: panelBg,
          }}
        >
          <Flex justify="space-between" align="center" style={{ marginBottom: 14 }}>
            <Title level={5} style={{ margin: 0, color: isDarkMode ? '#fff' : undefined }}>
              Keys
            </Title>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openNew}>
              Add
            </Button>
          </Flex>

          {keys.length === 0 && !editing ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No keys yet"
              style={{ marginTop: 48 }}
            >
              <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
                Add key
              </Button>
            </Empty>
          ) : (
            <Flex vertical gap={8}>
              {keys.map((k) => {
                const active = editId === k.id;
                return (
                  <div
                    key={k.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      if (selectMode && onSelectKey) {
                        onSelectKey(k);
                        return;
                      }
                      openEdit(k);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (selectMode && onSelectKey) onSelectKey(k);
                        else openEdit(k);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '12px 14px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      background: active ? 'rgba(26,115,232,0.12)' : cardBg,
                      border: active
                        ? '1px solid #1a73e8'
                        : `1px solid ${border}`,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        background: '#1a73e8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <KeyOutlined style={{ color: '#fff' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        strong
                        style={{
                          display: 'block',
                          color: isDarkMode ? '#fff' : undefined,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {k.label || 'Add a label…'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {detectKeyType(k.privateKey)}
                      </Text>
                    </div>
                    {selectMode ? (
                      <Button
                        type="link"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectKey?.(k);
                        }}
                      >
                        Use
                      </Button>
                    ) : (
                      <Popconfirm
                        title="Delete this key?"
                        onConfirm={(e) => {
                          e?.stopPropagation();
                          void handleDelete(k.id);
                        }}
                        onCancel={(e) => e?.stopPropagation()}
                      >
                        <Button
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </Popconfirm>
                    )}
                  </div>
                );
              })}
            </Flex>
          )}
        </div>

        {/* Add / edit panel */}
        {editing && (
          <div
            style={{
              flex: 1,
              padding: 16,
              overflow: 'auto',
              background: isDarkMode ? '#0a1020' : '#fafafa',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <Text type="secondary" style={{ fontSize: 12 }}>
              {editId ? 'Edit key' : 'New key'}
            </Text>
            <div>
              <Text style={{ fontSize: 12, color: isDarkMode ? '#9aa4b2' : undefined }}>
                Label
              </Text>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Add a label…"
                style={{ marginTop: 4 }}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12, color: isDarkMode ? '#9aa4b2' : undefined }}>
                Private key *
              </Text>
              <TextArea
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={8}
                style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12, color: isDarkMode ? '#9aa4b2' : undefined }}>
                Public key
              </Text>
              <Input
                value={publicKey}
                onChange={(e) => setPublicKey(e.target.value)}
                placeholder="Optional"
                style={{ marginTop: 4, fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div>
              <Text style={{ fontSize: 12, color: isDarkMode ? '#9aa4b2' : undefined }}>
                Passphrase
              </Text>
              <Input.Password
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Optional"
                style={{ marginTop: 4 }}
              />
            </div>

            <Upload.Dragger
              accept=".pem,.key,.ppk,.pub,text/*"
              showUploadList={false}
              beforeUpload={(file) => {
                void importKeyFile(file);
                return false;
              }}
              style={{
                background: cardBg,
                borderColor: border,
                borderStyle: 'dashed',
              }}
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined style={{ color: '#1a73e8' }} />
              </p>
              <p style={{ color: isDarkMode ? '#c8d0d8' : undefined, margin: 0 }}>
                Drag and drop a private key file to import
              </p>
            </Upload.Dragger>

            <Flex gap={8} style={{ marginTop: 'auto', paddingTop: 12 }}>
              <Button onClick={resetForm} block>
                Cancel
              </Button>
              <Button type="primary" loading={saving} onClick={() => void handleSave()} block>
                {editId ? 'Save key' : 'Import from key file'}
              </Button>
            </Flex>
          </div>
        )}
      </div>
    </Drawer>
  );
}

export default SshKeychainDrawer;
