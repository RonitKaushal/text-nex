import React, { useEffect, useState } from 'react';
import { Modal, Input, Form, Button, Space, Typography, theme } from 'antd';
import { LockOutlined, UnlockOutlined, KeyOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface LockServiceModalProps {
  visible: boolean;
  serviceName: string;
  isLocked: boolean;
  /** access = open for this visit; remove = permanently clear lock */
  mode?: 'access' | 'remove';
  onCancel: () => void;
  onConfirm: (password: string) => void;
}

const LockServiceModal: React.FC<LockServiceModalProps> = ({
  visible,
  serviceName,
  isLocked,
  mode = 'access',
  onCancel,
  onConfirm,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { token } = theme.useToken();

  const isRemoveLock = isLocked && mode === 'remove';
  const titleText = !isLocked
    ? 'Lock Service'
    : isRemoveLock
      ? 'Remove Lock'
      : 'Enter Password';
  const confirmText = !isLocked ? 'Lock' : isRemoveLock ? 'Remove Lock' : 'Open';
  const accent = !isLocked ? token.colorPrimary : isRemoveLock ? '#52c41a' : token.colorPrimary;

  useEffect(() => {
    if (visible) {
      form.resetFields();
      setLoading(false);
    }
  }, [visible, form]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      onConfirm(values.password);
      form.resetFields();
    } catch {
      /* validation errors shown by Form */
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setLoading(false);
    onCancel();
  };

  const subtitle = !isLocked
    ? 'Set a password. You will enter it every time you open this service.'
    : isRemoveLock
      ? 'Enter your password to permanently remove the lock.'
      : 'Enter your password to open this service.';

  const inputStyle: React.CSSProperties = {
    borderRadius: 10,
    height: 48,
    fontSize: 15,
  };

  return (
    <Modal
      title={
        <Space size={8}>
          {isLocked ? <UnlockOutlined /> : <LockOutlined />}
          <span>{titleText}</span>
        </Space>
      }
      open={visible}
      onCancel={handleCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={handleCancel} size="large" style={{ borderRadius: 8, minWidth: 96 }}>
            Cancel
          </Button>
          <Button
            type="primary"
            loading={loading}
            onClick={() => void handleSubmit()}
            icon={isLocked ? <UnlockOutlined /> : <LockOutlined />}
            size="large"
            style={{
              borderRadius: 8,
              minWidth: 110,
              background: accent,
              borderColor: accent,
            }}
          >
            {confirmText}
          </Button>
        </div>
      }
      width={400}
      centered
      destroyOnClose
      maskClosable={false}
      keyboard={false}
      styles={{
        body: { paddingTop: 8, paddingBottom: 8 },
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div
          style={{
            width: 72,
            height: 72,
            margin: '0 auto 14px',
            borderRadius: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${accent}18`,
            border: `1px solid ${accent}40`,
          }}
        >
          {isLocked ? (
            <LockOutlined style={{ fontSize: 32, color: accent }} />
          ) : (
            <UnlockOutlined style={{ fontSize: 32, color: accent }} />
          )}
        </div>
        <Title level={5} style={{ margin: '0 0 6px', color: token.colorText }}>
          {serviceName}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {subtitle}
        </Text>
      </div>

      <Form form={form} layout="vertical" onFinish={() => void handleSubmit()} requiredMark={false}>
        <Form.Item
          name="password"
          label={
            <Space size={6}>
              <KeyOutlined style={{ color: token.colorTextSecondary }} />
              <span>{isLocked ? 'Password' : 'Create Password'}</span>
            </Space>
          }
          rules={[
            { required: true, message: 'Please enter a password' },
            { min: 4, message: 'At least 4 characters' },
            { max: 20, message: 'Maximum 20 characters' },
          ]}
          style={{ marginBottom: isLocked ? 8 : 16 }}
        >
          <Input.Password
            placeholder={isLocked ? 'Enter password' : 'Create password'}
            prefix={<LockOutlined style={{ color: token.colorTextQuaternary }} />}
            size="large"
            autoFocus
            style={inputStyle}
            onPressEnter={() => void handleSubmit()}
          />
        </Form.Item>

        {!isLocked && (
          <Form.Item
            name="confirmPassword"
            label={
              <Space size={6}>
                <KeyOutlined style={{ color: token.colorTextSecondary }} />
                <span>Confirm Password</span>
              </Space>
            }
            dependencies={['password']}
            rules={[
              { required: true, message: 'Please confirm password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
            style={{ marginBottom: 8 }}
          >
            <Input.Password
              placeholder="Re-enter password"
              prefix={<LockOutlined style={{ color: token.colorTextQuaternary }} />}
              size="large"
              style={inputStyle}
              onPressEnter={() => void handleSubmit()}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};

export default LockServiceModal;
