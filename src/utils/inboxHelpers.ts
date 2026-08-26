/** Cross-window / webview event to open a chat from the unified inbox. */

export const OPEN_INBOX_CHAT_EVENT = 'tn-open-inbox-chat';

export function dispatchOpenInboxChat(serviceId: string, chatName: string) {
  window.dispatchEvent(
    new CustomEvent(OPEN_INBOX_CHAT_EVENT, {
      detail: { serviceId, chatName },
    })
  );
}

export function onOpenInboxChat(
  callback: (data: { serviceId: string; chatName: string }) => void
) {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<{ serviceId: string; chatName: string }>).detail;
    if (!detail?.serviceId || !detail?.chatName) return;
    callback(detail);
  };
  window.addEventListener(OPEN_INBOX_CHAT_EVENT, handler);
  return () => window.removeEventListener(OPEN_INBOX_CHAT_EVENT, handler);
}

export function formatInboxTime(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function platformLabel(iconType?: string) {
  if (!iconType) return 'Other';
  if (iconType === 'gmail') return 'Gmail';
  if (iconType === 'whatsapp') return 'WhatsApp';
  if (iconType === 'instagram') return 'Instagram';
  if (iconType === 'telegram') return 'Telegram';
  if (iconType === 'messenger') return 'Messenger';
  if (iconType === 'discord') return 'Discord';
  if (iconType === 'slack') return 'Slack';
  return iconType.charAt(0).toUpperCase() + iconType.slice(1);
}

export type InboxPlatformTab = 'all' | 'whatsapp' | 'gmail' | 'other';

export type InboxSortId =
  | 'newest'
  | 'oldest'
  | 'most-unread'
  | 'name-asc'
  | 'account';

export type InboxGroupBy = 'none' | 'platform' | 'account' | 'workspace';
