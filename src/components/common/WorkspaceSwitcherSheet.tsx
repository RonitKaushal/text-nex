import { useEffect, useState, type CSSProperties } from 'react';
import { Button, Space, Typography } from 'antd';
import {
  AppstoreOutlined,
  CloseOutlined,
  SettingOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { APP_TOP_BAR_HEIGHT, APP_SIDEBAR_BG, COLORS } from '../../constants';
import type { Workspace } from '../../types';

const { Text } = Typography;

interface WorkspaceSwitcherSheetProps {
  open: boolean;
  workspaces: Workspace[];
  activeWorkspace: string;
  isDarkMode?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onManage: () => void;
  onAdd: () => void;
}

/** Opens under the title bar — same place as the tabs sheet. */
export function WorkspaceSwitcherSheet({
  open,
  workspaces,
  activeWorkspace,
  isDarkMode = true,
  onClose,
  onSelect,
  onManage,
  onAdd,
}: WorkspaceSwitcherSheetProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 280);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  const bg = isDarkMode ? APP_SIDEBAR_BG : '#fff';
  const border = isDarkMode ? COLORS.APP_BORDER : '#d9d9d9';
  const muted = isDarkMode ? '#9aa0a6' : '#8c8c8c';
  const text = isDarkMode ? '#e8eaed' : '#1f1f1f';

  const sheet: CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    top: APP_TOP_BAR_HEIGHT,
    zIndex: 1200,
    background: bg,
    borderBottom: `1px solid ${border}`,
    boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
    padding: '12px 20px 14px',
    transform: visible ? 'translateY(0)' : 'translateY(-12px)',
    opacity: visible ? 1 : 0,
    transition: 'transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.22s ease',
    WebkitAppRegion: 'no-drag',
  } as CSSProperties;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: APP_TOP_BAR_HEIGHT,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1190,
          background: visible ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)',
          transition: 'background 0.28s ease',
          WebkitAppRegion: 'no-drag',
        } as CSSProperties}
      />
      <div style={sheet}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.8,
              color: muted,
              textTransform: 'uppercase',
              flexShrink: 0,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <AppstoreOutlined />
            Switch workspace
          </Text>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              flexWrap: 'wrap',
              minWidth: 0,
            }}
          >
            {workspaces.map((w) => {
              const active = w.id === activeWorkspace;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    onSelect(w.id);
                    onClose();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 36,
                    padding: '0 14px',
                    borderRadius: 8,
                    border: `1.5px solid ${active ? COLORS.PRIMARY : border}`,
                    background: active
                      ? isDarkMode
                        ? 'rgba(255,255,255,0.16)'
                        : 'rgba(255,255,255,0.12)'
                      : isDarkMode
                        ? COLORS.APP_BG_ELEVATED
                        : '#fafafa',
                    color: text,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <AppstoreOutlined style={{ color: active ? COLORS.PRIMARY : muted }} />
                  {w.name}
                </button>
              );
            })}

            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                onAdd();
                onClose();
              }}
              style={{
                height: 36,
                borderColor: border,
                color: muted,
              }}
            >
              New
            </Button>
          </div>

          <Space size={4}>
            <Button
              type="link"
              icon={<SettingOutlined />}
              onClick={() => {
                onManage();
                onClose();
              }}
              style={{ color: COLORS.PRIMARY, paddingInline: 8 }}
            >
              Manage Workspaces
            </Button>
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={onClose}
              style={{ color: muted }}
            />
          </Space>
        </div>
      </div>
    </>
  );
}
