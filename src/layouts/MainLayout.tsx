import type { ReactNode, CSSProperties } from 'react';
import { useEffect, useState } from 'react';
import { Layout, message } from 'antd';
import type { ServiceTab, UpdateServicePayload, Workspace } from '../types';
import WorkspaceIconSidebar from '../components/WorkspaceIconSidebar';
import WorkspaceDetailSidebar from '../components/WorkspaceDetailSidebar';
import { AppTitleBar } from '../components/common';
import { useServiceChromeOptional, MAX_BROWSER_TABS } from '../context/ServiceChromeContext';
import { getServiceConfig } from '../utils/serviceConfig';
import { APP_TOP_BAR_HEIGHT, APP_BG_GRADIENT, APP_SIDEBAR_BG, COLORS } from '../constants';
import { useUnreadOptional } from '../context/UnreadContext';

const { Content } = Layout;

const ICON_RAIL_WIDTH = 70;

const winBtnStyle: CSSProperties = {
  width: 46,
  height: '100%',
  border: 'none',
  background: 'transparent',
  color: '#9aa0a6',
  fontSize: 16,
  cursor: 'pointer',
};

interface MainLayoutProps {
  isDarkMode: boolean;
  hideSidebars?: boolean;
  workspaces: Workspace[];
  activeWorkspace: string;
  workspaceDetailVisible: boolean;
  notificationsEnabled: boolean;
  services: ServiceTab[];
  activeTab: string;
  disabledServices: Set<string>;
  onWorkspaceClick: (id: string) => void;
  onAddWorkspace: () => void;
  onToggleDetail: () => void;
  onShowSettings: () => void;
  onToggleNotifications: (enabled: boolean) => void;
  onServiceClick: (id: string) => void;
  onAddService: () => void;
  onRemoveService: (id: string, e: React.MouseEvent) => void;
  onRenameService: (id: string, name: string) => void;
  onUpdateService?: (id: string, updates: UpdateServicePayload) => void;
  onReorderServices: (dragIndex: number, hoverIndex: number) => void;
  onToggleServiceStatus: (serviceId: string, enabled: boolean) => void;
  onReloadService: (serviceId: string) => void;
  onLockService: (service: ServiceTab) => void;
  onUnlockService: (service: ServiceTab) => void;
  checkServiceLock: (service: ServiceTab) => boolean;
  onRemoveWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, name: string) => void;
  onCloseDetail: () => void;
  onShowProfile?: () => void;
  onShowDashboard?: () => void;
  onOpenInbox?: () => void;
  splitView?: boolean;
  onToggleSplitView?: () => void;
  onEnterSplitView?: (layout: import('../constants/splitLayouts').SplitLayoutId) => void;
  onExitSplitView?: () => void;
  onManageWorkspaces?: () => void;
  onOpenSearch?: (initialQuery?: string) => void;
  searchOpen?: boolean;
  children: ReactNode;
}

