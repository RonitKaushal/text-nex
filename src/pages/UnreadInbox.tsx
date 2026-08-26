import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { Empty, Input, Select, Typography } from 'antd';
import {
  InboxOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  FilterOutlined,
  MailOutlined,
  MessageOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { ServiceLogo } from '../components/common';
import { useInboxOptional, type InboxItem } from '../context/InboxContext';
import { COLORS, FONT_FAMILY } from '../constants';
import type { ServiceTab, Workspace } from '../types';
import {
  dispatchOpenInboxChat,
  formatInboxTime,
  platformLabel,
  type InboxGroupBy,
  type InboxPlatformTab,
  type InboxSortId,
} from '../utils/inboxHelpers';

const { Text } = Typography;

interface UnreadInboxPageProps {
  isDarkMode: boolean;
  workspaces: Workspace[];
  onOpenItem: (service: ServiceTab, chatName: string) => void;
}

type EnrichedItem = InboxItem & {
  service?: ServiceTab;
  workspace?: Workspace;
  platform: string;
  platformKey: string;
  accountLabel: string;
};

function cardStyle(isDarkMode: boolean): CSSProperties {
  return {
    background: isDarkMode ? 'rgba(22, 29, 43, 0.72)' : 'rgba(255, 255, 255, 0.78)',
    border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : 'rgba(0,0,0,0.06)'}`,
    borderRadius: 16,
    padding: 16,
  };
}

function StatCard({
  label,
  value,
  hint,
  isDarkMode,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  isDarkMode: boolean;
  icon: ReactNode;
}) {
  const muted = isDarkMode ? '#9aa0a6' : '#6b6b6b';
  const text = isDarkMode ? '#e8eaed' : '#1f1f1f';
  return (
    <div style={{ ...cardStyle(isDarkMode), display: 'flex', gap: 12, alignItems: 'center' }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDarkMode ? 'rgba(139,124,246,0.16)' : COLORS.PRIMARY_SOFT,
          color: COLORS.PRIMARY,
          fontSize: 18,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, color: muted, fontWeight: 600, letterSpacing: 0.3 }}>
          {label}
        </div>
        <div style={{ fontSize: 22, fontWeight: 700, color: text, lineHeight: 1.2 }}>{value}</div>
        {hint ? <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>{hint}</div> : null}
      </div>
    </div>
  );
}

/** Full-page unified unread inbox with tabs, filters, and sorting. */
export default function UnreadInboxPage({
  isDarkMode,
  workspaces,
  onOpenItem,
}: UnreadInboxPageProps) {
  const inbox = useInboxOptional();
  const [platformTab, setPlatformTab] = useState<InboxPlatformTab>('all');
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [workspaceFilter, setWorkspaceFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<InboxSortId>('newest');
  const [groupBy, setGroupBy] = useState<InboxGroupBy>('platform');
  const [query, setQuery] = useState('');

  const text = isDarkMode ? '#e8eaed' : '#1f1f1f';
  const muted = isDarkMode ? '#9aa0a6' : '#6b6b6b';
  const border = isDarkMode ? COLORS.APP_BORDER : '#e5e7eb';

  const serviceById = useMemo(() => {
    const map = new Map<string, ServiceTab>();
    for (const ws of workspaces) {
      for (const s of ws.services || []) {
        map.set(s.id, { ...s, workspaceId: s.workspaceId || ws.id });
      }
    }
    return map;
  }, [workspaces]);

  const workspaceById = useMemo(() => {
    const map = new Map<string, Workspace>();
    for (const ws of workspaces) map.set(ws.id, ws);
    return map;
  }, [workspaces]);

  const enriched = useMemo(() => {
    const list = inbox?.items || [];
    const out: EnrichedItem[] = [];
    for (const item of list) {
      const service = serviceById.get(item.serviceId);
      if (!service) continue;
      const workspace =
        workspaceById.get(service.workspaceId) ||
        workspaces.find((w) => (w.services || []).some((s) => s.id === service.id));
      const platformKey =
        service.iconType === 'whatsapp' || service.iconType === 'gmail'
          ? service.iconType
          : 'other';
      const platform = platformLabel(service.iconType);
      const accountName = (service.name || '').trim();
      const accountLabel =
        accountName && accountName.toLowerCase().includes(platform.toLowerCase())
          ? accountName
          : accountName
            ? `${accountName} · ${platform}`
            : platform;
      out.push({
        ...item,
        service,
        workspace,
        platform,
        platformKey,
        accountLabel,
      });
    }
    return out;
  }, [inbox?.items, serviceById, workspaceById, workspaces]);

  const counts = useMemo(() => {
    const byPlatform = { whatsapp: 0, gmail: 0, other: 0 };
    const accountIds = new Set<string>();
    let unreadSum = 0;
    for (const item of enriched) {
      accountIds.add(item.serviceId);
      unreadSum += item.unread || 0;
      if (item.platformKey === 'whatsapp') byPlatform.whatsapp += 1;
      else if (item.platformKey === 'gmail') byPlatform.gmail += 1;
      else byPlatform.other += 1;
    }
    return {
      total: enriched.length,
      accounts: accountIds.size,
      unreadSum,
      byPlatform,
    };
  }, [enriched]);

  const accountOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of enriched) {
      map.set(item.serviceId, item.accountLabel);
    }
    return Array.from(map.entries())
      .map(([id, label]) => ({ value: id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [enriched]);

  const filtered = useMemo(() => {
    let list = [...enriched];
    if (platformTab === 'whatsapp') list = list.filter((i) => i.platformKey === 'whatsapp');
    if (platformTab === 'gmail') list = list.filter((i) => i.platformKey === 'gmail');
    if (platformTab === 'other') list = list.filter((i) => i.platformKey === 'other');
    if (accountFilter !== 'all') list = list.filter((i) => i.serviceId === accountFilter);
    if (workspaceFilter !== 'all') {
      list = list.filter((i) => (i.service?.workspaceId || i.workspace?.id) === workspaceFilter);
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.chatName.toLowerCase().includes(q) ||
          i.preview.toLowerCase().includes(q) ||
          i.accountLabel.toLowerCase().includes(q) ||
          (i.workspace?.name || '').toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      if (sortBy === 'oldest') return a.updatedAt - b.updatedAt;
      if (sortBy === 'most-unread') {
        if (b.unread !== a.unread) return b.unread - a.unread;
        return b.updatedAt - a.updatedAt;
      }
      if (sortBy === 'name-asc') return a.chatName.localeCompare(b.chatName);
      if (sortBy === 'account') {
        const c = a.accountLabel.localeCompare(b.accountLabel);
        if (c !== 0) return c;
        return b.updatedAt - a.updatedAt;
      }
      return b.updatedAt - a.updatedAt;
    });
    return list;
  }, [enriched, platformTab, accountFilter, workspaceFilter, query, sortBy]);

  const groups = useMemo(() => {
    if (groupBy === 'none') {
      return [{ key: 'all', title: 'All unread', items: filtered }];
    }
    const map = new Map<string, EnrichedItem[]>();
    for (const item of filtered) {
      let key = 'other';
      let title = 'Other';
      if (groupBy === 'platform') {
        key = item.platformKey;
        title = item.platform;
      } else if (groupBy === 'account') {
        key = item.serviceId;
        title = item.accountLabel;
      } else if (groupBy === 'workspace') {
        key = item.workspace?.id || item.service?.workspaceId || 'unknown';
        title = item.workspace?.name || 'Workspace';
      }
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      title:
        groupBy === 'platform'
          ? items[0]?.platform || key
          : groupBy === 'account'
            ? items[0]?.accountLabel || key
            : items[0]?.workspace?.name || 'Workspace',
      items,
    }));
  }, [filtered, groupBy]);

  const openItem = (item: EnrichedItem) => {
    if (!item.service) return;
    onOpenItem(item.service, item.chatName);
    window.setTimeout(() => dispatchOpenInboxChat(item.serviceId, item.chatName), 350);
    window.setTimeout(() => dispatchOpenInboxChat(item.serviceId, item.chatName), 1100);
  };

  const tabs: Array<{ id: InboxPlatformTab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.total },
    { id: 'whatsapp', label: 'WhatsApp', count: counts.byPlatform.whatsapp },
    { id: 'gmail', label: 'Gmail', count: counts.byPlatform.gmail },
    { id: 'other', label: 'Other', count: counts.byPlatform.other },
  ];

  const selectStyle: CSSProperties = {
    minWidth: 160,
  };

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '28px clamp(18px, 3.5vw, 48px) 40px',
        fontFamily: FONT_FAMILY,
        color: text,
        boxSizing: 'border-box',
        background: isDarkMode
          ? 'radial-gradient(circle at 10% 0%, rgba(92, 78, 189, 0.2), transparent 28%), radial-gradient(circle at 90% 20%, rgba(234, 67, 53, 0.08), transparent 24%)'
          : 'radial-gradient(circle at 8% 0%, rgba(139, 124, 246, 0.14), transparent 28%), #eef2f7',
      }}
    >
      <div style={{ marginBottom: 22 }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.2,
            color: COLORS.PRIMARY,
            marginBottom: 8,
          }}
        >
          UNIFIED INBOX
        </div>
        <h1
          style={{
            margin: 0,
            fontSize: 32,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: text,
          }}
        >
          Unread across all accounts
        </h1>
        <p style={{ margin: '8px 0 0', color: muted, fontSize: 14, maxWidth: 640, lineHeight: 1.5 }}>
          Every WhatsApp chat and Gmail thread from your workspaces, in one place. Open an account
          once so it can sync — then filter and sort here.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <StatCard
          isDarkMode={isDarkMode}
          icon={<InboxOutlined />}
          label="Unread items"
          value={counts.total}
          hint={`${counts.unreadSum} total badges`}
        />
        <StatCard
          isDarkMode={isDarkMode}
          icon={<AppstoreOutlined />}
          label="Accounts reporting"
          value={counts.accounts}
          hint="Opened at least once"
        />
        <StatCard
          isDarkMode={isDarkMode}
          icon={<MessageOutlined />}
          label="WhatsApp"
          value={counts.byPlatform.whatsapp}
          hint="Chats"
        />
        <StatCard
          isDarkMode={isDarkMode}
          icon={<MailOutlined />}
          label="Gmail"
          value={counts.byPlatform.gmail}
          hint="Threads"
        />
      </div>

      {/* Platform tabs */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        {tabs.map((tab) => {
          const active = platformTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPlatformTab(tab.id)}
              style={{
                border: `1px solid ${active ? COLORS.PRIMARY : border}`,
                background: active
                  ? isDarkMode
                    ? 'rgba(139,124,246,0.18)'
                    : COLORS.PRIMARY_SOFT
                  : isDarkMode
                    ? 'rgba(255,255,255,0.03)'
                    : '#fff',
                color: active ? COLORS.PRIMARY : text,
                borderRadius: 999,
                padding: '8px 14px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 13,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              {tab.label}
              <span
                style={{
                  minWidth: 20,
                  height: 20,
                  borderRadius: 999,
                  padding: '0 6px',
                  background: active ? COLORS.PRIMARY : isDarkMode ? '#2a3545' : '#e5e7eb',
                  color: active ? '#fff' : muted,
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filters / sort */}
      <div
        style={{
          ...cardStyle(isDarkMode),
          display: 'flex',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'center',
          marginBottom: 18,
        }}
      >
        <FilterOutlined style={{ color: muted }} />
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: muted }} />}
          placeholder="Search sender, subject, account…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: '1 1 220px', minWidth: 200, maxWidth: 360 }}
        />
        <Select
          value={accountFilter}
          onChange={setAccountFilter}
          style={selectStyle}
          options={[
            { value: 'all', label: 'All accounts' },
            ...accountOptions,
          ]}
          popupMatchSelectWidth={false}
        />
        <Select
          value={workspaceFilter}
          onChange={setWorkspaceFilter}
          style={selectStyle}
          options={[
            { value: 'all', label: 'All workspaces' },
            ...workspaces.map((w) => ({ value: w.id, label: w.name })),
          ]}
          popupMatchSelectWidth={false}
        />
        <Select
          value={sortBy}
          onChange={(v) => setSortBy(v)}
          style={selectStyle}
          suffixIcon={<SortAscendingOutlined />}
          options={[
            { value: 'newest', label: 'Sort: Newest' },
            { value: 'oldest', label: 'Sort: Oldest' },
            { value: 'most-unread', label: 'Sort: Most unread' },
            { value: 'name-asc', label: 'Sort: Name A–Z' },
            { value: 'account', label: 'Sort: By account' },
          ]}
          popupMatchSelectWidth={false}
        />
        <Select
          value={groupBy}
          onChange={(v) => setGroupBy(v)}
          style={selectStyle}
          options={[
            { value: 'platform', label: 'Group: Platform' },
            { value: 'account', label: 'Group: Account' },
            { value: 'workspace', label: 'Group: Workspace' },
            { value: 'none', label: 'Group: None' },
          ]}
          popupMatchSelectWidth={false}
        />
      </div>

      {filtered.length === 0 ? (
        <div style={{ ...cardStyle(isDarkMode), padding: '48px 24px' }}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: muted }}>
                {enriched.length === 0
                  ? 'No unread items yet. Open each WhatsApp and Gmail account once so TextNexus can sync them here.'
                  : 'No items match these filters. Try All accounts or clear search.'}
              </span>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {groups.map((group) => (
            <section key={group.key}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <Text strong style={{ color: text, fontSize: 15 }}>
                  {group.title}
                </Text>
                <span style={{ color: muted, fontSize: 12 }}>
                  {group.items.length} item{group.items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openItem(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      width: '100%',
                      textAlign: 'left',
                      border: `1px solid ${border}`,
                      borderRadius: 14,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff',
                      color: text,
                    }}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {item.icon ? (
                        <img
                          src={item.icon}
                          alt=""
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            objectFit: 'cover',
                            display: 'block',
                            background: isDarkMode ? '#1a2433' : '#eee',
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isDarkMode ? '#1a2433' : '#eee',
                          }}
                        >
                          <ServiceLogo
                            iconType={item.service?.iconType || 'custom'}
                            customIcon={item.service?.customIcon}
                            url={item.service?.url}
                            size={30}
                          />
                        </div>
                      )}
                      <span
                        style={{
                          position: 'absolute',
                          right: -2,
                          bottom: -2,
                          width: 18,
                          height: 18,
                          borderRadius: 5,
                          overflow: 'hidden',
                          background: isDarkMode ? '#0b1220' : '#fff',
                          border: `1px solid ${border}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <ServiceLogo
                          iconType={item.service?.iconType || 'custom'}
                          customIcon={item.service?.customIcon}
                          url={item.service?.url}
                          size={14}
                        />
                      </span>
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'baseline',
                          marginBottom: 2,
                        }}
                      >
                        <Text
                          strong
                          style={{
                            color: text,
                            fontSize: 14,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {item.chatName}
                        </Text>
                        <span style={{ color: muted, fontSize: 11, flexShrink: 0 }}>
                          {formatInboxTime(item.updatedAt)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: COLORS.PRIMARY,
                          marginBottom: 3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.accountLabel}
                        {item.workspace?.name ? ` · ${item.workspace.name}` : ''}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Text
                          style={{
                            color: muted,
                            fontSize: 12,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {item.preview || 'New message'}
                        </Text>
                        <span
                          style={{
                            flexShrink: 0,
                            minWidth: 22,
                            height: 22,
                            padding: '0 7px',
                            borderRadius: 999,
                            background: COLORS.PRIMARY,
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {item.unread > 99 ? '99+' : item.unread}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
