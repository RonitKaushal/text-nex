import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Typography, message } from 'antd';
import { LockOutlined, PlusOutlined } from '@ant-design/icons';
import Login from './pages/Login';
import Profile, { type AccountSection } from './pages/Profile';
import AvailableServices from './pages/AvailableServices';
import Dashboard from './pages/Dashboard';
import UnreadInboxPage from './pages/UnreadInbox';
import ServiceRenderer from './components/ServiceRenderer';
import WorkspaceCreator from './components/WorkspaceCreator';
import LockServiceModal from './components/LockServiceModal';
import { MainLayout } from './layouts/MainLayout';
import {
  AppLoader,
  EmptyState,
  ErrorState,
  RenewLicenseModal,
  ServiceSwitcherOverlay,
  GlobalSearchOverlay,
  SplitDropPane,
  SplitServicePicker,
} from './components/common';
import { useAuth } from './context/AuthContext';
import { useTheme } from './context/ThemeContext';
import { useUnread } from './context/UnreadContext';
import { useServiceChromeOptional } from './context/ServiceChromeContext';
import { useVoiceControl } from './context/VoiceControlContext';
import { useWorkspaceStore } from './hooks/useWorkspaceStore';
import { useModal } from './hooks/useModal';
import { APP_BG_GRADIENT, COLORS, MESSAGES, MAX_WORKSPACES } from './constants';
import {
  gridStyleForLayout,
  slotCountForLayout,
  type SplitLayoutId,
} from './constants/splitLayouts';
import type { ServiceTab } from './types';
import { createLockHash, verifyServiceLockPassword } from './utils/serviceLock';
import { MESSAGING_ICON_TYPES } from './utils/notificationInject';
import './App.css';

const { Text, Title } = Typography;

