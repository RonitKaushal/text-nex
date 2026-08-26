import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { BrowserTabItem } from '../types/browserTab';

/** Max in-app browser tabs per service (home + extras). */
export const MAX_BROWSER_TABS = 6;

interface ServiceTabsState {
  tabs: BrowserTabItem[];
  activeTabId: string;
  tabBarVisible: boolean;
}

interface ServiceChromeContextValue {
  browserTabs: BrowserTabItem[];
  setBrowserTabs: Dispatch<SetStateAction<BrowserTabItem[]>>;
  activeBrowserTabId: string;
  setActiveBrowserTabId: Dispatch<SetStateAction<string>>;
  tabBarVisible: boolean;
  setTabBarVisible: Dispatch<SetStateAction<boolean>>;
  webviewRef: RefObject<any> | null;
  setWebviewRef: (ref: RefObject<any> | null) => void;
  selectBrowserTab: (id: string) => void;
  closeBrowserTab: (id: string) => void;
  openNewBrowserTab: (homeUrl: string, title: string, kind?: 'webview' | 'ssh') => boolean;
  findInPage: (text: string) => void;
  stopFindInPage: () => void;
  clearServiceChrome: () => void;
  registerServiceHome: (serviceId: string, url: string, title: string) => void;
}

const ServiceChromeContext = createContext<ServiceChromeContextValue | null>(null);

const emptyState = (): ServiceTabsState => ({
  tabs: [],
  activeTabId: '',
  tabBarVisible: false,
});

