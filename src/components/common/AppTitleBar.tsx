import { useEffect, useState, type CSSProperties } from 'react';
import {
  BellOutlined,
  BellFilled,
  CloseOutlined,
  BorderOutlined,
  MinusOutlined,
  DownOutlined,
  FormOutlined,
  SettingOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  ExportOutlined,
  SplitCellsOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
  CopyOutlined,
  UpOutlined,
  SearchOutlined,
  InboxOutlined,
} from '@ant-design/icons';
import { Button, Space, Tooltip, Typography, Popover, message, Input } from 'antd';
import { ServiceLogo } from './ServiceLogo';
import { WorkspaceSwitcherSheet } from './WorkspaceSwitcherSheet';
import { BrowserTabsSheet } from './BrowserTabsSheet';
import { APP_TOP_BAR_HEIGHT, APP_SIDEBAR_BG, COLORS } from '../../constants';
import { MAX_BROWSER_TABS } from '../../context/ServiceChromeContext';
import {
  SPLIT_LAYOUTS,
  previewStyleForLayout,
  type SplitLayoutId,
} from '../../constants/splitLayouts';
import type { ServiceTab, Workspace } from '../../types';
import type { BrowserTabItem } from '../../types/browserTab';
import { getServiceConfig } from '../../utils/serviceConfig';
import { useInboxOptional } from '../../context/InboxContext';
import { formatBadge } from '../../context/UnreadContext';
import arcticSwitchWordmark from '../../assets/Arctic Switch.png';const { Text } = Typography;

const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties;
const drag: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties;

interface AppTitleBarProps {
  isDarkMode?: boolean;
  workspaces: Workspace[];
  activeWorkspace: string;
  services: ServiceTab[];
  activeTab: string;
  notificationsEnabled: boolean;
  browserTabs: BrowserTabItem[];
  activeBrowserTabId: string;
  tabBarVisible?: boolean;
  splitView?: boolean;
  onWorkspaceSelect: (id: string) => void;
  onAddWorkspace: () => void;
  onServiceClick: (id: string) => void;
  onSelectBrowserTab: (id: string) => void;
  onCloseBrowserTab: (id: string) => void;
  onNewBrowserTab: () => void;
  onHideTabBar?: () => void;
  onShowTabBar?: () => void;
  onReload?: () => void;
  onShowSettings: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  onToggleSplitView?: () => void;
  onEnterSplitView?: (layout: SplitLayoutId) => void;
  onExitSplitView?: () => void;
  onManageWorkspaces?: () => void;
  onOpenSearch?: (initialQuery?: string) => void;
  searchOpen?: boolean;
  onOpenInbox?: () => void;
}