function AppShell() {
  const { isDarkMode, toggleTheme, setDarkMode } = useTheme();
  const {
    isAuthenticated,
    isCheckingLicense,
    licenseExpired,
    licenseError,
    userProfile,
    checkLicenseStatus,
    handleLoginSuccess,
    renewLicense,
  } = useAuth();

  const { clearUnread, unreadById } = useUnread();
  const chrome = useServiceChromeOptional();
  const voice = useVoiceControl();

  const store = useWorkspaceStore({
    licenseExpired,
    isDarkMode,
    setDarkMode,
  });

  const [showWorkspaceCreator, setShowWorkspaceCreator] = useState(false);
  const [workspaceCreatorDraftName, setWorkspaceCreatorDraftName] = useState('');
  const [accountSection, setAccountSection] = useState<AccountSection>('profile');
  const [splitView, setSplitView] = useState(false);
  /** Which panes hold which service ids (null = empty picker). */
  const [splitSlots, setSplitSlots] = useState<(string | null)[]>([null, null]);
  const [splitLayout, setSplitLayout] = useState<SplitLayoutId>('vertical-2');
  /** Split remembered while user opens another service fullscreen (restore on return). */
  const [pausedSplit, setPausedSplit] = useState<{
    slots: (string | null)[];
    layout: SplitLayoutId;
  } | null>(null);
  const [poppedOutIds, setPoppedOutIds] = useState<Set<string>>(() => new Set());
  const lockModal = useModal<ServiceTab>();
  const unlockModal = useModal<ServiceTab>();
  /** 'access' = open service for this visit; 'remove' = permanently remove lock */
  const [unlockMode, setUnlockMode] = useState<'access' | 'remove'>('access');
  /** Service id unlocked for current visit only (cleared when leaving the tab) */
  const [sessionUnlockedId, setSessionUnlockedId] = useState<string | null>(null);
  const [renewVisible, setRenewVisible] = useState(false);
  const [renewKey, setRenewKey] = useState('');
  const [renewLoading, setRenewLoading] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherIndex, setSwitcherIndex] = useState(0);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const switcherOpenRef = useRef(false);
  const switcherIndexRef = useRef(0);
  /** Only mount webviews after first open — cuts idle RAM when many services exist */
  const [mountedServiceIds, setMountedServiceIds] = useState<Set<string>>(
    () => new Set()
  );

  const switchableServices = useMemo(
    () =>
      store.services.filter(
        (s) => !store.disabledServices.has(s.id) && !poppedOutIds.has(s.id)
      ),
    [store.services, store.disabledServices, poppedOutIds]
  );
  const switchableRef = useRef(switchableServices);
  const activeTabRef = useRef(store.activeTab);
  const splitSlotsRef = useRef(splitSlots);
  switchableRef.current = switchableServices;
  activeTabRef.current = store.activeTab;
  splitSlotsRef.current = splitSlots;

  // Phone-app style: leaving a locked service re-locks it for the next open
  useEffect(() => {
    if (sessionUnlockedId && store.activeTab !== sessionUnlockedId) {
      setSessionUnlockedId(null);
    }
  }, [store.activeTab, sessionUnlockedId]);

  // Lazy-mount: activate tab + split panes only (unopened services use ~0 webview RAM)
  useEffect(() => {
    setMountedServiceIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      const consider = (id: string | null | undefined) => {
        if (!id || id === 'login' || id === 'profile' || id === 'available-services') {
          return;
        }
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      };
      consider(store.activeTab);
      for (const id of splitSlots) consider(id);
      return changed ? next : prev;
    });
  }, [store.activeTab, splitSlots]);

  // Unmount idle services so Chromium guests free RAM (messaging kept longer for badges)
  useEffect(() => {
    const isHeavy = (s: { kind?: string; type?: string; iconType?: string }) =>
      s.kind === 'bulk-wa' ||
      s.kind === 'lead-gen' ||
      s.type === 'bulk-whatsapp' ||
      s.type === 'lead-gen' ||
      s.iconType === 'bulk-whatsapp' ||
      s.iconType === 'lead-gen';

    const isMessaging = (s: { iconType?: string; type?: string }) =>
      MESSAGING_ICON_TYPES.includes(String(s.iconType || s.type || '').toLowerCase());

    const idleServices = store.services.filter(
      (s) => s.id !== store.activeTab && !splitSlots.includes(s.id)
    );
    if (idleServices.length === 0) return;

    const timers = idleServices.map((svc) => {
      // Heavy embeds: sleep fast. Messaging: stay warm for unread badges.
      // Everything else: medium sleep.
      const delay = isHeavy(svc)
        ? 20_000
        : isMessaging(svc)
          ? 15 * 60_000
          : 90_000;
      return window.setTimeout(() => {
        if (activeTabRef.current === svc.id) return;
        if (splitSlotsRef.current.includes(svc.id)) return;
        setMountedServiceIds((prev) => {
          if (!prev.has(svc.id)) return prev;
          const next = new Set(prev);
          next.delete(svc.id);
          return next;
        });
      }, delay);
    });

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [store.activeTab, splitSlots, store.services]);

  // Note: we do NOT force-clear the badge on open. Messaging guests (WhatsApp,
  // Telegram, …) report their real unread count continuously, so the badge
  // stays accurate and only drops as the user actually reads chats.
  // For non-messaging services (no live watcher), clear once on open.
  useEffect(() => {
    const id = store.activeTab;
    if (
      !id ||
      id === 'login' ||
      id === 'profile' ||
      id === 'available-services'
    ) {
      return;
    }
    const svc = store.services.find((s) => s.id === id);
    const isMessaging = MESSAGING_ICON_TYPES.includes(
      String(svc?.iconType || svc?.type || '').toLowerCase()
    );
    if (isMessaging) return; // let the live watcher drive the count
    const t = window.setTimeout(() => clearUnread(id), 300);
    return () => window.clearTimeout(t);
  }, [store.activeTab, store.services, clearUnread]);

  useEffect(() => {
    if (!licenseExpired) return;
    setMountedServiceIds(new Set());
  }, [licenseExpired]);

  // License expired → instantly stop services (unmount webviews, exit split)
  useEffect(() => {
    if (!licenseExpired) return;
    setSplitView(false);
    setSplitSlots([null, null]);
    setPausedSplit(null);
    setRenewVisible(false);
    window.licenseExpired = true;
    if (store.activeTab === 'login') {
      store.setActiveTab('profile');
      setAccountSection('profile');
    }
  }, [licenseExpired, store.activeTab, store.setActiveTab]);

  useEffect(() => {
    const unsubOut = window.electronAPI?.onServicePoppedOut?.((serviceId) => {
      setPoppedOutIds((prev) => {
        const next = new Set(prev);
        next.add(serviceId);
        return next;
      });
      if (store.activeTab === serviceId) {
        const other = store.services.find((s) => s.id !== serviceId && !poppedOutIds.has(s.id));
        if (other) store.setActiveTab(other.id);
      }
    });
    const unsubBack = window.electronAPI?.onServiceBroughtBack?.((serviceId) => {
      setPoppedOutIds((prev) => {
        const next = new Set(prev);
        next.delete(serviceId);
        return next;
      });
      store.setActiveTab(serviceId);
    });
    return () => {
      if (typeof unsubOut === 'function') unsubOut();
      if (typeof unsubBack === 'function') unsubBack();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once
  }, []);

  const serviceComponents = useMemo(() => {
    const map = new Map<string, React.ReactNode>();
    const openInSplit = new Set(splitSlots.filter(Boolean) as string[]);
    store.services.forEach((service) => {
      if (!mountedServiceIds.has(service.id)) return;
      const active =
        store.activeTab === service.id ||
        (splitView && openInSplit.has(service.id));
      map.set(
        service.id,
        <ServiceRenderer
          key={service.id}
          service={service}
          isDarkMode={isDarkMode}
          isActive={active}
          isDisabled={store.disabledServices.has(service.id) || licenseExpired}
          notificationsEnabled={store.notificationsEnabled}
        />
      );
    });
    return map;
  }, [
    store.services,
    isDarkMode,
    store.activeTab,
    store.disabledServices,
    store.notificationsEnabled,
    splitView,
    splitSlots,
    licenseExpired,
    mountedServiceIds,
  ]);

  const handleReloadService = (serviceId: string) => {
    window.electronAPI?.reloadService?.(serviceId);
  };

  const placeServiceInSlot = (slotIndex: number, serviceId: string) => {
    if (licenseExpired) return;
    const service = store.services.find((s) => s.id === serviceId);
    if (!service) return;
    if (store.disabledServices.has(serviceId)) {
      message.warning('That service is disabled');
      return;
    }
    if (service.isLocked && sessionUnlockedId !== service.id) {
      requestServiceAccess(service);
      return;
    }

    setSplitSlots((prev) => {
      const next = [...prev];
      // If service already in another slot, clear that slot (move)
      const existing = next.findIndex((id) => id === serviceId);
      if (existing >= 0 && existing !== slotIndex) {
        next[existing] = null;
      }
      next[slotIndex] = serviceId;
      return next;
    });
    store.setActiveTab(serviceId);
  };

  const renderServiceBody = (service: ServiceTab) => {
    if (poppedOutIds.has(service.id)) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDarkMode ? APP_BG_GRADIENT : '#fff',
            flexDirection: 'column',
            gap: 12,
            color: isDarkMode ? '#e8eaed' : undefined,
          }}
        >
          <Text style={{ fontSize: 16 }}>{service.name} is open in a new window</Text>
          <Button
            type="primary"
            onClick={() => void window.electronAPI?.bringBackService?.(service.id)}
          >
            Bring back
          </Button>
        </div>
      );
    }
    if (store.disabledServices.has(service.id)) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDarkMode ? APP_BG_GRADIENT : '#fff',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              borderRadius: 16,
              background: isDarkMode ? COLORS.APP_BG_PANEL : '#f9f9f9',
              border: `2px dashed ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
            }}
          >
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>🚫</div>
            <Text
              style={{
                fontSize: 18,
                display: 'block',
                marginBottom: 8,
                color: isDarkMode ? '#fff' : '#262626',
              }}
            >
              Service Disabled
            </Text>
            <Text type="secondary" style={{ fontSize: 14 }}>
              {service.name} is currently disabled.
            </Text>
            {!licenseExpired && (
              <div style={{ marginTop: 16 }}>
                <Button
                  type="primary"
                  onClick={() => store.handleToggleServiceStatus(service.id, true)}
                >
                  Enable Service
                </Button>
              </div>
            )}
          </div>
        </div>
      );
    }
    if (service.isLocked && sessionUnlockedId !== service.id) {
      return (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDarkMode ? APP_BG_GRADIENT : '#fff',
            flexDirection: 'column',
          }}
        >
          <div style={{ textAlign: 'center', padding: 40, maxWidth: 360 }}>
            <LockOutlined style={{ fontSize: 64, color: '#ff4d4f', marginBottom: 16 }} />
            <Title
              level={4}
              style={{ color: isDarkMode ? '#fff' : undefined, marginBottom: 8 }}
            >
              {service.name} is locked
            </Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
              Enter your password to open this service.
            </Text>
            <Button
              type="primary"
              icon={<LockOutlined />}
              size="large"
              onClick={() => requestServiceAccess(service)}
            >
              Enter Password
            </Button>
          </div>
        </div>
      );
    }
    return serviceComponents.get(service.id) ?? null;
  };

  const occupiedSlotIds = splitSlots.filter(Boolean) as string[];

  const clearSplit = () => {
    setSplitView(false);
    setSplitSlots([null, null]);
    setPausedSplit(null);
  };

  const enterSplitLayout = (layout: SplitLayoutId) => {
    const count = slotCountForLayout(layout);
    const next: (string | null)[] = Array.from({ length: count }, () => null);
    // Keep current service in first slot
    const current =
      store.services.find((s) => s.id === store.activeTab)?.id ??
      store.services[0]?.id ??
      null;
    next[0] = current;
    setPausedSplit(null);
    setSplitLayout(layout);
    setSplitSlots(next);
    setSplitView(true);
  };

  /**
   * Sidebar / switcher selection.
   * In split: empty slot → fill; service in split → stay; other service → pause split & fullscreen.
   * After pause: clicking a service from the paused split restores it.
   */
  const selectService = (id: string) => {
    if (licenseExpired) {
      store.setActiveTab(id);
      return;
    }

    if (splitView) {
      const emptyIdx = splitSlots.findIndex((s) => s == null);
      if (emptyIdx >= 0 && !splitSlots.includes(id)) {
        placeServiceInSlot(emptyIdx, id);
        return;
      }

      if (splitSlots.includes(id)) {
        store.setActiveTab(id);
        return;
      }

      // e.g. WA1|IG split → click WA2 → fullscreen WA2, remember split
      setPausedSplit({ slots: [...splitSlots], layout: splitLayout });
      setSplitView(false);
      store.setActiveTab(id);
      return;
    }

    if (pausedSplit?.slots.includes(id)) {
      setSplitSlots(pausedSplit.slots);
      setSplitLayout(pausedSplit.layout);
      setSplitView(true);
      setPausedSplit(null);
      store.setActiveTab(id);
      return;
    }

    store.setActiveTab(id);
  };
  const selectServiceRef = useRef(selectService);
  selectServiceRef.current = selectService;

  // Voice control → workspace / service / dictate actions
  useEffect(() => {
    voice.registerHandlers({
      getWorkspaces: () => store.workspaces,
      getActiveWorkspaceId: () => store.activeWorkspace,
      getActiveService: () =>
        store.workspaces
          .flatMap((w) => w.services)
          .find((s) => s.id === store.activeTab) || null,
      openWorkspaceById: (id) => {
        store.setActiveWorkspace(id);
        if (!store.workspaceDetailVisible) {
          store.setWorkspaceDetailVisible(true);
        }
        store.setActiveTab('');
      },
      openServiceById: (id) => {
        selectServiceRef.current(id);
      },
      createWorkspace: (name) => {
        if (store.workspaces.length >= MAX_WORKSPACES) return false;
        const ok = store.addWorkspace(name);
        if (ok !== false) {
          setShowWorkspaceCreator(false);
          setWorkspaceCreatorDraftName('');
        }
        return ok !== false;
      },
      openWorkspaceCreator: () => {
        setWorkspaceCreatorDraftName('');
        setShowWorkspaceCreator(true);
      },
      setWorkspaceCreatorName: (name) => {
        setWorkspaceCreatorDraftName(name);
        setShowWorkspaceCreator(true);
      },
      openAvailableServices: () => {
        store.setActiveTab('add-service');
      },
      openSettings: () => {
        setAccountSection('settings');
        store.setActiveTab('profile');
      },
      openProfile: () => {
        setAccountSection('profile');
        store.setActiveTab('profile');
      },
      openSearch: (query) => {
        setGlobalSearchQuery(query || '');
        setGlobalSearchOpen(true);
      },
      reloadActive: () => {
        if (store.activeTab) {
          window.electronAPI?.reloadService?.(store.activeTab);
        }
      },
      goBack: () => {
        store.setActiveTab('');
        store.setWorkspaceDetailVisible(true);
      },
      insertText: async (text, send) => {
        const active = store.workspaces
          .flatMap((w) => w.services)
          .find((s) => s.id === store.activeTab);
        if (!chrome?.insertDictationText) return false;
        return chrome.insertDictationText(text, {
          send: !!send,
          whatsapp: active?.iconType === 'whatsapp',
        });
      },
    });
    return () => voice.registerHandlers(null);
  }, [
    voice,
    chrome,
    store.workspaces,
    store.activeWorkspace,
    store.activeTab,
    store.workspaceDetailVisible,
    store.setActiveWorkspace,
    store.setWorkspaceDetailVisible,
    store.setActiveTab,
    store.addWorkspace,
  ]);

  const handleRenewLicense = async () => {
    if (!renewKey.trim()) {
      message.error('Please enter a license key');
      return;
    }
    setRenewLoading(true);
    try {
      const result = await renewLicense(renewKey.trim());
      if (result.success) {
        const expiry = result.licenseExpiry
          ? new Date(result.licenseExpiry).toLocaleDateString()
          : '';
        message.success(
          expiry
            ? `License renewed successfully! New expiry: ${expiry}`
            : 'License renewed successfully!'
        );
        setRenewVisible(false);
        setRenewKey('');
      } else {
        message.error(result.message || 'Failed to renew license');
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      message.error(err.response?.data?.message || err.message || 'Failed to renew license');
    } finally {
      setRenewLoading(false);
    }
  };

  const requestServiceAccess = (service: ServiceTab) => {
    setUnlockMode('access');
    unlockModal.show(service);
  };

  const requestRemoveLock = (service: ServiceTab) => {
    setUnlockMode('remove');
    unlockModal.show(service);
  };

  /** Returns true if click should be blocked (password modal opened). */
  const checkServiceLock = (service: ServiceTab): boolean => {
    if (!service.isLocked) return false;
    requestServiceAccess(service);
    return true;
  };

  const closeServiceSwitcher = useCallback(() => {
    switcherOpenRef.current = false;
    setSwitcherOpen(false);
  }, []);

  const activateSwitcherService = useCallback(
    (service: ServiceTab) => {
      closeServiceSwitcher();
      if (service.isLocked && sessionUnlockedId !== service.id) {
        requestServiceAccess(service);
        return;
      }
      selectServiceRef.current(service.id);
    },
    [closeServiceSwitcher, sessionUnlockedId]
  );

  const commitServiceSwitcher = useCallback(() => {
    if (!switcherOpenRef.current) return;
    const list = switchableRef.current;
    const service = list[switcherIndexRef.current];
    if (!service) {
      closeServiceSwitcher();
      return;
    }
    activateSwitcherService(service);
  }, [activateSwitcherService, closeServiceSwitcher]);

  const cycleServiceSwitcher = useCallback((direction: 1 | -1) => {
    const list = switchableRef.current;
    if (list.length < 2) return;

    if (!switcherOpenRef.current) {
      const cur = list.findIndex((s) => s.id === activeTabRef.current);
      const start = cur >= 0 ? cur : 0;
      const next = (start + direction + list.length) % list.length;
      switcherIndexRef.current = next;
      setSwitcherIndex(next);
      switcherOpenRef.current = true;
      setSwitcherOpen(true);
      return;
    }

    const next = (switcherIndexRef.current + direction + list.length) % list.length;
    switcherIndexRef.current = next;
    setSwitcherIndex(next);
  }, []);

  useEffect(() => {
    const unsub = window.electronAPI?.onServiceSwitcher?.((payload) => {
      if (payload.action === 'cycle') {
        cycleServiceSwitcher(payload.direction === -1 ? -1 : 1);
        // Ensure host can receive Ctrl keyup (and modifier polling works)
        window.setTimeout(() => {
          try {
            (
              document.querySelector('[aria-label="Switch service"]') as HTMLElement | null
            )?.focus?.({ preventScroll: true });
          } catch {
            /* ignore */
          }
        }, 0);
      } else if (payload.action === 'release') {
        // Defer so a same-tick cycle always wins over a racing release
        queueMicrotask(() => commitServiceSwitcher());
      } else if (payload.action === 'cancel') {
        closeServiceSwitcher();
      }
    });
    return () => {
      unsub?.();
    };
  }, [cycleServiceSwitcher, commitServiceSwitcher, closeServiceSwitcher]);

  // Ctrl+K global search (from main process — works inside webviews)
  useEffect(() => {
    const unsub = window.electronAPI?.onGlobalSearch?.((payload) => {
      if (payload.action === 'close') {
        setGlobalSearchOpen(false);
        return;
      }
      setGlobalSearchOpen((open) => (payload.action === 'open' ? true : !open));
    });
    return () => {
      unsub?.();
    };
  }, []);

  // Always listen in renderer too (backup when webview ate Ctrl keyup)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.ctrlKey || e.metaKey) && !e.altKey) {
        if (!window.electronAPI?.onGlobalSearch) {
          e.preventDefault();
          setGlobalSearchOpen((v) => !v);
        }
      }
      if (e.key === 'Tab' && e.ctrlKey && !e.altKey && !e.metaKey) {
        if (!window.electronAPI?.onServiceSwitcher) {
          e.preventDefault();
          cycleServiceSwitcher(e.shiftKey ? -1 : 1);
        }
      } else if (e.key === 'Escape' && switcherOpenRef.current) {
        e.preventDefault();
        closeServiceSwitcher();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!switcherOpenRef.current) return;
      if (
        e.key === 'Control' ||
        e.key === 'Meta' ||
        e.code === 'ControlLeft' ||
        e.code === 'ControlRight'
      ) {
        e.preventDefault();
        commitServiceSwitcher();
        return;
      }
      // Both released together
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        commitServiceSwitcher();
      }
    };
    // If Ctrl is already up, any mouse move while overlay is open confirms
    const onModifierProbe = (e: MouseEvent | KeyboardEvent) => {
      if (!switcherOpenRef.current) return;
      if (typeof e.getModifierState !== 'function') return;
      if (!e.getModifierState('Control') && !e.getModifierState('Meta')) {
        commitServiceSwitcher();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousemove', onModifierProbe, true);
    window.addEventListener('mouseup', onModifierProbe, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousemove', onModifierProbe, true);
      window.removeEventListener('mouseup', onModifierProbe, true);
    };
  }, [cycleServiceSwitcher, commitServiceSwitcher, closeServiceSwitcher]);

  const handleLockConfirm = async (password: string) => {
    if (!lockModal.data) return;
    try {
      const hash = await createLockHash(password);
      store.setServiceLock(lockModal.data.id, true, hash);
      setSessionUnlockedId(null);
      message.success(`🔒 ${lockModal.data.name} locked. Password required every time you open it.`);
      lockModal.hide();
    } catch {
      message.error('Failed to lock service');
    }
  };

  const handleUnlockConfirm = async (password: string) => {
    if (!unlockModal.data) return;
    const service = unlockModal.data;
    const result = await verifyServiceLockPassword(service, password);

    if (!result.ok) {
      message.error('❌ Incorrect password. Please try again.');
      return;
    }

    // Migrate legacy plaintext → hash
    if (result.needsMigration) {
      const hash = await createLockHash(password);
      store.setServiceLock(service.id, true, hash);
    }

    if (unlockMode === 'remove') {
      store.setServiceLock(service.id, false);
      setSessionUnlockedId(null);
      message.success(`🔓 Lock removed from ${service.name}`);
      unlockModal.hide();
      return;
    }

    // Access for this visit only — lock stays on
    setSessionUnlockedId(service.id);
    store.setActiveTab(service.id);
    message.success(`Unlocked for this session`);
    unlockModal.hide();
  };

  if (!store.ready || isCheckingLicense) {
    return (
      <AppLoader
        message={
          isAuthenticated ? MESSAGES.VERIFYING_LICENSE : MESSAGES.LOADING_APP
        }
        subtitle={
          isAuthenticated
            ? 'Checking your account access…'
            : 'Preparing TextNexus…'
        }
        isDarkMode={isDarkMode}
      />
    );
  }

  if (!isAuthenticated) {
    return <Login onSwitchTab={() => undefined} onLoginSuccess={handleLoginSuccess} />;
  }

  if (licenseError === 'network') {
    return (
      <ErrorState
        title={MESSAGES.NETWORK_ISSUE_TITLE}
        description={MESSAGES.NETWORK_ISSUE_BODY}
        onRetry={() => checkLicenseStatus()}
        retryLabel="Retry verification"
        isDarkMode={isDarkMode}
      />
    );
  }

  return (
    <MainLayout
      isDarkMode={isDarkMode}
      hideSidebars={false}
      workspaces={store.workspaces}
      activeWorkspace={store.activeWorkspace}
      workspaceDetailVisible={store.workspaceDetailVisible}
      notificationsEnabled={store.notificationsEnabled}
      services={store.services}
      activeTab={store.activeTab}
      disabledServices={store.disabledServices}
      onWorkspaceClick={(id) => {
        store.setActiveWorkspace(id);
        if (!store.workspaceDetailVisible) {
          store.setWorkspaceDetailVisible(true);
        }
      }}
      onAddWorkspace={() => {
        if (store.workspaces.length >= MAX_WORKSPACES) {
          message.warning(`Maximum ${MAX_WORKSPACES} workspaces allowed`);
          return;
        }
        setShowWorkspaceCreator(true);
      }}
      onToggleDetail={() =>
        store.setWorkspaceDetailVisible(!store.workspaceDetailVisible)
      }
      onShowSettings={() => {
        setAccountSection('settings');
        store.setActiveTab('profile');
      }}
      onToggleNotifications={store.setNotificationsEnabled}
      onServiceClick={selectService}
      onAddService={() => store.setActiveTab('add-service')}
      onRemoveService={store.removeService}
      onRenameService={store.renameService}
      onUpdateService={store.updateService}
      onReorderServices={store.reorderServices}
      onToggleServiceStatus={store.handleToggleServiceStatus}
      onReloadService={handleReloadService}
      onLockService={(service) => lockModal.show(service)}
      onUnlockService={requestRemoveLock}
      checkServiceLock={checkServiceLock}
      onRemoveWorkspace={store.removeWorkspace}
      onRenameWorkspace={store.renameWorkspace}
      onCloseDetail={() => store.setWorkspaceDetailVisible(false)}
      onShowProfile={() => {
        setAccountSection('profile');
        store.setActiveTab('profile');
      }}
      onShowDashboard={() => {
        store.setActiveTab('dashboard');
      }}
      onOpenInbox={() => {
        store.setActiveTab('inbox');
      }}
      splitView={splitView}
      onToggleSplitView={() => {
        if (splitView) {
          clearSplit();
        } else {
          enterSplitLayout('vertical-2');
        }
      }}
      onEnterSplitView={(layout) => {
        enterSplitLayout(layout);
      }}
      onExitSplitView={clearSplit}
      onManageWorkspaces={() => store.setWorkspaceDetailVisible(true)}
      onOpenSearch={(query) => {
        setGlobalSearchQuery(query || '');
        setGlobalSearchOpen(true);
      }}
      searchOpen={globalSearchOpen}
    >
      {store.activeTab === 'profile' ? (
        <Profile
          isDarkMode={isDarkMode}
          section={accountSection}
          onSectionChange={setAccountSection}
          onToggleTheme={toggleTheme}
          notificationsEnabled={store.notificationsEnabled}
          onToggleNotifications={store.setNotificationsEnabled}
          notificationsAfterClose={store.notificationsAfterClose}
          onToggleNotificationsAfterClose={store.setNotificationsAfterClose}
          onClearAllData={() => void store.clearAllData()}
        />
      ) : store.activeTab === 'inbox' ? (
        <UnreadInboxPage
          isDarkMode={isDarkMode}
          workspaces={store.workspaces}
          onOpenItem={(service) => {
            if (service.workspaceId && service.workspaceId !== store.activeWorkspace) {
              store.setActiveWorkspace(service.workspaceId);
            }
            selectService(service.id);
          }}
        />
      ) : licenseExpired ? (
        <EmptyState
          title={MESSAGES.LICENSE_EXPIRED_TITLE}
          description={MESSAGES.LICENSE_EXPIRED_BODY}
          actionLabel="Re-New"
          onAction={() => setRenewVisible(true)}
          isDarkMode={isDarkMode}
          titleColor="#ff4d4f"
        >
          <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 8 }}>
            Renewal Contact Us:{' '}
            <a href="https://wa.me/919173503958">+91 9173503958</a>
          </Text>
        </EmptyState>
      ) : store.activeTab === 'add-service' ? (
        <AvailableServices
          isDarkMode={isDarkMode}
          onSelectService={(type, name, options) => {
            store.addService(type, name, options);
          }}
        />
      ) : store.workspaces.length === 0 ? (
        <EmptyState
          title={MESSAGES.WELCOME_TITLE}
          description="Create your first workspace to get started, then add messaging services."
          actionLabel="Create workspace"
          actionIcon={<PlusOutlined />}
          onAction={() => setShowWorkspaceCreator(true)}
          isDarkMode={isDarkMode}
        />
      ) : !splitView &&
        (store.activeTab === 'dashboard' ||
          store.activeTab === '' ||
          !store.workspaces.some((w) =>
            w.services.some((s) => s.id === store.activeTab)
          )) ? (
        <Dashboard
          isDarkMode={isDarkMode}
          workspaces={store.workspaces}
          activeWorkspace={store.activeWorkspace}
          mountedServiceIds={mountedServiceIds}
          disabledServices={store.disabledServices}
          onOpenService={(service) => {
            if (service.workspaceId && service.workspaceId !== store.activeWorkspace) {
              store.setActiveWorkspace(service.workspaceId);
            }
            selectService(service.id);
          }}
          onOpenWorkspace={(workspaceId) => {
            store.setActiveWorkspace(workspaceId);
            if (!store.workspaceDetailVisible) {
              store.setWorkspaceDetailVisible(true);
            }
            const ws = store.workspaces.find((w) => w.id === workspaceId);
            const first = ws?.services.find((s) => !store.disabledServices.has(s.id));
            if (first) {
              selectService(first.id);
            } else {
              store.setActiveTab('dashboard');
            }
          }}
          onAddWorkspace={() => {
            if (store.workspaces.length >= MAX_WORKSPACES) {
              message.warning(`Maximum ${MAX_WORKSPACES} workspaces allowed`);
              return;
            }
            setShowWorkspaceCreator(true);
          }}
          onAddService={() => store.setActiveTab('add-service')}
          onOpenSearch={() => {
            setGlobalSearchQuery('');
            setGlobalSearchOpen(true);
          }}
          onShowProfile={() => {
            setAccountSection('profile');
            store.setActiveTab('profile');
          }}
        />
      ) : (
        <div
          style={{
            height: '100%',
            display: splitView ? 'flex' : 'block',
            minHeight: 0,
          }}
        >
          {splitView ? (
            <>
              <div
                style={{
                  ...gridStyleForLayout(splitLayout),
                  height: '100%',
                  width: '100%',
                  background: isDarkMode ? COLORS.APP_BORDER : '#d9d9d9',
                }}
              >
                {splitSlots.map((serviceId, slotIndex) => {
                  const service = serviceId
                    ? store.services.find((s) => s.id === serviceId)
                    : undefined;
                  return (
                    <SplitDropPane
                      key={`slot-${slotIndex}`}
                      isDarkMode={isDarkMode}
                      onDropService={(id) => placeServiceInSlot(slotIndex, id)}
                    >
                      {service ? (
                        renderServiceBody(service)
                      ) : (
                        <SplitServicePicker
                          services={store.services}
                          occupiedIds={occupiedSlotIds}
                          isDarkMode={isDarkMode}
                          disabledServices={store.disabledServices}
                          onSelect={(id) => placeServiceInSlot(slotIndex, id)}
                          onDropService={(id) => placeServiceInSlot(slotIndex, id)}
                        />
                      )}
                    </SplitDropPane>
                  );
                })}
              </div>
              {/* Keep previously opened services mounted but hidden (lazy — never opened = no webview) */}
              {store.services.map((service) => {
                if (occupiedSlotIds.includes(service.id)) return null;
                if (!mountedServiceIds.has(service.id)) return null;
                return (
                  <div key={service.id} style={{ display: 'none' }}>
                    {serviceComponents.get(service.id)}
                  </div>
                );
              })}
            </>
          ) : (
            store.services.map((service) => {
              const visible = store.activeTab === service.id;
              if (!visible && !mountedServiceIds.has(service.id)) return null;
              return (
                <div
                  key={service.id}
                  style={{
                    height: '100%',
                    display: visible ? 'block' : 'none',
                    position: 'relative',
                  }}
                >
                  {renderServiceBody(service)}
                </div>
              );
            })
          )}
        </div>
      )}

      <WorkspaceCreator
        visible={showWorkspaceCreator}
        initialName={workspaceCreatorDraftName}
        onClose={() => {
          setShowWorkspaceCreator(false);
          setWorkspaceCreatorDraftName('');
        }}
        onCreateWorkspace={(name) => {
          const ok = store.addWorkspace(name);
          if (ok === false) {
            message.warning(`Maximum ${MAX_WORKSPACES} workspaces allowed`);
            return;
          }
          setShowWorkspaceCreator(false);
          setWorkspaceCreatorDraftName('');
        }}
        isDarkMode={isDarkMode}
      />

      <LockServiceModal
        visible={lockModal.open}
        serviceName={lockModal.data?.name || ''}
        isLocked={false}
        onCancel={lockModal.hide}
        onConfirm={(password) => {
          void handleLockConfirm(password);
        }}
      />

      <LockServiceModal
        visible={unlockModal.open}
        serviceName={unlockModal.data?.name || ''}
        isLocked
        mode={unlockMode}
        onCancel={unlockModal.hide}
        onConfirm={(password) => {
          void handleUnlockConfirm(password);
        }}
      />

      <RenewLicenseModal
        open={renewVisible}
        licenseKey={renewKey}
        loading={renewLoading}
        currentExpiry={userProfile?.activeLicense?.expireAt}
        isDarkMode={isDarkMode}
        onKeyChange={setRenewKey}
        onCancel={() => setRenewVisible(false)}
        onSubmit={() => void handleRenewLicense()}
      />

      <ServiceSwitcherOverlay
        open={switcherOpen}
        services={switchableServices}
        selectedIndex={switcherIndex}
        isDarkMode={isDarkMode}
        unreadById={unreadById}
        onHighlight={(index) => {
          switcherIndexRef.current = index;
          setSwitcherIndex(index);
        }}
        onSelect={(id) => {
          const service = switchableServices.find((s) => s.id === id);
          if (service) activateSwitcherService(service);
        }}
        onCancel={closeServiceSwitcher}
      />

      <GlobalSearchOverlay
        open={globalSearchOpen}
        workspaces={store.workspaces}
        services={store.services}
        activeWorkspaceName={
          store.workspaces.find((w) => w.id === store.activeWorkspace)?.name
        }
        initialQuery={globalSearchQuery}
        isDarkMode={isDarkMode}
        onClose={() => {
          setGlobalSearchOpen(false);
          setGlobalSearchQuery('');
        }}
        onSelectWorkspace={(id) => {
          setGlobalSearchOpen(false);
          setGlobalSearchQuery('');
          store.setActiveWorkspace(id);
          store.setWorkspaceDetailVisible(true);
        }}
        onSelectService={(id, workspaceId) => {
          setGlobalSearchOpen(false);
          setGlobalSearchQuery('');
          if (workspaceId && workspaceId !== store.activeWorkspace) {
            store.setActiveWorkspace(workspaceId);
          } else {
            const ws = store.workspaces.find((w) =>
              w.services?.some((s) => s.id === id)
            );
            if (ws && ws.id !== store.activeWorkspace) {
              store.setActiveWorkspace(ws.id);
            }
          }
          const service = store.workspaces
            .flatMap((w) => w.services)
            .find((s) => s.id === id);
          if (service?.isLocked && sessionUnlockedId !== service.id) {
            requestServiceAccess(service);
            return;
          }
          selectService(id);
        }}
        onAction={(item) => {
          setGlobalSearchOpen(false);
          setGlobalSearchQuery('');
          if (item.action === 'add-service') {
            store.setActiveTab('available-services');
          } else if (item.action === 'profile') {
            setAccountSection('profile');
            store.setActiveTab('profile');
          } else if (item.action === 'settings') {
            setAccountSection('settings');
            store.setActiveTab('profile');
          } else if (item.action === 'guide') {
            setAccountSection('guide');
            store.setActiveTab('profile');
          }
        }}
      />
    </MainLayout>
  );
}

export default function App() {
  return <AppShell />;
}
