import type { MenuProps } from 'antd';
import { Dropdown } from 'antd';
import type { ReactElement } from 'react';
import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  LockOutlined,
  ReloadOutlined,
  StopOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import type { ServiceTab } from '../types';

export interface ServiceContextMenuActions {
  onReload?: (serviceId: string, serviceName: string) => void;
  onEdit?: (service: ServiceTab) => void;
  onToggle?: (serviceId: string, serviceName: string, currentlyDisabled: boolean) => void;
  onLock?: (service: ServiceTab) => void;
  onRemoveLock?: (service: ServiceTab) => void;
  onRemove?: (service: ServiceTab, e: React.MouseEvent) => void;
}

interface ServiceContextMenuProps {
  service: ServiceTab;
  isDisabled?: boolean;
  isDarkMode?: boolean;
  showReload?: boolean;
  showToggle?: boolean;
  children: ReactElement;
  actions: ServiceContextMenuActions;
}

/** Ant Design context menu with consistent @ant-design/icons. */
export function ServiceContextMenu({
  service,
  isDisabled = false,
  isDarkMode = false,
  showReload = true,
  showToggle = true,
  children,
  actions,
}: ServiceContextMenuProps) {
  const items: MenuProps['items'] = [];

  if (showReload && actions.onReload) {
    items.push({
      key: 'reload',
      label: 'Reload Service',
      icon: <ReloadOutlined style={{ fontSize: 15, color: '#ffffff' }} />,
      disabled: isDisabled,
      onClick: () => actions.onReload?.(service.id, service.name),
    });
  }

  if (actions.onEdit) {
    items.push({
      key: 'edit',
      label: 'Edit Service',
      icon: <EditOutlined style={{ fontSize: 14, color: '#fa8c16' }} />,
      onClick: () => actions.onEdit?.(service),
    });
  }

  if (showToggle && actions.onToggle) {
    items.push({
      key: 'toggle',
      label: isDisabled ? 'Enable Service' : 'Disable Service',
      icon: isDisabled ? (
        <EyeOutlined style={{ fontSize: 14, color: '#ffffff' }} />
      ) : (
        <StopOutlined style={{ fontSize: 14, color: '#ffffff' }} />
      ),
      onClick: () => actions.onToggle?.(service.id, service.name, isDisabled),
    });
  }

  items.push({
    key: 'lock',
    label: service.isLocked ? 'Remove Lock' : 'Lock Service',
    icon: service.isLocked ? (
      <UnlockOutlined style={{ fontSize: 14, color: '#ffffff' }} />
    ) : (
      <LockOutlined style={{ fontSize: 14, color: '#ffffff' }} />
    ),
    onClick: () => {
      if (service.isLocked) actions.onRemoveLock?.(service);
      else actions.onLock?.(service);
    },
  });

  items.push({ type: 'divider' });

  if (actions.onRemove) {
    items.push({
      key: 'remove',
      label: 'Remove Service',
      icon: <DeleteOutlined style={{ fontSize: 14 }} />,
      danger: true,
      onClick: ({ domEvent }) => {
        actions.onRemove?.(service, domEvent as unknown as React.MouseEvent);
      },
    });
  }

  return (
    <Dropdown
      menu={{ items }}
      trigger={['contextMenu']}
      placement="bottomLeft"
      overlayStyle={{
        minWidth: 180,
      }}
      overlayClassName={isDarkMode ? 'service-context-menu-dark' : undefined}
    >
      {children}
    </Dropdown>
  );
}
