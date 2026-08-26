import React from 'react';
import { Tooltip, message } from 'antd';
import styles from './WorkspaceIconSidebar.module.css';
import { 
  HomeOutlined,
  PlusOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  DragOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { BrandLogo, ServiceContextMenu, EditServiceModal, ServiceLogo, UnreadBadge } from './common';
import type { ServiceTab, UpdateServicePayload } from '../types';
import { APP_TOP_BAR_HEIGHT, APP_SIDEBAR_BG, COLORS } from '../constants';
import { SERVICE_DND_MIME } from '../constants/dnd';
import { getServiceConfig } from '../utils/serviceConfig';

interface Workspace {
  id: string;
  name: string;
  services: ServiceTab[];
  createdAt: number;
}

interface WorkspaceIconSidebarProps {
  workspaces: Workspace[];
  activeWorkspace: string;
  onWorkspaceClick: (id: string) => void;
  onAddWorkspace: () => void;
  onToggleDetail: () => void;
  workspaceDetailVisible: boolean;
  isDarkMode: boolean;
  onShowProfile?: () => void;
  onShowDashboard?: () => void;
  // Add new props for services
  services?: ServiceTab[];
  activeTab?: string;
  onServiceClick?: (id: string) => void;
  onAddService?: () => void;
  onRemoveService?: (id: string, e: React.MouseEvent) => void;
  onRenameService?: (id: string, newName: string) => void;
  onUpdateService?: (id: string, updates: UpdateServicePayload) => void;
  onReorderServices?: (dragIndex: number, hoverIndex: number) => void;
  disabledServices?: Set<string>;
  onToggleServiceStatus?: (serviceId: string, enabled: boolean) => void;
  onReloadService?: (serviceId: string) => void;
  onLockService?: (service: ServiceTab) => void;
  onUnlockService?: (service: ServiceTab) => void;
  checkServiceLock?: (service: ServiceTab) => boolean;
  /** When true, skip top logo strip (AppTitleBar already above). */
  compactTop?: boolean;
  /** Unread counts keyed by service id */
  unreadById?: Record<string, number>;
}

const WorkspaceIconSidebar: React.FC<WorkspaceIconSidebarProps> = ({
  workspaces,
  activeWorkspace,
  onWorkspaceClick,
  onAddWorkspace,
  onToggleDetail,
  workspaceDetailVisible,
  isDarkMode,
  onShowProfile,
  onShowDashboard,
  services = [],
  activeTab = '',
  onServiceClick,
  onAddService,
  onRemoveService,
  onRenameService,
  onUpdateService,
  onReorderServices,
  disabledServices = new Set(),
  onToggleServiceStatus,
  onReloadService,
  onLockService,
  onUnlockService,
  checkServiceLock,
  compactTop = false,
  unreadById = {},
}) => {
  const [draggedIndex, setDraggedIndex] = React.useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = React.useState(false);
  const [editingService, setEditingService] = React.useState<ServiceTab | null>(null);

  // Memoized service configs for better performance
  const serviceConfigs = React.useMemo(() => {
    return services.map(service => ({
      ...service,
      config: getServiceConfig(service.iconType)
    }));
  }, [services]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    const service = services[index];
    e.dataTransfer.effectAllowed = 'copyMove';
    if (service) {
      e.dataTransfer.setData(SERVICE_DND_MIME, service.id);
      e.dataTransfer.setData('text/plain', service.id);
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex && onReorderServices) {
      onReorderServices(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleServiceReload = (serviceId: string, serviceName: string) => {
    if (onReloadService) {
      onReloadService(serviceId);
      message.success(`${serviceName} reloaded`);
    } else if (window.electronAPI?.reloadService) {
      window.electronAPI.reloadService(serviceId);
      message.success(`${serviceName} reloaded`);
    }
  };

  const handleServiceEdit = (service: ServiceTab) => {
    setEditingService(service);
    setIsEditModalVisible(true);
  };

  const handleEditSave = (id: string, updates: UpdateServicePayload) => {
    if (onUpdateService) {
      onUpdateService(id, updates);
    } else if (updates.name && onRenameService) {
      onRenameService(id, updates.name);
    }
  };

  const handleEditCancel = () => {
    setIsEditModalVisible(false);
    setEditingService(null);
  };

  const handleServiceRemove = (service: ServiceTab, e: React.MouseEvent) => {
    if (window.confirm(`Are you sure you want to remove "${service.name}"?`)) {
      if (onRemoveService) {
        onRemoveService(service.id, e);
        message.success('Service removed');
      }
    }
  };

  const handleServiceToggle = (serviceId: string, serviceName: string, shouldEnable: boolean) => {
    if (shouldEnable && window.licenseExpired) {
      message.error('License expired. Please renew to enable services.');
      return;
    }

    if (onToggleServiceStatus) {
      onToggleServiceStatus(serviceId, shouldEnable);
    }
    
    if (window.electronAPI?.toggleService) {
      window.electronAPI.toggleService(serviceId, shouldEnable);
    }
    
    message.success(`${serviceName} ${shouldEnable ? 'enabled' : 'disabled'}`);
  };

  return (
    <>
      <EditServiceModal
        open={isEditModalVisible}
        service={editingService}
        isDarkMode={isDarkMode}
        onCancel={handleEditCancel}
        onSave={handleEditSave}
      />
      <div style={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        background: isDarkMode ? APP_SIDEBAR_BG : '#fff'
      }}>
      {!compactTop && (
      <div style={{ 
        height: APP_TOP_BAR_HEIGHT,
        boxSizing: 'border-box',
        padding: '0 8px', 
        borderBottom: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
        textAlign: 'center',
        background: isDarkMode ? 'transparent' : '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <BrandLogo
          isDarkMode={isDarkMode}
          size={36}
          alt="ArcticSwitch Logo"
        />
      </div>
      )}

      {/* Service Icons */}
      <div 
        className={styles.serviceIconsContainer}
        data-theme={isDarkMode ? 'dark' : 'light'}
      >
        {serviceConfigs.map(({ config, ...service }, index) => (
          <Tooltip 
            key={service.id} 
            title={disabledServices.has(service.id) ? `${service.name} (Disabled)` : service.name}
            placement="right"
          >
            <div className={styles.serviceIconRow}>
              {/* Active left rail — like Wavebox / Instagram reference */}
              {activeTab === service.id && !disabledServices.has(service.id) && (
                <div
                  className={styles.serviceActiveRail}
                  style={{
                    background: config.color,
                    boxShadow: `0 0 8px 1px ${config.color}aa`,
                    height: 32,
                    width: 3,
                  }}
                />
              )}
            <ServiceContextMenu
              service={service}
              isDisabled={disabledServices.has(service.id)}
              isDarkMode={isDarkMode}
              actions={{
                onReload: handleServiceReload,
                onEdit: handleServiceEdit,
                onToggle: handleServiceToggle,
                onLock: onLockService,
                onRemoveLock: onUnlockService,
                onRemove: handleServiceRemove,
              }}
            >
            <div
              className={[
                styles.serviceIconHit,
                activeTab === service.id && !disabledServices.has(service.id)
                  ? styles.serviceIconHitActive
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                width: 54,
                height: 54,
                borderRadius: 14,
                background: 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: disabledServices.has(service.id) ? 'not-allowed' : 'pointer',
                transition: 'transform 0.2s, filter 0.25s ease',
                border: disabledServices.has(service.id)
                  ? `2px dashed ${isDarkMode ? '#434343' : '#d9d9d9'}`
                  : dragOverIndex === index
                    ? '2px dashed #ffffff'
                    : '2px solid transparent',
                position: 'relative',
                overflow: 'visible',
                boxShadow: 'none',
                transform: draggedIndex === index ? 'rotate(5deg) scale(1.05)' : 'none',
                opacity: disabledServices.has(service.id)
                  ? 0.5
                  : draggedIndex === index
                    ? 0.8
                    : 1,
                zIndex: activeTab === service.id ? 2 : 1,
                // Brand glow color for active icon halo
                ['--service-glow' as string]: config.color,
              }}
              onClick={() => {
                if (!disabledServices.has(service.id)) {
                  if (service.isLocked && checkServiceLock) {
                    const isLocked = checkServiceLock(service);
                    if (isLocked) {
                      return;
                    }
                  }
                  onServiceClick?.(service.id);
                }
              }}
              onMouseEnter={(e) => {
                if (draggedIndex === null && !disabledServices.has(service.id)) {
                  e.currentTarget.style.transform = 'scale(1.08)';
                }
              }}
              onMouseLeave={(e) => {
                if (draggedIndex === null && !disabledServices.has(service.id)) {
                  e.currentTarget.style.transform = 'scale(1)';
                }
              }}
            >
              {/* Soft brand glow behind active icon */}
              {activeTab === service.id && !disabledServices.has(service.id) && (
                <div
                  className={styles.serviceIconGlow}
                  aria-hidden
                  style={{
                    background: `radial-gradient(circle, ${config.color} 0%, ${config.color}00 72%)`,
                  }}
                />
              )}

              {/* Drag indicator */}
              <div style={{
                position: 'absolute',
                top: 4,
                left: 4,
                opacity: 0.2,
                fontSize: 8,
                color: isDarkMode ? '#fff' : '#595959',
                zIndex: 2,
              }}>
                <DragOutlined />
              </div>

              <div
                className={
                  activeTab === service.id && !disabledServices.has(service.id)
                    ? styles.serviceLogoWrapActive
                    : undefined
                }
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  position: 'relative',
                  zIndex: 1,
                  ...(activeTab === service.id && !disabledServices.has(service.id)
                    ? {
                        filter: `drop-shadow(0 0 8px ${config.color}cc) drop-shadow(0 0 16px ${config.color}66)`,
                      }
                    : null),
                }}
              >
                <ServiceLogo
                  iconType={service.iconType}
                  customIcon={service.customIcon}
                  url={service.url}
                  size={36}
                  style={{ borderRadius: 8 }}
                />
              </div>

              {/* Lock indicator */}
              {service.isLocked && (
                  <div style={{
                    position: 'absolute',
                    bottom: '2px',
                    right: '2px',
                    background: '#ffffff',
                    borderRadius: '50%',
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    color: 'white',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                    border: '2px solid #fff',
                    zIndex: 2
                  }}>
                    <LockOutlined />
                  </div>
                )}

              {/* Unread badge — crisp, above glow */}
              <UnreadBadge count={unreadById[service.id] || 0} />
              
              {/* Drop indicator */}
              {dragOverIndex === index && draggedIndex !== index && (
                <div style={{
                  position: 'absolute',
                  top: '-2px',
                  left: '-2px',
                  right: '-2px',
                  bottom: '-2px',
                  border: '2px dashed #ffffff',
                  borderRadius: '12px',
                  background: 'rgba(255,255,255,0.16)',
                  pointerEvents: 'none'
                }} />
              )}
              
              {/* Disabled indicator */}
              {disabledServices.has(service.id) && (
                <div style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '10px',
                  color: isDarkMode ? '#666' : '#999',
                  background: isDarkMode ? '#000' : '#fff',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  border: `1px solid ${isDarkMode ? '#434343' : '#d9d9d9'}`,
                  whiteSpace: 'nowrap'
                }}>
                  Disabled
                </div>
              )}
            </div>
            </ServiceContextMenu>
            </div>
          </Tooltip>
        ))}
        
        {/* Add service button */}
        <Tooltip title="Add WhatsApp Service" placement="right">
          <div className={styles.serviceIconRow}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '12px',
              background: 'transparent',
              border: `2px dashed ${isDarkMode ? '#434343' : '#d9d9d9'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.3s'
            }}
            onClick={onAddService}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#ffffff';
              e.currentTarget.style.background = isDarkMode ? '#ffffff10' : 'rgba(255,255,255,0.08)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = isDarkMode ? '#434343' : '#d9d9d9';
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <PlusOutlined style={{ color: isDarkMode ? '#fff' : '#595959', fontSize: '16px' }} />
          </div>
          </div>
        </Tooltip>
      </div>

      {/* Bottom Controls */}
      <div style={{ 
        padding: '14px 8px 16px',
        borderTop: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
        background: isDarkMode ? 'transparent' : '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}>
        {/* Home / Dashboard */}
        <Tooltip title="Dashboard" placement="right">
          <button
            type="button"
            onClick={onShowDashboard}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color:
                activeTab === 'dashboard' || activeTab === ''
                  ? '#111111'
                  : isDarkMode
                    ? '#e8eaed'
                    : '#595959',
              background:
                activeTab === 'dashboard' || activeTab === ''
                  ? COLORS.PRIMARY
                  : isDarkMode
                    ? COLORS.APP_ICON_BTN
                    : '#f0f0f0',
              fontSize: 16,
              transition: 'background 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== 'dashboard' && activeTab !== '') {
                e.currentTarget.style.background = isDarkMode
                  ? 'rgba(255,255,255,0.14)'
                  : '#e6e6e6';
              }
              e.currentTarget.style.transform = 'scale(1.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              e.currentTarget.style.background =
                activeTab === 'dashboard' || activeTab === ''
                  ? COLORS.PRIMARY
                  : isDarkMode
                    ? COLORS.APP_ICON_BTN
                    : '#f0f0f0';
            }}
          >
            <HomeOutlined style={{ color: 'inherit' }} />
          </button>
        </Tooltip>

        {/* Toggle workspace panel */}
        <Tooltip
          title={workspaceDetailVisible ? 'Hide workspace' : 'Show workspace'}
          placement="right"
        >
          <button
            type="button"
            onClick={onToggleDetail}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#e8eaed' : '#595959',
              background: workspaceDetailVisible
                ? isDarkMode
                  ? 'rgba(255,255,255,0.16)'
                  : 'rgba(255,255,255,0.12)'
                : isDarkMode
                  ? COLORS.APP_ICON_BTN
                  : '#f0f0f0',
              fontSize: 16,
              transition: 'background 0.2s ease, transform 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (!workspaceDetailVisible) {
                e.currentTarget.style.background = isDarkMode
                  ? 'rgba(255,255,255,0.14)'
                  : '#e6e6e6';
              }
              e.currentTarget.style.transform = 'scale(1.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
              if (!workspaceDetailVisible) {
                e.currentTarget.style.background = isDarkMode
                  ? COLORS.APP_ICON_BTN
                  : '#f0f0f0';
              } else {
                e.currentTarget.style.background = isDarkMode
                  ? 'rgba(255,255,255,0.16)'
                  : 'rgba(255,255,255,0.12)';
              }
            }}
          >
            {workspaceDetailVisible ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
          </button>
        </Tooltip>

        {/* Profile */}
        <Tooltip title="Profile" placement="right">
          <button
            type="button"
            onClick={onShowProfile}
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              border: `2px solid ${
                activeTab === 'profile'
                  ? COLORS.PRIMARY
                  : isDarkMode
                    ? 'rgba(255,255,255,0.18)'
                    : '#d9d9d9'
              }`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDarkMode ? '#000000' : '#595959',
              background: isDarkMode ? '#c5d0e0' : '#f0f0f0',
              fontSize: 18,
              padding: 0,
              transition: 'border-color 0.15s, transform 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <UserOutlined />
          </button>
        </Tooltip>
      </div>
      </div>
    </>
  );
};

export default WorkspaceIconSidebar;