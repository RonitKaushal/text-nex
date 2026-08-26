import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type InboxChatPayload = {
  name: string;
  unread: number;
  preview?: string;
  icon?: string;
};

export type InboxItem = {
  id: string;
  serviceId: string;
  chatName: string;
  unread: number;
  preview: string;
  icon: string;
  updatedAt: number;
};

interface InboxContextValue {
  items: InboxItem[];
  totalChats: number;
  totalUnread: number;
  setServiceInbox: (serviceId: string, chats: InboxChatPayload[]) => void;
  clearServiceInbox: (serviceId: string) => void;
  clearAll: () => void;
}

const InboxContext = createContext<InboxContextValue | null>(null);

function itemId(serviceId: string, chatName: string) {
  return `${serviceId}::${chatName}`;
}

export function InboxProvider({ children }: { children: ReactNode }) {
  const [byService, setByService] = useState<Record<string, InboxItem[]>>({});

  const setServiceInbox = useCallback((serviceId: string, chats: InboxChatPayload[]) => {
    if (!serviceId) return;
    const now = Date.now();
    const nextItems: InboxItem[] = (chats || [])
      .map((c) => {
        const chatName = String(c?.name || '').trim();
        const unread = Math.max(0, Math.floor(Number(c?.unread) || 0));
        if (!chatName || unread <= 0) return null;
        return {
          id: itemId(serviceId, chatName),
          serviceId,
          chatName,
          unread,
          preview: String(c?.preview || '').trim().slice(0, 160),
          icon: String(c?.icon || '').slice(0, 8192),
          updatedAt: now,
        } satisfies InboxItem;
      })
      .filter(Boolean) as InboxItem[];

    setByService((prev) => {
      const prevList = prev[serviceId] || [];
      if (nextItems.length === 0) {
        if (!prevList.length) return prev;
        const next = { ...prev };
        delete next[serviceId];
        return next;
      }

      // Preserve updatedAt when chat content is unchanged so sort is stable
      const prevMap = new Map(prevList.map((i) => [i.chatName, i]));
      const merged = nextItems.map((item) => {
        const old = prevMap.get(item.chatName);
        if (
          old &&
          old.unread === item.unread &&
          old.preview === item.preview &&
          old.icon === item.icon
        ) {
          return old;
        }
        return item;
      });

      const same =
        prevList.length === merged.length &&
        prevList.every((p, i) => {
          const m = merged[i];
          return (
            p.chatName === m.chatName &&
            p.unread === m.unread &&
            p.preview === m.preview &&
            p.updatedAt === m.updatedAt
          );
        });
      if (same) return prev;
      return { ...prev, [serviceId]: merged };
    });
  }, []);

  const clearServiceInbox = useCallback((serviceId: string) => {
    if (!serviceId) return;
    setByService((prev) => {
      if (!prev[serviceId]) return prev;
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setByService({}), []);

  useEffect(() => {
    const unsub = window.electronAPI?.onServiceUnreadInbox?.((data) => {
      if (!data?.serviceId) return;
      setServiceInbox(data.serviceId, data.chats || []);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [setServiceInbox]);

  const items = useMemo(() => {
    const all = Object.values(byService).flat();
    all.sort((a, b) => {
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return b.unread - a.unread || a.chatName.localeCompare(b.chatName);
    });
    return all;
  }, [byService]);

  const totalChats = items.length;
  const totalUnread = useMemo(
    () => items.reduce((sum, i) => sum + (i.unread || 0), 0),
    [items]
  );

  const value = useMemo(
    () => ({
      items,
      totalChats,
      totalUnread,
      setServiceInbox,
      clearServiceInbox,
      clearAll,
    }),
    [items, totalChats, totalUnread, setServiceInbox, clearServiceInbox, clearAll]
  );

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) throw new Error('useInbox must be used within InboxProvider');
  return ctx;
}

export function useInboxOptional() {
  return useContext(InboxContext);
}
