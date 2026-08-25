import { useEffect, useState, type CSSProperties } from 'react';
import { Button, Space, Typography } from 'antd';
import {
  CloseOutlined,
  PlusOutlined,
  GlobalOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import { APP_TOP_BAR_HEIGHT, APP_SIDEBAR_BG, COLORS } from '../../constants';
import { getFaviconFromUrl } from '../../utils/serviceConfig';
import type { BrowserTabItem } from '../../types/browserTab';
import type { ServiceTab } from '../../types';
import { ServiceLogo } from './ServiceLogo';

const { Text } = Typography;

interface BrowserTabsSheetProps {
  open: boolean;
  tabs: BrowserTabItem[];
  activeTabId: string;
  activeService?: ServiceTab | null;
  isDarkMode?: boolean;
  onClose: () => void;
  onSelect: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  /** Hide / disable add when at max tabs */
  canAddTab?: boolean;
}

function TabFavicon({
  tab,
  activeService,
  size = 16,
}: {
  tab: BrowserTabItem;
  activeService?: ServiceTab | null;
  size?: number;
}) {
  // Always show the service brand icon for every tab (home + extra pages)
  if (activeService) {
    return (
      <span style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size }}>
        <ServiceLogo
          iconType={activeService.iconType}
          customIcon={activeService.customIcon}
          url={activeService.url || tab.url}
          size={size}
        />
      </span>
    );
  }

  const favicon = getFaviconFromUrl(tab.url, 64);
  if (favicon) {
    return (
      <span style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size }}>
        <img
          src={favicon}
          alt=""
          width={size}
          height={size}
          style={{ borderRadius: 3, objectFit: 'contain', display: 'block' }}
        />
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', flexShrink: 0, width: size, height: size }}>
      <GlobalOutlined style={{ fontSize: size }} />
    </span>
  );
}

/** Opens under the title bar — workspace-style switcher for in-app browser tabs. */
export function BrowserTabsSheet({
  open,
  tabs,
  activeTabId,
  activeService,
  isDarkMode = true,
  onClose,
  onSelect,
  onCloseTab,
  onNewTab,
  canAddTab = true,
}: BrowserTabsSheetProps) {
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
            <CopyOutlined />
            Switch tabs
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
            {tabs.map((tab) => {
              const active = tab.id === activeTabId;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    onSelect(tab.id);
                    onClose();
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    height: 36,
                    padding: '0 8px 0 12px',
                    borderRadius: 8,
                    border: `1.5px solid ${active ? COLORS.PRIMARY : border}`,
                    background: active
                      ? isDarkMode
                        ? 'rgba(139, 124, 246, 0.12)'
                        : '#f0edff'
                      : isDarkMode
                        ? COLORS.APP_BG_ELEVATED
                        : '#fafafa',
                    color: text,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    maxWidth: 220,
                    minWidth: 0,
                  }}
                >
                  <TabFavicon tab={tab} activeService={activeService} size={18} />
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                    }}
                    title={tab.title}
                  >
                    {tab.title || 'New Tab'}
                  </span>
                  {tabs.length > 1 && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCloseTab(tab.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          onCloseTab(tab.id);
                        }
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        color: muted,
                        flexShrink: 0,
                      }}
                    >
                      <CloseOutlined style={{ fontSize: 10 }} />
                    </span>
                  )}
                </button>
              );
            })}

            {canAddTab && (
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                onNewTab();
                onClose();
              }}
              style={{
                height: 36,
                borderColor: border,
                color: muted,
              }}
            >
              New Tab
            </Button>
            )}
          </div>

          <Space size={4}>
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
