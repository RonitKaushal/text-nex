import { useEffect, useState, type ReactNode } from 'react';
import {
  Modal,
  Input,
  Button,
  Typography,
  Form,
  Tag,
  Flex,
  theme,
} from 'antd';
import {
  AppstoreOutlined,
  PlusOutlined,
  UserOutlined,
  SolutionOutlined,
  TeamOutlined,
  HomeOutlined,
  ProjectOutlined,
  BankOutlined,
} from '@ant-design/icons';
import { COLORS } from '../constants';

const { Text, Paragraph } = Typography;

interface WorkspaceCreatorProps {
  visible: boolean;
  onClose: () => void;
  onCreateWorkspace: (name: string) => void;
  isDarkMode: boolean;
  /** Prefill from voice ("create workspace Sales" / next utterance after "create workspace") */
  initialName?: string;
}

const SUGGESTIONS: { name: string; icon: ReactNode }[] = [
  { name: 'Personal', icon: <UserOutlined /> },
  { name: 'Work', icon: <SolutionOutlined /> },
  { name: 'Family', icon: <HomeOutlined /> },
  { name: 'Business', icon: <BankOutlined /> },
  { name: 'Team', icon: <TeamOutlined /> },
  { name: 'Projects', icon: <ProjectOutlined /> },
];

export default function WorkspaceCreator({
  visible,
  onClose,
  onCreateWorkspace,
  isDarkMode,
  initialName = '',
}: WorkspaceCreatorProps) {
  const { token } = theme.useToken();
  const [form] = Form.useForm();
  const [workspaceName, setWorkspaceName] = useState('');

  useEffect(() => {
    if (!visible) return;
    const draft = String(initialName || '').trim();
    form.setFieldsValue({ workspaceName: draft });
    setWorkspaceName(draft);
  }, [visible, initialName, form]);

  const handleClose = () => {
    setWorkspaceName('');
    form.resetFields();
    onClose();
  };

  const handleCreate = async () => {
    try {
      await form.validateFields();
      const name = workspaceName.trim();
      if (!name) return;
      onCreateWorkspace(name);
      handleClose();
    } catch {
      /* validation */
    }
  };

  const applySuggestion = (name: string) => {
    setWorkspaceName(name);
    form.setFieldsValue({ workspaceName: name });
  };

  const modalBg = isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff';
  const border = isDarkMode ? COLORS.APP_BORDER : '#e8e8e8';

  return (
    <Modal
      title={
        <Flex align="center" gap={12}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isDarkMode
                ? 'rgba(139, 124, 246, 0.16)'
                : COLORS.PRIMARY_SOFT,
              color: COLORS.PRIMARY,
              flexShrink: 0,
            }}
          >
            <AppstoreOutlined style={{ fontSize: 18 }} />
          </div>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: '-0.02em',
              color: isDarkMode ? '#fff' : '#141414',
            }}
          >
            Create New Workspace
          </span>
        </Flex>
      }
      open={visible}
      onCancel={handleClose}
      width={520}
      destroyOnClose
      centered
      styles={{
        content: {
          borderRadius: 16,
          border: `1px solid ${border}`,
          background: modalBg,
          padding: 0,
        },
        header: {
          padding: '22px 24px 12px',
          marginBottom: 0,
          background: modalBg,
          borderBottom: `1px solid ${border}`,
        },
        body: {
          padding: '20px 24px 8px',
        },
        footer: {
          padding: '16px 24px 22px',
          marginTop: 0,
          borderTop: `1px solid ${border}`,
          background: modalBg,
        },
      }}
      footer={
        <Flex justify="flex-end" gap={10}>
          <Button
            onClick={handleClose}
            style={{
              height: 40,
              paddingInline: 18,
              borderRadius: 10,
              fontWeight: 500,
            }}
          >
            Cancel
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => void handleCreate()}
            disabled={!workspaceName.trim()}
            style={{
              height: 40,
              paddingInline: 20,
              borderRadius: 10,
              fontWeight: 600,
              border: 'none',
              background: workspaceName.trim()
                ? COLORS.PRIMARY_GRADIENT
                : undefined,
              boxShadow: workspaceName.trim()
                ? '0 4px 14px rgba(139, 124, 246, 0.35)'
                : 'none',
            }}
          >
            Create Workspace
          </Button>
        </Flex>
      }
    >
      <Paragraph
        type="secondary"
        style={{
          marginBottom: 24,
          fontSize: 14,
          lineHeight: 1.55,
          color: isDarkMode ? 'rgba(255,255,255,0.62)' : undefined,
        }}
      >
        Organize messaging accounts into separate workspaces. Each workspace can hold
        multiple services.
      </Paragraph>

      <Form form={form} layout="vertical" onFinish={() => void handleCreate()}>
        <Form.Item
          label={
            <span style={{ fontSize: 14, fontWeight: 600 }}>Workspace name</span>
          }
          name="workspaceName"
          style={{ marginBottom: 24 }}
          rules={[
            { required: true, message: 'Please enter a workspace name' },
            { max: 50, message: 'Name must be 50 characters or less' },
          ]}
        >
          <Input
            size="large"
            prefix={<AppstoreOutlined style={{ color: token.colorTextQuaternary, fontSize: 16 }} />}
            placeholder="e.g. Personal, Work, Family"
            value={workspaceName}
            onChange={(e) => {
              setWorkspaceName(e.target.value);
              form.setFieldsValue({ workspaceName: e.target.value });
            }}
            maxLength={50}
            allowClear
            autoFocus
            style={{
              height: 46,
              borderRadius: 10,
              fontSize: 15,
            }}
          />
        </Form.Item>
      </Form>

      <div style={{ marginBottom: 8 }}>
        <Text
          type="secondary"
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: 0.3,
            display: 'block',
            marginBottom: 12,
            color: isDarkMode ? 'rgba(255,255,255,0.55)' : undefined,
          }}
        >
          Quick suggestions
        </Text>
        <Flex wrap="wrap" gap={10}>
          {SUGGESTIONS.map(({ name, icon }) => {
            const selected = workspaceName === name;
            return (
              <Tag.CheckableTag
                key={name}
                checked={selected}
                onChange={() => applySuggestion(name)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${
                    selected
                      ? isDarkMode
                        ? 'rgba(139, 124, 246, 0.45)'
                        : 'rgba(139, 124, 246, 0.35)'
                      : border
                  }`,
                  background: selected
                    ? isDarkMode
                      ? 'rgba(139, 124, 246, 0.14)'
                      : COLORS.PRIMARY_SOFT
                    : isDarkMode
                      ? 'rgba(255,255,255,0.03)'
                      : '#fafafa',
                  color: selected
                    ? COLORS.PRIMARY
                    : isDarkMode
                      ? 'rgba(255,255,255,0.88)'
                      : '#434343',
                  fontSize: 14,
                  fontWeight: selected ? 600 : 500,
                  lineHeight: 1.2,
                  marginInlineEnd: 0,
                  cursor: 'pointer',
                  transition: 'background 0.18s ease, border-color 0.18s ease, color 0.18s ease',
                }}
              >
                <Flex align="center" gap={8}>
                  <span style={{ fontSize: 15, display: 'flex' }}>{icon}</span>
                  {name}
                </Flex>
              </Tag.CheckableTag>
            );
          })}
        </Flex>
      </div>
    </Modal>
  );
}
