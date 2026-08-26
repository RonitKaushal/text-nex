import React, { useState } from 'react';
import { Typography, Button, Tooltip, Input, Modal, Avatar } from 'antd';
import { 
  AppstoreOutlined, 
  WhatsAppOutlined, 
  MessageOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckOutlined,
  CloseOutlined,
  SettingOutlined,
  DownOutlined,
  RightOutlined,
  MailOutlined,
  SlackOutlined,
  SkypeOutlined,
  TeamOutlined,
  FacebookOutlined,
  InstagramOutlined,
  TwitterOutlined,
  LinkedinOutlined,
  GithubOutlined,
  CalendarOutlined,
  CloudOutlined,
  FileOutlined,
  SoundOutlined,
  VideoCameraOutlined,
  GlobalOutlined,
  RedditOutlined,
  TikTokOutlined,
  YoutubeOutlined,
  SpotifyOutlined,
  LockOutlined,
} from '@ant-design/icons';
import telegramIcon from '../assets/telegram.png';
import discordIcon from '../assets/discord.png';
import godaddyIcon from '../assets/godaddy.png';
import { ServiceContextMenu, EditServiceModal, ServiceLogo, UnreadBadge } from './common';
import type { ServiceTab, UpdateServicePayload } from '../types';
import { APP_TOP_BAR_HEIGHT, APP_SIDEBAR_BG, COLORS } from '../constants';
import { SERVICE_DND_MIME } from '../constants/dnd';
const { Text } = Typography;

interface Workspace {
  id: string;
  name: string;
  services: ServiceTab[];
  createdAt: number;
}

interface WorkspaceDetailSidebarProps {
  workspaces: Workspace[];
  activeWorkspace: string;
  onWorkspaceClick: (id: string) => void;
  onAddWorkspace: () => void;
  onRemoveWorkspace: (id: string) => void;
  onRenameWorkspace: (id: string, newName: string) => void;
  services: ServiceTab[];
  activeTab: string;
  onServiceClick: (id: string) => void;
  onAddService: () => void;
  onRemoveService: (id: string, e: React.MouseEvent) => void;
  onRenameService: (id: string, newName: string) => void;
  onUpdateService?: (id: string, updates: UpdateServicePayload) => void;
  isDarkMode: boolean;
  onClose: () => void;
  onReorderServices?: (dragIndex: number, hoverIndex: number) => void;
  onLockService?: (service: ServiceTab) => void;
  onUnlockService?: (service: ServiceTab) => void;
  checkServiceLock?: (service: ServiceTab) => boolean;
  unreadById?: Record<string, number>;
}