export function AppTitleBar({
  isDarkMode = true,
  workspaces,
  activeWorkspace,
  services,
  activeTab,
  notificationsEnabled,
  browserTabs,
  activeBrowserTabId,
  splitView = false,
  onWorkspaceSelect,
  onAddWorkspace,
  onServiceClick,
  onSelectBrowserTab,
  onCloseBrowserTab,
  onNewBrowserTab,
  onReload,
  onShowSettings,
  onToggleNotifications,
  onToggleSplitView,
  onEnterSplitView,
  onExitSplitView,
  onManageWorkspaces,
  onOpenSearch,
  searchOpen = false,
  onOpenInbox,
}: AppTitleBarProps) {
  const inbox = useInboxOptional();
  const [maximized, setMaximized] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [workspaceSheetOpen, setWorkspaceSheetOpen] = useState(false);
  const [tabsSheetOpen, setTabsSheetOpen] = useState(false);
  const [splitPopoverOpen, setSplitPopoverOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const inboxActive = activeTab === 'inbox';

  useEffect(() => {
    if (!searchOpen) setSearchDraft('');
  }, [searchOpen]);

  const activeService = services.find((s) => s.id === activeTab);
  const isServiceView = !!activeService;
  const workspace = workspaces.find((w) => w.id === activeWorkspace);
  const isWhatsApp = activeService?.iconType === 'whatsapp';
  const isSshService =
    !!activeService &&
    (activeService.kind === 'ssh' ||
      activeService.type === 'ssh' ||
      activeService.iconType === 'ubuntu' ||
      activeService.iconType === 'ssh-server');
  const hasMultipleTabs = browserTabs.length > 1;
  const atTabLimit = browserTabs.length >= MAX_BROWSER_TABS;

  const iconBtnStyle: CSSProperties = {
    color: isDarkMode ? '#c8cdd3' : '#595959',
    width: 36,
    height: 36,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 17,
  };

  // Close tabs sheet when leaving a service view
  useEffect(() => {
    if (!isServiceView) {
      setTabsSheetOpen(false);
    }
  }, [isServiceView]);

  useEffect(() => {
    void window.electronAPI?.windowIsMaximized?.().then(setMaximized);
    void window.electronAPI?.windowIsFullscreen?.().then(setFullscreen);
    const unsubMax = window.electronAPI?.onWindowMaximizedChanged?.(setMaximized);
    const unsubFs = window.electronAPI?.onWindowFullscreenChanged?.(setFullscreen);
    return () => {
      if (typeof unsubMax === 'function') unsubMax();
      if (typeof unsubFs === 'function') unsubFs();
    };
  }, []);

  const isMac = window.electronAPI?.platform === 'darwin';
  const bg = isDarkMode ? APP_SIDEBAR_BG : '#f0f0f0';
  const border = isDarkMode ? COLORS.APP_BORDER : '#d9d9d9';
  const muted = isDarkMode ? '#9aa0a6' : '#595959';
  const text = isDarkMode ? '#e8eaed' : '#1f1f1f';

  const openNewWindow = () => {
    if (!activeService) return;
    const url =
      activeService.url ||
      getServiceConfig(activeService.iconType).url ||
      'https://www.google.com';
    void window.electronAPI?.popoutService?.({
      serviceId: activeService.id,
      name: activeService.name,
      url,
      iconType: activeService.iconType,
      partition: activeService.partition,
      customIcon: activeService.customIcon,
    });
  };

  const toggleFullscreen = () => {
    void window.electronAPI?.windowToggleFullscreen?.().then((intended) => {
      if (typeof intended === 'boolean') setFullscreen(intended);
      // Re-sync with real OS state (Windows setFullScreen can lag)
      window.setTimeout(() => {
        void window.electronAPI?.windowIsFullscreen?.().then((actual) => {
          if (typeof actual === 'boolean') setFullscreen(actual);
        });
      }, 150);
    });
  };

  return (
    <>
    <div
      style={{
        height: APP_TOP_BAR_HEIGHT,
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        // Leave room for native macOS traffic lights (close / minimize / zoom)
        padding: isMac ? '0 12px 0 78px' : '0 0 0 8px',
        background: bg,
        borderBottom: `1px solid ${border}`,
        flexShrink: 0,
        color: text,
        ...drag,
      }}
    >
      <img
        src={arcticSwitchWordmark}
        alt="Arctic Switch"
        draggable={false}
        style={{
          height: 30,
          width: 'auto',
          maxWidth: 168,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          ...noDrag,
        }}
      />

      <Button
        type="text"
        onClick={() => {
          setTabsSheetOpen(false);
          setWorkspaceSheetOpen((open) => !open);
        }}
        style={{
          color: text,
          height: 34,
          background: workspaceSheetOpen
            ? isDarkMode
              ? 'rgba(255,255,255,0.16)'
              : 'rgba(255,255,255,0.12)'
            : 'transparent',
          ...noDrag,
        }}
      >
        <Space size={6}>
          <AppstoreOutlined style={{ color: workspaceSheetOpen ? COLORS.PRIMARY : muted }} />
          <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {workspace?.name || 'Workspace'}
          </span>
          {workspaceSheetOpen ? (
            <UpOutlined style={{ fontSize: 10, color: COLORS.PRIMARY }} />
          ) : (
            <DownOutlined style={{ fontSize: 10, color: muted }} />
          )}
        </Space>
      </Button>

      <div style={{ width: 1, height: 22, background: border, flexShrink: 0 }} />

      <div
        data-tn-global-search-anchor
        style={{
          flex: '0 1 360px',
          maxWidth: 360,
          minWidth: 160,
          position: 'relative',
          ...noDrag,
        }}
      >
        <Input
          allowClear
          size="middle"
          prefix={<SearchOutlined style={{ color: muted }} />}
          placeholder="Search workspace or service"
          value={searchDraft}
          onChange={(e) => {
            const value = e.target.value;
            setSearchDraft(value);
            onOpenSearch?.(value);
          }}
          onFocus={() => {
            if (searchOpen) return;
            setWorkspaceSheetOpen(false);
            setTabsSheetOpen(false);
            onOpenSearch?.(searchDraft);
          }}
          onClick={() => {
            if (searchOpen) return;
            setWorkspaceSheetOpen(false);
            setTabsSheetOpen(false);
            onOpenSearch?.(searchDraft);
          }}
          onPressEnter={() => onOpenSearch?.(searchDraft)}
          style={{
            height: 34,
            borderRadius: 10,
            background: isDarkMode ? 'rgba(255,255,255,0.06)' : '#fff',
            borderColor: isDarkMode ? COLORS.APP_BORDER : '#d9d9d9',
          }}
        />
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexShrink: 0,
          minWidth: 0,
          overflowX: 'auto',
          ...noDrag,
        }}
      >
        {isServiceView && (
          <div
            onClick={() => onServiceClick(activeService.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              height: 30,
              padding: '0 10px',
              borderRadius: 6,
              background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff',
              border: `1px solid ${border}`,
              cursor: 'pointer',
              flexShrink: 0,
              maxWidth: 160,
            }}
          >
            <ServiceLogo
              iconType={activeService.iconType}
              customIcon={activeService.customIcon}
              url={activeService.url}
              size={14}
            />
            <Text
              style={{
                color: text,
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activeService.name}
            </Text>
          </div>
        )}

        {isServiceView && hasMultipleTabs && (
          <Button
            type="text"
            onClick={() => {
              setWorkspaceSheetOpen(false);
              setTabsSheetOpen((open) => !open);
            }}
            style={{
              color: text,
              height: 34,
              background: tabsSheetOpen
                ? isDarkMode
                  ? 'rgba(255,255,255,0.16)'
                  : 'rgba(255,255,255,0.12)'
                : 'transparent',
              ...noDrag,
            }}
          >
            <Space size={6}>
              <CopyOutlined style={{ color: tabsSheetOpen ? COLORS.PRIMARY : muted }} />
              <span>Tabs ({browserTabs.length})</span>
              {tabsSheetOpen ? (
                <UpOutlined style={{ fontSize: 10, color: COLORS.PRIMARY }} />
              ) : (
                <DownOutlined style={{ fontSize: 10, color: muted }} />
              )}
            </Space>
          </Button>
        )}
      </div>

      {isServiceView && (
        <Button
          type="primary"
          icon={<FormOutlined />}
          disabled={atTabLimit}
          onClick={() => {
            if (atTabLimit) {
              message.warning(`Maximum ${MAX_BROWSER_TABS} tabs allowed`);
              return;
            }
            onNewBrowserTab();
          }}
          style={{
            ...noDrag,
            height: 34,
            padding: '0 16px',
            borderRadius: 18,
            fontWeight: 600,
            fontSize: 13,
            border: 'none',
            opacity: atTabLimit ? 0.55 : 1,
            color: '#111111',
            background: '#ffffff',
            boxShadow: atTabLimit ? 'none' : '0 2px 8px rgba(255,255,255,0.16)',
          }}
        >
          {isWhatsApp ? 'New Chat' : isSshService ? 'New Terminal' : 'New Tab'}
        </Button>
      )}

      <Space size={8} style={{ ...noDrag, marginRight: 4 }}>
        <Tooltip title="Unread inbox — all accounts">
          <span style={{ position: 'relative', display: 'inline-flex' }}>
            <Button
              type="text"
              icon={<InboxOutlined />}
              onClick={() => {
                setWorkspaceSheetOpen(false);
                setTabsSheetOpen(false);
                onOpenInbox?.();
              }}
              style={{
                ...iconBtnStyle,
                color:
                  inboxActive || (inbox?.totalChats || 0) > 0
                    ? COLORS.PRIMARY
                    : iconBtnStyle.color,
                background: inboxActive
                  ? isDarkMode
                    ? 'rgba(255,255,255,0.16)'
                    : 'rgba(255,255,255,0.16)'
                  : 'transparent',
              }}
              aria-label="Unread inbox"
            />
            {(inbox?.totalChats || 0) > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  minWidth: 16,
                  height: 16,
                  padding: '0 4px',
                  borderRadius: 999,
                  background: '#ffffff',
                  color: '#111111',
                  fontSize: 10,
                  fontWeight: 700,
                  lineHeight: '16px',
                  textAlign: 'center',
                  pointerEvents: 'none',
                }}
              >
                {formatBadge(inbox?.totalChats || 0)}
              </span>
            )}
          </span>
        </Tooltip>
        <Tooltip title={notificationsEnabled ? 'Mute notifications' : 'Enable notifications'}>
          <Button
            type="text"
            icon={notificationsEnabled ? <BellFilled /> : <BellOutlined />}
            onClick={() => onToggleNotifications(!notificationsEnabled)}
            style={iconBtnStyle}
          />
        </Tooltip>
        <Popover
          trigger="click"
          open={splitPopoverOpen}
          onOpenChange={setSplitPopoverOpen}
          placement="bottomRight"
          arrow={false}
          content={
            <div style={{ width: 220, padding: 4, ...noDrag }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                  color: muted,
                  marginBottom: 10,
                }}
              >
                Split layout
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 8,
                  marginBottom: 12,
                }}
              >
                {SPLIT_LAYOUTS.map((layout) => (
                  <button
                    key={layout.id}
                    type="button"
                    title={layout.label}
                    onClick={() => {
                      onEnterSplitView?.(layout.id);
                      setSplitPopoverOpen(false);
                    }}
                    style={{
                      height: 56,
                      borderRadius: 8,
                      border: `1px solid ${border}`,
                      background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fafafa',
                      cursor: 'pointer',
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={previewStyleForLayout(layout.id)}>
                      {Array.from({ length: layout.slots }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            borderRadius: 2,
                            background:
                              i === 0
                                ? isDarkMode
                                  ? '#4a5d73'
                                  : '#8c8c8c'
                                : isDarkMode
                                  ? '#2a3545'
                                  : '#d9d9d9',
                          }}
                        />
                      ))}
                    </div>
                    <span
                      style={{
                        fontSize: 9,
                        color: muted,
                        textAlign: 'center',
                        lineHeight: 1.2,
                      }}
                    >
                      {layout.label}
                    </span>
                  </button>
                ))}
              </div>
              {splitView && (
                <Button
                  block
                  size="small"
                  danger
                  onClick={() => {
                    onExitSplitView?.();
                    setSplitPopoverOpen(false);
                  }}
                >
                  Exit split view
                </Button>
              )}
            </div>
          }
        >
          <Tooltip title={splitView ? 'Split view options' : 'Split view'}>
            <Button
              type="text"
              icon={
                <SplitCellsOutlined
                  style={{
                    color: splitView ? COLORS.PRIMARY : undefined,
                    fontSize: 17,
                  }}
                />
              }
              onClick={() => {
                if (!splitPopoverOpen && !splitView) {
                  // quick toggle still works via popover primary action
                }
              }}
              style={{
                ...iconBtnStyle,
                color: splitView ? COLORS.PRIMARY : iconBtnStyle.color,
                background: 'transparent',
              }}
            />
          </Tooltip>
        </Popover>
        <Tooltip title={fullscreen ? 'Exit fullscreen (F11)' : 'Fullscreen (F11)'}>
          <Button
            type="text"
            icon={
              fullscreen ? (
                <FullscreenExitOutlined style={{ color: COLORS.PRIMARY, fontSize: 17 }} />
              ) : (
                <FullscreenOutlined style={{ fontSize: 17 }} />
              )
            }
            onClick={toggleFullscreen}
            style={{
              ...iconBtnStyle,
              // Active = blue icon only (no blue background)
              color: fullscreen ? COLORS.PRIMARY : iconBtnStyle.color,
              background: 'transparent',
            }}
          />
        </Tooltip>
        <Tooltip title="Open in new window">
          <Button
            type="text"
            icon={<ExportOutlined />}
            onClick={openNewWindow}
            disabled={!isServiceView}
            style={iconBtnStyle}
          />
        </Tooltip>
        {onReload && isServiceView && (
          <Tooltip title="Reload">
            <Button type="text" icon={<ReloadOutlined />} onClick={onReload} style={iconBtnStyle} />
          </Tooltip>
        )}
        <Tooltip title="Settings">
          <Button type="text" icon={<SettingOutlined />} onClick={onShowSettings} style={iconBtnStyle} />
        </Tooltip>
      </Space>

      {!isMac && (
        <div style={{ display: 'flex', height: '100%', ...noDrag }}>
          <Button
            type="text"
            icon={<MinusOutlined />}
            onClick={() => void window.electronAPI?.windowMinimize?.()}
            style={{ width: 46, height: '100%', borderRadius: 0, color: muted }}
          />
          <Button
            type="text"
            icon={<BorderOutlined style={{ fontSize: 12 }} />}
            onClick={() => void window.electronAPI?.windowMaximize?.()}
            style={{ width: 46, height: '100%', borderRadius: 0, color: muted }}
            title={maximized ? 'Restore' : 'Maximize'}
          />
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => void window.electronAPI?.windowClose?.()}
            style={{ width: 46, height: '100%', borderRadius: 0, color: muted }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.color = '#111111';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = muted;
            }}
          />
        </div>
      )}
    </div>

    <WorkspaceSwitcherSheet
      open={workspaceSheetOpen}
      workspaces={workspaces}
      activeWorkspace={activeWorkspace}
      isDarkMode={isDarkMode}
      onClose={() => setWorkspaceSheetOpen(false)}
      onSelect={onWorkspaceSelect}
      onAdd={onAddWorkspace}
      onManage={() => {
        onManageWorkspaces?.();
      }}
    />

    <BrowserTabsSheet
      open={tabsSheetOpen}
      tabs={browserTabs}
      activeTabId={activeBrowserTabId}
      activeService={activeService}
      isDarkMode={isDarkMode}
      onClose={() => setTabsSheetOpen(false)}
      onSelect={onSelectBrowserTab}
      onCloseTab={onCloseBrowserTab}
      onNewTab={() => {
        if (atTabLimit) {
          message.warning(`Maximum ${MAX_BROWSER_TABS} tabs allowed`);
          return;
        }
        onNewBrowserTab();
      }}
      canAddTab={!atTabLimit}
    />
    </>
  );
}