export function ServiceChromeProvider({ children }: { children: ReactNode }) {
  /** Tabs are kept per service so switching WhatsApp ↔ Instagram does not wipe them. */
  const [tabsByService, setTabsByService] = useState<Record<string, ServiceTabsState>>({});
  const [activeServiceId, setActiveServiceId] = useState('');
  const [webviewRef, setWebviewRefState] = useState<RefObject<any> | null>(null);
  const activeServiceIdRef = useRef(activeServiceId);
  activeServiceIdRef.current = activeServiceId;

  const setWebviewRef = useCallback((ref: RefObject<any> | null) => {
    setWebviewRefState(ref);
  }, []);

  const current = activeServiceId ? tabsByService[activeServiceId] : undefined;
  const browserTabs = current?.tabs ?? [];
  const activeBrowserTabId = current?.activeTabId ?? '';
  const tabBarVisible = current?.tabBarVisible ?? false;

  const patchActiveService = useCallback(
    (patch: (prev: ServiceTabsState) => ServiceTabsState) => {
      const sid = activeServiceIdRef.current;
      if (!sid) return;
      setTabsByService((prev) => {
        const cur = prev[sid] || emptyState();
        return { ...prev, [sid]: patch(cur) };
      });
    },
    []
  );

  const setBrowserTabs: Dispatch<SetStateAction<BrowserTabItem[]>> = useCallback(
    (action) => {
      patchActiveService((cur) => {
        const nextTabs = typeof action === 'function' ? action(cur.tabs) : action;
        return {
          ...cur,
          tabs: nextTabs,
          tabBarVisible: nextTabs.length > 1,
        };
      });
    },
    [patchActiveService]
  );

  const setActiveBrowserTabId: Dispatch<SetStateAction<string>> = useCallback(
    (action) => {
      patchActiveService((cur) => ({
        ...cur,
        activeTabId: typeof action === 'function' ? action(cur.activeTabId) : action,
      }));
    },
    [patchActiveService]
  );

  const setTabBarVisible: Dispatch<SetStateAction<boolean>> = useCallback(
    (action) => {
      patchActiveService((cur) => ({
        ...cur,
        tabBarVisible: typeof action === 'function' ? action(cur.tabBarVisible) : action,
      }));
    },
    [patchActiveService]
  );

  const clearServiceChrome = useCallback(() => {
    activeServiceIdRef.current = '';
    setActiveServiceId('');
  }, []);

  const registerServiceHome = useCallback((serviceId: string, url: string, title: string) => {
    activeServiceIdRef.current = serviceId;
    setActiveServiceId(serviceId);
    setTabsByService((prev) => {
      const existing = prev[serviceId];
      // Restore previous tabs for this service — do not reset
      if (existing && existing.tabs.length > 0) {
        // Cap older sessions that exceeded the limit
        if (existing.tabs.length > MAX_BROWSER_TABS) {
          const trimmed = existing.tabs.slice(0, MAX_BROWSER_TABS);
          const activeStillThere = trimmed.some((t) => t.id === existing.activeTabId);
          return {
            ...prev,
            [serviceId]: {
              tabs: trimmed,
              activeTabId: activeStillThere ? existing.activeTabId : trimmed[0].id,
              tabBarVisible: trimmed.length > 1,
            },
          };
        }
        return prev;
      }
      const homeId = `tab-${serviceId}-home`;
      const isSsh = String(url || '').startsWith('ssh://');
      return {
        ...prev,
        [serviceId]: {
          tabs: [{ id: homeId, url, title, kind: isSsh ? 'ssh' : 'webview' }],
          activeTabId: homeId,
          tabBarVisible: false,
        },
      };
    });
  }, []);

  const selectBrowserTab = useCallback(
    (id: string) => {
      const sid = activeServiceIdRef.current;
      const tabs = sid ? tabsByService[sid]?.tabs : undefined;
      const tab = tabs?.find((t) => t.id === id);
      const webview = webviewRef?.current;
      const isSsh = tab?.kind === 'ssh' || String(tab?.url || '').startsWith('ssh://');
      if (!isSsh && tab && webview && typeof webview.loadURL === 'function') {
        try {
          webview.loadURL(tab.url);
        } catch {
          /* ignore */
        }
      }
      setActiveBrowserTabId(id);
    },
    [tabsByService, webviewRef, setActiveBrowserTabId]
  );

  const closeBrowserTab = useCallback(
    (id: string) => {
      const sid = activeServiceIdRef.current;
      if (!sid) return;

      setTabsByService((prev) => {
        const cur = prev[sid];
        if (!cur || cur.tabs.length <= 1) return prev;

        const idx = cur.tabs.findIndex((t) => t.id === id);
        const nextTabs = cur.tabs.filter((t) => t.id !== id);
        let nextActive = cur.activeTabId;
        if (cur.activeTabId === id) {
          const fallback = nextTabs[Math.max(0, idx - 1)] || nextTabs[0];
          nextActive = fallback?.id || '';
          const webview = webviewRef?.current;
          const isSsh =
            fallback?.kind === 'ssh' || String(fallback?.url || '').startsWith('ssh://');
          if (!isSsh && fallback && webview && typeof webview.loadURL === 'function') {
            try {
              webview.loadURL(fallback.url);
            } catch {
              /* ignore */
            }
          }
        }

        return {
          ...prev,
          [sid]: {
            tabs: nextTabs,
            activeTabId: nextActive,
            tabBarVisible: nextTabs.length > 1,
          },
        };
      });
    },
    [webviewRef]
  );

  const openNewBrowserTab = useCallback(
    (homeUrl: string, title: string, kind?: 'webview' | 'ssh') => {
      const sid = activeServiceIdRef.current;
      const existing = sid ? tabsByService[sid]?.tabs : undefined;
      if ((existing?.length ?? 0) >= MAX_BROWSER_TABS) {
        return false;
      }
      const isSsh = kind === 'ssh' || String(homeUrl || '').startsWith('ssh://');
      const id = `tab-${sid || 'svc'}-${Date.now()}`;
      setBrowserTabs((prev) => {
        if (prev.length >= MAX_BROWSER_TABS) return prev;
        return [...prev, { id, url: homeUrl, title, kind: isSsh ? 'ssh' : kind || 'webview' }];
      });
      setActiveBrowserTabId(id);
      setTabBarVisible(true);
      if (!isSsh) {
        const webview = webviewRef?.current;
        if (webview && typeof webview.loadURL === 'function') {
          try {
            webview.loadURL(homeUrl);
          } catch {
            /* ignore */
          }
        }
      }
      return true;
    },
    [webviewRef, tabsByService, setBrowserTabs, setActiveBrowserTabId, setTabBarVisible]
  );

  const findInPage = useCallback(
    (text: string) => {
      const webview = webviewRef?.current;
      if (!webview || !text.trim()) return;
      try {
        if (typeof webview.findInPage === 'function') {
          webview.findInPage(text.trim());
        } else {
          webview.executeJavaScript(
            `window.find(${JSON.stringify(text.trim())}, false, false, true, false, true, false)`
          );
        }
      } catch {
        /* ignore */
      }
    },
    [webviewRef]
  );

  const stopFindInPage = useCallback(() => {
    const webview = webviewRef?.current;
    if (!webview) return;
    try {
      if (typeof webview.stopFindInPage === 'function') {
        webview.stopFindInPage('clearSelection');
      }
    } catch {
      /* ignore */
    }
  }, [webviewRef]);

  const value = useMemo(
    () => ({
      browserTabs,
      setBrowserTabs,
      activeBrowserTabId,
      setActiveBrowserTabId,
      tabBarVisible,
      setTabBarVisible,
      webviewRef,
      setWebviewRef,
      selectBrowserTab,
      closeBrowserTab,
      openNewBrowserTab,
      findInPage,
      stopFindInPage,
      clearServiceChrome,
      registerServiceHome,
    }),
    [
      browserTabs,
      setBrowserTabs,
      activeBrowserTabId,
      setActiveBrowserTabId,
      tabBarVisible,
      setTabBarVisible,
      webviewRef,
      setWebviewRef,
      selectBrowserTab,
      closeBrowserTab,
      openNewBrowserTab,
      findInPage,
      stopFindInPage,
      clearServiceChrome,
      registerServiceHome,
    ]
  );

  return (
    <ServiceChromeContext.Provider value={value}>{children}</ServiceChromeContext.Provider>
  );
}

export function useServiceChrome() {
  const ctx = useContext(ServiceChromeContext);
  if (!ctx) {
    throw new Error('useServiceChrome must be used within ServiceChromeProvider');
  }
  return ctx;
}

/** Safe hook when provider may be absent (optional). */
export function useServiceChromeOptional() {
  return useContext(ServiceChromeContext);
}