const WorkspaceDetailSidebar: React.FC<WorkspaceDetailSidebarProps> = ({
  workspaces,
  activeWorkspace,
  onWorkspaceClick,
  onAddWorkspace,
  onRemoveWorkspace,
  onRenameWorkspace,
  services,
  activeTab,
  onServiceClick,
  onAddService,
  onRemoveService,
  onRenameService,
  onUpdateService,
  isDarkMode,
  onClose,
  onReorderServices,
  onLockService,
  onUnlockService,
  checkServiceLock,
  unreadById = {},
}) => {
  const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
  const [editingService, setEditingService] = useState<string | null>(null);
  const [editModalService, setEditModalService] = useState<ServiceTab | null>(null);
  const [editName, setEditName] = useState('');
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<string>>(new Set([activeWorkspace]));
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleWorkspaceEdit = (workspace: Workspace) => {
    setEditingWorkspace(workspace.id);
    setEditName(workspace.name);
  };

  const handleServiceEdit = (service: ServiceTab) => {
    setEditModalService(service);
  };

  const handleEditModalSave = (id: string, updates: UpdateServicePayload) => {
    if (onUpdateService) onUpdateService(id, updates);
    else if (updates.name) onRenameService(id, updates.name);
  };

  const handleSaveWorkspace = () => {
    if (editName.trim() && editingWorkspace) {
      onRenameWorkspace(editingWorkspace, editName.trim());
    }
    setEditingWorkspace(null);
    setEditName('');
  };

  const handleSaveService = () => {
    if (editName.trim() && editingService) {
      onRenameService(editingService, editName.trim());
    }
    setEditingService(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingWorkspace(null);
    setEditingService(null);
    setEditName('');
  };

  const handleDeleteWorkspace = (workspaceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Delete Workspace',
      content: 'Are you sure you want to delete this workspace? All services in this workspace will be removed.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => onRemoveWorkspace(workspaceId)
    });
  };

  const handleDeleteService = (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    Modal.confirm({
      title: 'Remove Service',
      content: 'Are you sure you want to remove this service? This action cannot be undone.',
      okText: 'Remove',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => onRemoveService(serviceId, e)
    });
  };

  const currentWorkspace = workspaces.find(w => w.id === activeWorkspace);

  const toggleWorkspaceExpansion = (workspaceId: string) => {
    const newExpanded = new Set(expandedWorkspaces);
    if (newExpanded.has(workspaceId)) {
      newExpanded.delete(workspaceId);
    } else {
      newExpanded.add(workspaceId);
    }
    setExpandedWorkspaces(newExpanded);
  };

  const handleDragStart = (e: React.DragEvent, index: number, serviceId: string) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData(SERVICE_DND_MIME, serviceId);
    e.dataTransfer.setData('text/plain', serviceId);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number, workspaceServices: ServiceTab[]) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex && onReorderServices) {
      console.log('🔄 Reordering services:', draggedIndex, '->', dropIndex);
      onReorderServices(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const scrollbarStyles = {
    scrollbarWidth: 'thin' as const,
    scrollbarColor: isDarkMode
      ? 'rgba(255,255,255,0.22) transparent'
      : '#bfbfbf transparent',
  };

  const serviceCountLabel = (count: number) =>
    `${count} service${count === 1 ? '' : 's'}`;

  const actionBtnStyle = (color?: string): React.CSSProperties => ({
    width: 28,
    height: 28,
    minWidth: 28,
    padding: 0,
    color: color ?? (isDarkMode ? 'rgba(255,255,255,0.72)' : '#595959'),
    opacity: 0.72,
  });

  return (
    <>
      <EditServiceModal
        open={!!editModalService}
        service={editModalService}
        isDarkMode={isDarkMode}
        onCancel={() => setEditModalService(null)}
        onSave={handleEditModalSave}
      />
    <div style={{ 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: isDarkMode ? APP_SIDEBAR_BG : '#fff'
    }}>
      {/* Header - Fixed — aligned with logo strip & service header */}
      <div style={{ 
        height: APP_TOP_BAR_HEIGHT,
        boxSizing: 'border-box',
        padding: '0 20px',
        borderBottom: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: isDarkMode ? 'transparent' : '#fafafa',
        flexShrink: 0
      }}>
        <Text 
          style={{ 
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: isDarkMode ? '#fff' : '#262626'
          }}
        >
          Workspaces
        </Text>
        <Button
          type="text"
          icon={<CloseOutlined style={{ fontSize: 14 }} />}
          onClick={onClose}
          style={{
            width: 32,
            height: 32,
            minWidth: 32,
            padding: 0,
            borderRadius: 8,
            color: isDarkMode ? '#fff' : '#595959',
            opacity: 0.72,
          }}
        />
      </div>

      {/* Scrollable Content */}
      <div 
        style={{ 
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          ...scrollbarStyles
        }}
        className="workspace-sidebar-scroll"
      >
        <style>{`
          .workspace-sidebar-scroll::-webkit-scrollbar {
            width: 6px;
          }
          .workspace-sidebar-scroll::-webkit-scrollbar-track {
            background: transparent;
          }
          .workspace-sidebar-scroll::-webkit-scrollbar-thumb {
            background: ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.18)'};
            border-radius: 999px;
          }
          .workspace-sidebar-scroll::-webkit-scrollbar-thumb:hover {
            background: ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.32)'};
          }
        `}</style>

        <div style={{ padding: '16px 14px 20px' }}>
          {workspaces.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {workspaces.map(workspace => {
                  const isActiveWorkspace = activeWorkspace === workspace.id;
                  const isExpanded = expandedWorkspaces.has(workspace.id);

                  return (
                  <div key={workspace.id}>
                    <div
                      style={{
                        padding: '14px 14px',
                        borderRadius: 10,
                        cursor: 'pointer',
                        background: isActiveWorkspace
                          ? isDarkMode
                            ? 'rgba(255,255,255,0.16)'
                            : COLORS.PRIMARY_SOFT
                          : 'transparent',
                        border: isActiveWorkspace
                          ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.16)'}`
                          : '1px solid transparent',
                        transition: 'background 0.18s ease, border-color 0.18s ease',
                      }}
                      onClick={() => {
                        onWorkspaceClick(workspace.id);
                        setTimeout(() => {
                          onClose();
                        }, 150);
                      }}
                      onMouseEnter={(e) => {
                        if (!isActiveWorkspace) {
                          e.currentTarget.style.background = isDarkMode
                            ? 'rgba(255, 255, 255, 0.05)'
                            : '#f5f5f5';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = isActiveWorkspace
                          ? isDarkMode
                            ? 'rgba(255,255,255,0.16)'
                            : COLORS.PRIMARY_SOFT
                          : 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {editingWorkspace === workspace.id ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveWorkspace();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                              onBlur={handleSaveWorkspace}
                              autoFocus
                              size="middle"
                              style={{
                                background: isDarkMode ? '#1f1f1f' : '#fff',
                                borderColor: COLORS.PRIMARY,
                                color: isDarkMode ? '#fff' : undefined,
                                fontSize: 14,
                              }}
                              maxLength={50}
                            />
                          ) : (
                            <>
                              <Text 
                                style={{ 
                                  color: isActiveWorkspace
                                    ? COLORS.PRIMARY
                                    : (isDarkMode ? '#fff' : '#262626'),
                                  fontSize: 15,
                                  fontWeight: isActiveWorkspace ? 600 : 500,
                                  lineHeight: 1.35,
                                  display: 'block',
                                }}
                              >
                                {workspace.name}
                              </Text>
                              <Text 
                                type="secondary" 
                                style={{ 
                                  fontSize: 13,
                                  marginTop: 4,
                                  display: 'block',
                                  color: isActiveWorkspace
                                    ? 'rgba(255,255,255,0.16)'
                                    : isDarkMode
                                      ? 'rgba(255,255,255,0.5)'
                                      : undefined,
                                }}
                              >
                                {serviceCountLabel(workspace.services.length)}
                              </Text>
                            </>
                          )}
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                          {editingWorkspace === workspace.id ? (
                            <>
                              <Button 
                                type="text" 
                                icon={<CheckOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveWorkspace();
                                }}
                                style={actionBtnStyle('#ffffff')}
                              />
                              <Button 
                                type="text" 
                                icon={<CloseOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                style={actionBtnStyle('#ffffff')}
                              />
                            </>
                          ) : (
                            <>
                              <Tooltip title="Edit workspace">
                                <Button 
                                  type="text" 
                                  icon={<EditOutlined style={{ fontSize: 14 }} />}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWorkspaceEdit(workspace);
                                  }}
                                  style={actionBtnStyle()}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '0.72';
                                  }}
                                />
                              </Tooltip>
                              
                              {workspaces.length > 1 && (
                                <Tooltip title="Delete workspace">
                                  <Button 
                                    type="text" 
                                    icon={<DeleteOutlined style={{ fontSize: 14 }} />}
                                    onClick={(e) => handleDeleteWorkspace(workspace.id, e)}
                                    style={actionBtnStyle('#ffffff')}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.opacity = '1';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.opacity = '0.72';
                                    }}
                                  />
                                </Tooltip>
                              )}
                              
                              <Button
                                type="text"
                                icon={
                                  isExpanded
                                    ? <DownOutlined style={{ fontSize: 12 }} />
                                    : <RightOutlined style={{ fontSize: 12 }} />
                                }
                                style={{
                                  ...actionBtnStyle(
                                    isActiveWorkspace ? COLORS.PRIMARY : undefined
                                  ),
                                  marginLeft: 2,
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleWorkspaceExpansion(workspace.id);
                                }}
                              />
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div style={{ marginLeft: 12, marginTop: 10, marginBottom: 4 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {workspace.services.map((service, serviceIndex) => (
                          <div key={service.id}>
                            <ServiceContextMenu
                              service={service}
                              isDarkMode={isDarkMode}
                              showReload={false}
                              showToggle={false}
                              actions={{
                                onEdit: handleServiceEdit,
                                onLock: onLockService,
                                onRemoveLock: onUnlockService,
                                onRemove: (svc, ev) => handleDeleteService(svc.id, ev),
                              }}
                            >
                            <div
                              draggable
                              onDragStart={(e) => handleDragStart(e, serviceIndex, service.id)}
                              onDragOver={(e) => handleDragOver(e, serviceIndex)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, serviceIndex, workspace.services)}
                              onDragEnd={handleDragEnd}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                borderRadius: 10,
                                cursor: 'pointer',
                                background: activeTab === service.id
                                  ? isDarkMode
                                    ? 'rgba(255,255,255,0.16)'
                                    : COLORS.PRIMARY_SOFT
                                  : 'transparent',
                                border: activeTab === service.id
                                  ? `1px solid ${isDarkMode ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.16)'}`
                                  : dragOverIndex === serviceIndex
                                    ? `1px dashed ${COLORS.PRIMARY}`
                                    : '1px solid transparent',
                                transition: 'background 0.18s ease, border-color 0.18s ease, transform 0.18s ease',
                                transform: draggedIndex === serviceIndex ? 'scale(1.01)' : 'none',
                                opacity: draggedIndex === serviceIndex ? 0.85 : 1,
                                boxShadow:
                                  draggedIndex === serviceIndex
                                    ? '0 4px 12px rgba(0,0,0,0.2)'
                                    : 'none',
                              }}
                              onClick={() => {
                                // Check if service is locked
                                if (service.isLocked && checkServiceLock) {
                                  const isLocked = checkServiceLock(service);
                                  if (isLocked) {
                                    return; // Don't open if locked
                                  }
                                }
                                onServiceClick(service.id);
                                // Auto-close sidebar when selecting a service
                                setTimeout(() => {
                                  onClose();
                                }, 150);
                              }}
                              onMouseEnter={(e) => {
                                if (activeTab !== service.id && draggedIndex === null) {
                                  e.currentTarget.style.background = isDarkMode
                                    ? 'rgba(255, 255, 255, 0.05)'
                                    : '#f5f5f5';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (activeTab !== service.id && draggedIndex === null) {
                                  e.currentTarget.style.background = 'transparent';
                                }
                              }}
                            >
                              <div
                                style={{
                                  opacity: 0.35,
                                  fontSize: 11,
                                  lineHeight: 1,
                                  color: isDarkMode ? '#fff' : '#595959',
                                  flexShrink: 0,
                                }}
                              >
                                ⋮⋮
                              </div>
                              
                              <div style={{ position: 'relative', flexShrink: 0 }}>
                                <Avatar 
                                  size={32}
                                  icon={
                                    <ServiceLogo
                                      iconType={service.iconType}
                                      customIcon={service.customIcon}
                                      url={service.url}
                                      size={22}
                                    />
                                  }
                                  style={{ 
                                    background: 'transparent',
                                    border: `1px solid ${activeTab === service.id ? COLORS.PRIMARY : isDarkMode ? COLORS.APP_BORDER : '#e8e8e8'}`,
                                    flexShrink: 0,
                                  }}
                                />
                                {/* Lock indicator on avatar */}
                                {service.isLocked && (
                                  <div style={{
                                    position: 'absolute',
                                    bottom: '-3px',
                                    right: '-3px',
                                    background: '#ffffff',
                                    borderRadius: '50%',
                                    width: '16px',
                                    height: '16px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '9px',
                                    color: 'white',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                    border: '1.5px solid white',
                                    zIndex: 2
                                  }}>
                                    <LockOutlined />
                                  </div>
                                )}
                                {(unreadById[service.id] || 0) > 0 && (
                                  <UnreadBadge
                                    count={unreadById[service.id] || 0}
                                    size="sm"
                                  />
                                )}
                              </div>
                              
                              <div style={{ minWidth: 0, flex: 1 }}>
                                {editingService === service.id ? (
                                  <Input
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleSaveService();
                                      if (e.key === 'Escape') handleCancelEdit();
                                    }}
                                    onBlur={handleSaveService}
                                    autoFocus
                                    size="middle"
                                    style={{
                                      background: isDarkMode ? '#1f1f1f' : '#fff',
                                      borderColor: COLORS.PRIMARY,
                                      color: isDarkMode ? '#fff' : undefined,
                                      fontSize: 14,
                                    }}
                                    maxLength={50}
                                  />
                                ) : (
                                  <Text 
                                    style={{ 
                                      color: activeTab === service.id
                                        ? COLORS.PRIMARY
                                        : (isDarkMode ? '#fff' : undefined),
                                      fontWeight: activeTab === service.id ? 600 : 500,
                                      fontSize: 14,
                                      lineHeight: 1.35,
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                    }}
                                    ellipsis
                                  >
                                    {service.isLocked && (
                                      <LockOutlined style={{ color: '#ffffff', fontSize: 13, flexShrink: 0 }} />
                                    )}
                                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                      {service.name}
                                    </span>
                                  </Text>
                                )}
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                                {editingService === service.id ? (
                                  <>
                                    <Button 
                                      type="text" 
                                      icon={<CheckOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSaveService();
                                      }}
                                      style={actionBtnStyle('#ffffff')}
                                    />
                                    <Button 
                                      type="text" 
                                      icon={<CloseOutlined />}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancelEdit();
                                      }}
                                      style={actionBtnStyle('#ffffff')}
                                    />
                                  </>
                                ) : (
                                  <>
                                    <Tooltip title="Edit service">
                                      <Button 
                                        type="text" 
                                        icon={<EditOutlined style={{ fontSize: 14 }} />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleServiceEdit(service);
                                        }}
                                        style={actionBtnStyle()}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.opacity = '1';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.opacity = '0.72';
                                        }}
                                      />
                                    </Tooltip>
                                    
                                    <Tooltip title="Remove service">
                                      <Button 
                                        type="text" 
                                        icon={<CloseOutlined style={{ fontSize: 14 }} />}
                                        onClick={(e) => handleDeleteService(service.id, e)}
                                        style={actionBtnStyle('#ffffff')}
                                        onMouseEnter={(e) => {
                                          e.currentTarget.style.opacity = '1';
                                        }}
                                        onMouseLeave={(e) => {
                                          e.currentTarget.style.opacity = '0.72';
                                        }}
                                      />
                                    </Tooltip>
                                  </>
                                )}
                              </div>
                            </div>
                            </ServiceContextMenu>
                            
                            {dragOverIndex === serviceIndex && draggedIndex !== serviceIndex && (
                              <div style={{
                                height: 2,
                                background: COLORS.PRIMARY,
                                margin: '2px 8px',
                                borderRadius: 1,
                              }} />
                            )}
                          </div>
                        ))}
                        </div>

                        <Button
                          type="text"
                          icon={<PlusOutlined style={{ fontSize: 14 }} />}
                          onClick={() => {
                            onWorkspaceClick(workspace.id);
                            onAddService();
                          }}
                          style={{ 
                            width: '100%',
                            height: 40,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            color: isDarkMode ? 'rgba(255,255,255,0.65)' : '#8c8c8c',
                            fontSize: 14,
                            fontWeight: 500,
                            marginTop: 8,
                            border: `1px dashed ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
                            borderRadius: 10,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = COLORS.PRIMARY;
                            e.currentTarget.style.background = isDarkMode
                              ? 'rgba(255,255,255,0.16)'
                              : COLORS.PRIMARY_SOFT;
                            e.currentTarget.style.borderColor = COLORS.PRIMARY;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = isDarkMode ? 'rgba(255,255,255,0.65)' : '#8c8c8c';
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.borderColor = isDarkMode ? COLORS.APP_BORDER : '#d9d9d9';
                          }}
                        >
                          Add service
                        </Button>
                      </div>
                    )}
                  </div>
                  );
                })}
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#f0f0f0'}` }}>
            <Button
              type="text"
              icon={<PlusOutlined style={{ fontSize: 14 }} />}
              onClick={onAddWorkspace}
              style={{ 
                width: '100%',
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: isDarkMode ? 'rgba(255,255,255,0.65)' : '#8c8c8c',
                fontSize: 14,
                fontWeight: 500,
                border: `1px dashed ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
                borderRadius: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = COLORS.PRIMARY;
                e.currentTarget.style.background = isDarkMode
                  ? 'rgba(255,255,255,0.16)'
                  : COLORS.PRIMARY_SOFT;
                e.currentTarget.style.borderColor = COLORS.PRIMARY;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isDarkMode ? 'rgba(255,255,255,0.65)' : '#8c8c8c';
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.borderColor = isDarkMode ? COLORS.APP_BORDER : '#d9d9d9';
              }}
            >
              Add new workspace
            </Button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
};

export default WorkspaceDetailSidebar;