/** Shell layout: Wavebox title bar + icon rail + optional detail sidebar + content. */
export function MainLayout({
  isDarkMode,
  hideSidebars = false,
  workspaces,
  activeWorkspace,
  workspaceDetailVisible,
  notificationsEnabled,
  services,
  activeTab,
  disabledServices,
  onWorkspaceClick,
  onAddWorkspace,
  onToggleDetail,
  onShowSettings,
  onToggleNotifications,
  onServiceClick,
  onAddService,
  onRemoveService,
  onRenameService,
  onUpdateService,
  onReorderServices,
  onToggleServiceStatus,
  onReloadService,
  onLockService,
  onUnlockService,
  checkServiceLock,
  onRemoveWorkspace,
  onRenameWorkspace,
  onCloseDetail,
  onShowProfile,
  onShowDashboard,
  onOpenInbox,
  splitView = false,
  onToggleSplitView,
  onEnterSplitView,
  onExitSplitView,
  onManageWorkspaces,
  onOpenSearch,
  searchOpen = false,
  children,
}: MainLayoutProps) {
  const chrome = useServiceChromeOptional();
  const unread = useUnreadOptional();
  const unreadById = unread?.unreadById || {};
  const [fullscreen, setFullscreen] = useState(false);
  const activeService = services.find((s) => s.id === activeTab);
  const isSshService =
    !!activeService &&
    (activeService.kind === 'ssh' ||
      activeService.type === 'ssh' ||
      activeService.iconType === 'ubuntu' ||
      activeService.iconType === 'ssh-server');
  const homeUrl = activeService
    ? isSshService
      ? `ssh://${activeService.ssh?.host || 'server'}`
      : activeService.url || getServiceConfig(activeService.iconType).url || 'https://www.google.com'
    : 'https://www.google.com';

  // Empty workspace / profile / no service → hide previous service's tabs
  useEffect(() => {
    if (!chrome?.clearServiceChrome) return;
    if (!activeService) {
      chrome.clearServiceChrome();
    }
  }, [chrome, activeService]);

  useEffect(() => {
    void window.electronAPI?.windowIsFullscreen?.().then(setFullscreen);
    const unsub = window.electronAPI?.onWindowFullscreenChanged?.(setFullscreen);
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  // Only hide for special shells (e.g. popout). Native macOS fullscreen must NOT
  // hide the rail — green button / Space restore often sets fullscreen on Mac.
  const sidebarsHidden = hideSidebars;
  const isMac = window.electronAPI?.platform === 'darwin';

  const windowControls = isMac ? (
    <div
      style={{
        height: APP_TOP_BAR_HEIGHT,
        paddingLeft: 78,
        background: isDarkMode ? APP_SIDEBAR_BG : '#f0f0f0',
        borderBottom: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    />
  ) : (
    <div
      style={{
        height: APP_TOP_BAR_HEIGHT,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        background: isDarkMode ? APP_SIDEBAR_BG : '#f0f0f0',
        borderBottom: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
        WebkitAppRegion: 'drag',
      } as React.CSSProperties}
    >
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          type="button"
          onClick={() => void window.electronAPI?.windowMinimize?.()}
          style={winBtnStyle}
        >
          −
        </button>
        <button
          type="button"
          onClick={() => void window.electronAPI?.windowMaximize?.()}
          style={winBtnStyle}
        >
          □
        </button>
        <button
          type="button"
          onClick={() => void window.electronAPI?.windowClose?.()}
          style={{ ...winBtnStyle }}
        >
          ×
        </button>
      </div>
    </div>
  );

  return (
    <Layout
      style={{
        height: '100vh',
        maxHeight: '100vh',
        overflow: 'hidden',
        background: isDarkMode ? APP_BG_GRADIENT : '#f0f2f5',
        flexDirection: 'column',
      }}
    >
      {hideSidebars && !fullscreen
        ? windowControls
        : chrome && (
            <AppTitleBar
              isDarkMode={isDarkMode}
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              services={services}
              activeTab={activeTab}
              notificationsEnabled={notificationsEnabled}
              browserTabs={chrome.browserTabs}
              activeBrowserTabId={chrome.activeBrowserTabId}
              tabBarVisible={chrome.tabBarVisible}
              onWorkspaceSelect={onWorkspaceClick}
              onAddWorkspace={onAddWorkspace}
              onServiceClick={onServiceClick}
              onSelectBrowserTab={chrome.selectBrowserTab}
              onCloseBrowserTab={chrome.closeBrowserTab}
              onNewBrowserTab={() => {
                const n = (chrome.browserTabs?.length || 0) + 1;
                const ok = chrome.openNewBrowserTab(
                  homeUrl,
                  isSshService ? `Terminal ${n}` : activeService?.name || 'New Tab',
                  isSshService ? 'ssh' : 'webview'
                );
                if (ok === false) {
                  message.warning(`Maximum ${MAX_BROWSER_TABS} tabs allowed`);
                }
              }}
              onHideTabBar={() => chrome.setTabBarVisible(false)}
              onShowTabBar={() => chrome.setTabBarVisible(true)}
              onReload={() => activeService && onReloadService(activeService.id)}
              onShowSettings={onShowSettings}
              onToggleNotifications={onToggleNotifications}
              splitView={splitView}
              onToggleSplitView={onToggleSplitView}
              onEnterSplitView={onEnterSplitView}
              onExitSplitView={onExitSplitView}
              onManageWorkspaces={onManageWorkspaces}
              onOpenSearch={onOpenSearch}
              searchOpen={searchOpen}
              onOpenInbox={onOpenInbox}
            />
          )}

      <Layout
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          background: isDarkMode ? APP_BG_GRADIENT : '#f0f2f5',
          // Plain <aside> does not trigger ant-layout-has-sider — force row
          // or the icon rail stacks above content and the main pane goes blank/black.
          flexDirection: 'row',
          alignItems: 'stretch',
        }}
      >
        {!sidebarsHidden && (
          <>
            <aside
              style={{
                width: ICON_RAIL_WIDTH,
                minWidth: ICON_RAIL_WIDTH,
                maxWidth: ICON_RAIL_WIDTH,
                flex: `0 0 ${ICON_RAIL_WIDTH}px`,
                background: isDarkMode ? 'transparent' : '#fff',
                borderRight: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
                boxShadow: '2px 0 8px rgba(0,0,0,0.1)',
                zIndex: 100,
                alignSelf: 'stretch',
                height: 'auto',
                minHeight: 0,
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              <WorkspaceIconSidebar
                workspaces={workspaces}
                activeWorkspace={activeWorkspace}
                onWorkspaceClick={onWorkspaceClick}
                onAddWorkspace={onAddWorkspace}
                onToggleDetail={onToggleDetail}
                workspaceDetailVisible={workspaceDetailVisible}
                isDarkMode={isDarkMode}
                services={services}
                activeTab={activeTab}
                onServiceClick={onServiceClick}
                onAddService={onAddService}
                onRemoveService={onRemoveService}
                onRenameService={onRenameService}
                onUpdateService={onUpdateService}
                onReorderServices={onReorderServices}
                disabledServices={disabledServices}
                onToggleServiceStatus={onToggleServiceStatus}
                onReloadService={onReloadService}
                onLockService={onLockService}
                onUnlockService={onUnlockService}
                checkServiceLock={checkServiceLock}
                compactTop
                onShowProfile={onShowProfile}
                onShowDashboard={onShowDashboard}
                unreadById={unreadById}
              />
            </aside>

            <div
              style={{
                width: workspaceDetailVisible ? 300 : 0,
                minWidth: workspaceDetailVisible ? 300 : 0,
                flexShrink: 0,
                alignSelf: 'stretch',
                height: 'auto',
                minHeight: 0,
                overflow: 'hidden',
                borderRight: workspaceDetailVisible
                  ? `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`
                  : '1px solid transparent',
                boxShadow: workspaceDetailVisible
                  ? '2px 0 8px rgba(0,0,0,0.1)'
                  : 'none',
                background: isDarkMode ? 'transparent' : '#fff',
                zIndex: 99,
                transition:
                  'width 0.32s cubic-bezier(0.22, 1, 0.36, 1), min-width 0.32s cubic-bezier(0.22, 1, 0.36, 1), border-color 0.24s ease, box-shadow 0.24s ease',
                willChange: 'width',
              }}
            >
              <div
                style={{
                  width: 300,
                  height: '100%',
                  transform: workspaceDetailVisible
                    ? 'translateX(0)'
                    : 'translateX(-12px)',
                  opacity: workspaceDetailVisible ? 1 : 0.35,
                  transition:
                    'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.24s ease',
                  pointerEvents: workspaceDetailVisible ? 'auto' : 'none',
                }}
              >
                <WorkspaceDetailSidebar
                  workspaces={workspaces}
                  activeWorkspace={activeWorkspace}
                  onWorkspaceClick={onWorkspaceClick}
                  onAddWorkspace={onAddWorkspace}
                  onRemoveWorkspace={onRemoveWorkspace}
                  onRenameWorkspace={onRenameWorkspace}
                  services={services}
                  activeTab={activeTab}
                  onServiceClick={onServiceClick}
                  onAddService={onAddService}
                  onRemoveService={onRemoveService}
                  onRenameService={onRenameService}
                  onUpdateService={onUpdateService}
                  isDarkMode={isDarkMode}
                  onClose={onCloseDetail}
                  onReorderServices={onReorderServices}
                  onLockService={onLockService}
                  onUnlockService={onUnlockService}
                  checkServiceLock={checkServiceLock}
                  unreadById={unreadById}
                />
              </div>
            </div>
          </>
        )}

        <Content
          style={{
            background: isDarkMode ? COLORS.APP_BG_BASE : '#fff',
            position: 'relative',
            overflow: 'hidden',
            marginLeft: 0,
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            height: 'auto',
            alignSelf: 'stretch',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
