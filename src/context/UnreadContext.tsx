import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'textnexus_unread_by_id';

interface UnreadContextValue {
  unreadById: Record<string, number>;
  setUnread: (serviceId: string, count: number) => void;
  clearUnread: (serviceId: string) => void;
  totalUnread: number;
}

const UnreadContext = createContext<UnreadContextValue | null>(null);

function formatBadge(n: number): string {
  if (n <= 0) return '';
  if (n > 99) return '99+';
  return String(n);
}

function loadPersisted(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Math.floor(Number(v) || 0);
      if (n > 0) out[k] = n;
    }
    return out;
  } catch {
    return {};
  }
}

export { formatBadge };

export function UnreadProvider({ children }: { children: ReactNode }) {
  const [unreadById, setUnreadById] = useState<Record<string, number>>(loadPersisted);

  const setUnread = useCallback((serviceId: string, count: number) => {
    if (!serviceId) return;
    const n = Math.max(0, Math.floor(Number(count) || 0));

    setUnreadById((prev) => {
      const prevN = prev[serviceId] || 0;
      if (n === 0 && !prevN) return prev;
      if (n === prevN) return prev;
      // Always allow decreases immediately (user read a chat)
      if (n === 0) {
        const next = { ...prev };
        delete next[serviceId];
        return next;
      }
      return { ...prev, [serviceId]: n };
    });
  }, []);

  const clearUnread = useCallback((serviceId: string) => {
    if (!serviceId) return;
    setUnreadById((prev) => {
      if (!prev[serviceId]) return prev;
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
  }, []);

  const totalUnread = useMemo(
    () => Object.values(unreadById).reduce((a, b) => a + b, 0),
    [unreadById]
  );

  // Persist so badges survive brief remounts / HMR / sleep cycles
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(unreadById));
    } catch {
      /* ignore */
    }
  }, [unreadById]);

  // Guest webviews → main → renderer
  useEffect(() => {
    const unsub = window.electronAPI?.onServiceUnread?.((data) => {
      if (!data?.serviceId) return;
      setUnread(data.serviceId, data.count ?? 0);
    });
    return () => {
      unsub?.();
    };
  }, [setUnread]);

  // Windows / macOS dock/taskbar badge
  useEffect(() => {
    void window.electronAPI?.setAppBadgeCount?.(totalUnread);
  }, [totalUnread]);

  const value = useMemo(
    () => ({ unreadById, setUnread, clearUnread, totalUnread }),
    [unreadById, setUnread, clearUnread, totalUnread]
  );

  return (
    <UnreadContext.Provider value={value}>{children}</UnreadContext.Provider>
  );
}

export function useUnread() {
  const ctx = useContext(UnreadContext);
  if (!ctx) throw new Error('useUnread must be used within UnreadProvider');
  return ctx;
}

export function useUnreadOptional() {
  return useContext(UnreadContext);
}
