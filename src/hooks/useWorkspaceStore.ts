import { useCallback, useEffect, useMemo, useState } from 'react';
import { message } from 'antd';
import { storage } from '../utils/storage';
import { MAX_WORKSPACES } from '../constants';
import type { ServiceTab, Workspace } from '../types';

interface UseWorkspaceStoreOptions {
  licenseExpired: boolean;
  isDarkMode: boolean;
  setDarkMode: (value: boolean) => void;
}

export function useWorkspaceStore({
  licenseExpired,
  isDarkMode,
  setDarkMode,
}: UseWorkspaceStoreOptions) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState('');
  const [activeTab, setActiveTab] = useState('');
  const [workspaceDetailVisible, setWorkspaceDetailVisible] = useState(true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState(true);
  const [notificationsAfterClose, setNotificationsAfterCloseState] = useState(true);
  const [disabledServices, setDisabledServices] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [ready, setReady] = useState(false);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    setNotificationsEnabledState(enabled);
    void window.electronAPI?.setNotificationsEnabled?.(enabled);
  }, []);

  const setNotificationsAfterClose = useCallback((enabled: boolean) => {
    setNotificationsAfterCloseState(enabled);
    void window.electronAPI?.setNotificationsAfterClose?.(enabled);
  }, []);

  const currentWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeWorkspace),
    [workspaces, activeWorkspace]
  );
  const services = currentWorkspace?.services || [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [
          storedWorkspaces,
          storedActiveWorkspace,
          storedActiveTab,
          storedDetailVisible,
          storedNotifications,
          storedAfterClose,
          storedDisabled,
          storedCollapsed,
        ] = await Promise.all([
          storage.loadData('workspaces'),
          storage.loadData('activeWorkspace'),
          storage.loadData('activeTab'),
          storage.loadData('workspaceDetailVisible'),
          storage.loadData('notificationsEnabled'),
          storage.loadData('notificationsAfterClose'),
          storage.loadData('disabledServices'),
          storage.loadData('sidebarCollapsed'),
        ]);

        if (cancelled) return;

        if (Array.isArray(storedWorkspaces) && storedWorkspaces.length > 0) {
          setWorkspaces(storedWorkspaces as Workspace[]);
          const wsId =
            typeof storedActiveWorkspace === 'string' &&
            (storedWorkspaces as Workspace[]).some((w) => w.id === storedActiveWorkspace)
              ? storedActiveWorkspace
              : (storedWorkspaces as Workspace[])[0].id;
          setActiveWorkspace(wsId);

          const activeWs = (storedWorkspaces as Workspace[]).find((w) => w.id === wsId);
          if (
            typeof storedActiveTab === 'string' &&
            activeWs?.services.some((s) => s.id === storedActiveTab)
          ) {
            setActiveTab(storedActiveTab);
          } else if (activeWs && activeWs.services.length > 0) {
            setActiveTab(activeWs.services[0].id);
          }
        }

        if (typeof storedDetailVisible === 'boolean') {
          setWorkspaceDetailVisible(storedDetailVisible);
        }
        if (typeof storedNotifications === 'boolean') {
          setNotificationsEnabledState(storedNotifications);
          void window.electronAPI?.setNotificationsEnabled?.(storedNotifications);
        }
        if (typeof storedAfterClose === 'boolean') {
          setNotificationsAfterCloseState(storedAfterClose);
          void window.electronAPI?.setNotificationsAfterClose?.(storedAfterClose);
        } else {
          void window.electronAPI?.setNotificationsAfterClose?.(true);
        }
        if (Array.isArray(storedDisabled)) {
          setDisabledServices(new Set(storedDisabled as string[]));
        }
        if (typeof storedCollapsed === 'boolean') {
          setSidebarCollapsed(storedCollapsed);
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (workspaces.length > 0) void storage.saveData('workspaces', workspaces);
  }, [workspaces]);

  useEffect(() => {
    if (activeWorkspace) void storage.saveData('activeWorkspace', activeWorkspace);
  }, [activeWorkspace]);

  useEffect(() => {
    if (activeTab) void storage.saveData('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!ready) return;
    void storage.saveData('workspaceDetailVisible', workspaceDetailVisible);
  }, [workspaceDetailVisible, ready]);

  useEffect(() => {
    if (!ready) return;
    void storage.saveData('notificationsEnabled', notificationsEnabled);
  }, [notificationsEnabled, ready]);

  useEffect(() => {
    if (!ready) return;
    void storage.saveData('notificationsAfterClose', notificationsAfterClose);
  }, [notificationsAfterClose, ready]);

  useEffect(() => {
    if (!ready) return;
    void storage.saveData('disabledServices', Array.from(disabledServices));
  }, [disabledServices, ready]);

  useEffect(() => {
    if (!ready) return;
    void storage.saveData('sidebarCollapsed', sidebarCollapsed);
  }, [sidebarCollapsed, ready]);

  useEffect(() => {
    document.body.style.background = isDarkMode ? '#141414' : '#f0f2f5';
    document.body.style.color = isDarkMode ? '#fff' : '#000';
  }, [isDarkMode]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const handleSwitch = (_event: unknown, serviceId: string, _chatName?: string) => {
      const target = workspaces.flatMap((w) => w.services).find((s) => s.id === serviceId);
      if (target) {
        setActiveWorkspace(target.workspaceId);
        setActiveTab(serviceId);
      }
    };
    window.electronAPI.onSwitchToService(handleSwitch);
  }, [workspaces]);

  const addService = useCallback(
    (
      type: string,
      customName?: string,
      options?: {
        url?: string;
        customIcon?: string;
        kind?: 'webview' | 'ssh' | 'bulk-wa' | 'lead-gen';
        ssh?: import('../types').SshHostConfig;
      }
    ) => {
      if (licenseExpired || !activeWorkspace) return;
      const timestamp = Date.now();
      const serviceCount =
        services.filter((s) => s.type === type || s.iconType === type).length + 1;
      const isSsh = options?.kind === 'ssh' || type === 'ubuntu' || type === 'ssh-server';
      const isBulkWa = options?.kind === 'bulk-wa' || type === 'bulk-whatsapp';
      const isLeadGen = options?.kind === 'lead-gen' || type === 'lead-gen';
      const newService: ServiceTab = {
        id: `${type}-${timestamp}`,
        name: customName || `${type.charAt(0).toUpperCase()}${type.slice(1)} ${serviceCount}`,
        type: isSsh
          ? 'ssh'
          : isBulkWa
            ? 'bulk-whatsapp'
            : isLeadGen
              ? 'lead-gen'
              : 'whatsapp',
        iconType: type,
        partition: `${type}-${timestamp}`,
        workspaceId: activeWorkspace,
        kind: isSsh
          ? 'ssh'
          : isBulkWa
            ? 'bulk-wa'
            : isLeadGen
              ? 'lead-gen'
              : 'webview',
        ...(options?.url ? { url: options.url } : {}),
        ...(options?.customIcon ? { customIcon: options.customIcon } : {}),
        ...(isSsh && options?.ssh ? { ssh: options.ssh } : {}),
      };
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === activeWorkspace
            ? { ...ws, services: [...ws.services, newService] }
            : ws
        )
      );
      setActiveTab(newService.id);
    },
    [licenseExpired, activeWorkspace, services]
  );

  const addWorkspace = useCallback(
    (name: string): boolean => {
      if (licenseExpired) return false;
      if (workspaces.length >= MAX_WORKSPACES) return false;
      const timestamp = Date.now();
      const newWorkspace: Workspace = {
        id: `workspace-${timestamp}`,
        name: name.trim(),
        services: [],
        createdAt: timestamp,
      };
      setWorkspaces((prev) => {
        if (prev.length >= MAX_WORKSPACES) return prev;
        return [...prev, newWorkspace];
      });
      setActiveWorkspace(newWorkspace.id);
      setActiveTab('');
      return true;
    },
    [licenseExpired, workspaces.length]
  );

  const removeService = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === activeWorkspace
            ? { ...ws, services: ws.services.filter((s) => s.id !== id) }
            : ws
        )
      );
      if (activeTab === id) {
        const remaining = services.filter((s) => s.id !== id);
        setActiveTab(remaining[0]?.id || '');
      }
    },
    [activeWorkspace, activeTab, services]
  );

  const reorderServices = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      setWorkspaces((prev) =>
        prev.map((ws) => {
          if (ws.id !== activeWorkspace) return ws;
          const next = [...ws.services];
          const [dragged] = next.splice(dragIndex, 1);
          next.splice(hoverIndex, 0, dragged);
          return { ...ws, services: next };
        })
      );
    },
    [activeWorkspace]
  );

  const removeWorkspace = useCallback(
    (workspaceId: string) => {
      const remaining = workspaces.filter((w) => w.id !== workspaceId);
      setWorkspaces(remaining);
      if (activeWorkspace === workspaceId) {
        if (remaining.length > 0) {
          setActiveWorkspace(remaining[0].id);
          setActiveTab(remaining[0].services[0]?.id || '');
        } else {
          setActiveWorkspace('');
          setActiveTab('');
        }
      }
    },
    [workspaces, activeWorkspace]
  );

  const renameService = useCallback(
    (id: string, newName: string) => {
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === activeWorkspace
            ? {
                ...ws,
                services: ws.services.map((s) =>
                  s.id === id ? { ...s, name: newName } : s
                ),
              }
            : ws
        )
      );
    },
    [activeWorkspace]
  );

  const updateService = useCallback(
    (id: string, updates: { name?: string; customIcon?: string; url?: string }) => {
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === activeWorkspace
            ? {
                ...ws,
                services: ws.services.map((s) => {
                  if (s.id !== id) return s;
                  const next = { ...s };
                  if (updates.name !== undefined) next.name = updates.name;
                  if (updates.url !== undefined) next.url = updates.url;
                  if (updates.customIcon !== undefined) {
                    if (updates.customIcon === '') {
                      delete next.customIcon;
                    } else {
                      next.customIcon = updates.customIcon;
                    }
                  }
                  return next;
                }),
              }
            : ws
        )
      );
    },
    [activeWorkspace]
  );

  const renameWorkspace = useCallback((workspaceId: string, newName: string) => {
    setWorkspaces((prev) =>
      prev.map((ws) => (ws.id === workspaceId ? { ...ws, name: newName } : ws))
    );
  }, []);

  const handleToggleServiceStatus = useCallback(
    (serviceId: string, enabled: boolean) => {
      if (enabled && licenseExpired) return;
      setDisabledServices((prev) => {
        const next = new Set(prev);
        if (enabled) {
          next.delete(serviceId);
        } else {
          next.add(serviceId);
          if (activeTab === serviceId) {
            const remaining = services.filter((s) => s.id !== serviceId && !next.has(s.id));
            setActiveTab(remaining[0]?.id || '');
          }
        }
        return next;
      });
    },
    [licenseExpired, activeTab, services]
  );

  const setServiceLock = useCallback(
    (serviceId: string, locked: boolean, passwordHash?: string) => {
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === activeWorkspace
            ? {
                ...ws,
                services: ws.services.map((s) => {
                  if (s.id !== serviceId) return s;
                  if (!locked) {
                    const { lockPassword: _p, lockPasswordHash: _h, ...rest } = s;
                    return { ...rest, isLocked: false };
                  }
                  return {
                    ...s,
                    isLocked: true,
                    lockPasswordHash: passwordHash,
                    lockPassword: undefined,
                  };
                }),
              }
            : ws
        )
      );
    },
    [activeWorkspace]
  );

  const clearAllData = useCallback(async () => {
    await storage.clearAll();
    setWorkspaces([]);
    setActiveWorkspace('');
    setActiveTab('');
    setNotificationsEnabledState(true);
    setNotificationsAfterCloseState(true);
    setDisabledServices(new Set());
    void window.electronAPI?.setNotificationsEnabled?.(true);
    void window.electronAPI?.setNotificationsAfterClose?.(true);
  }, []);

  const exportData = useCallback(() => {
    const data = {
      workspaces,
      activeTab,
      activeWorkspace,
      sidebarCollapsed,
      isDarkMode,
      notificationsEnabled,
      notificationsAfterClose,
      disabledServices: Array.from(disabledServices),
      exportDate: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `textnexus-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [
    workspaces,
    activeTab,
    activeWorkspace,
    sidebarCollapsed,
    isDarkMode,
    notificationsEnabled,
    notificationsAfterClose,
    disabledServices,
  ]);

  const importData = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const data = JSON.parse(String(ev.target?.result || '{}'));
          if (data.workspaces) setWorkspaces(data.workspaces);
          if (data.activeWorkspace) setActiveWorkspace(data.activeWorkspace);
          if (data.activeTab) setActiveTab(data.activeTab);
          if (typeof data.sidebarCollapsed === 'boolean') {
            setSidebarCollapsed(data.sidebarCollapsed);
          }
          if (typeof data.isDarkMode === 'boolean') setDarkMode(data.isDarkMode);
          if (typeof data.notificationsEnabled === 'boolean') {
            setNotificationsEnabled(data.notificationsEnabled);
          }
          if (typeof data.notificationsAfterClose === 'boolean') {
            setNotificationsAfterClose(data.notificationsAfterClose);
          }
          if (Array.isArray(data.disabledServices)) {
            setDisabledServices(new Set(data.disabledServices));
          }
          message.success('Data imported successfully');
        } catch {
          message.error('Failed to import data');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }, [setDarkMode, setNotificationsEnabled, setNotificationsAfterClose]);

  return {
    ready,
    workspaces,
    services,
    activeWorkspace,
    setActiveWorkspace,
    activeTab,
    setActiveTab,
    workspaceDetailVisible,
    setWorkspaceDetailVisible,
    notificationsEnabled,
    setNotificationsEnabled,
    notificationsAfterClose,
    setNotificationsAfterClose,
    disabledServices,
    sidebarCollapsed,
    addService,
    addWorkspace,
    removeService,
    reorderServices,
    removeWorkspace,
    renameService,
    updateService,
    renameWorkspace,
    handleToggleServiceStatus,
    setServiceLock,
    clearAllData,
    exportData,
    importData,
  };
}
