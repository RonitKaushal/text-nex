import { useMemo, useState, type CSSProperties } from 'react';
import { Empty, Input, Select } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { ServiceLogo } from '../components/common';
import { useInboxOptional, type InboxItem } from '../context/InboxContext';
import { FONT_FAMILY } from '../constants';
import type { ServiceTab, Workspace } from '../types';
import {
  dispatchOpenInboxChat,
  formatInboxTime,
  platformLabel,
  type InboxGroupBy,
  type InboxPlatformTab,
  type InboxSortId,
} from '../utils/inboxHelpers';

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

/** Professional mail-style unified unread inbox. */
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
  const [groupBy, setGroupBy] = useState<InboxGroupBy>('none');
  const [query, setQuery] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const text = isDarkMode ? '#f2f2f2' : '#111111';
  const muted = isDarkMode ? '#8a8a8a' : '#6b6b6b';
  const faint = isDarkMode ? '#5a5a5a' : '#9a9a9a';
  const border = isDarkMode ? '#222222' : '#e8e8e8';
  const surface = isDarkMode ? '#0a0a0a' : '#ffffff';
  const rowHover = isDarkMode ? '#141414' : '#f7f7f7';
  const controlBg = isDarkMode ? '#111111' : '#f5f5f5';

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
    for (const item of enriched) {
      accountIds.add(item.serviceId);
      if (item.platformKey === 'whatsapp') byPlatform.whatsapp += 1;
      else if (item.platformKey === 'gmail') byPlatform.gmail += 1;
      else byPlatform.other += 1;
    }
    return {
      total: enriched.length,
      accounts: accountIds.size,
      byPlatform,
    };
  }, [enriched]);

  const accountOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of enriched) map.set(item.serviceId, item.accountLabel);
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
      return [{ key: 'all', title: null as string | null, items: filtered }];
    }
    const map = new Map<string, EnrichedItem[]>();
    for (const item of filtered) {
      let key = 'other';
      if (groupBy === 'platform') key = item.platformKey;
      else if (groupBy === 'account') key = item.serviceId;
      else key = item.workspace?.id || item.service?.workspaceId || 'unknown';
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

  const selectCss: CSSProperties = {
    minWidth: 158,
  };

  const pillControl: CSSProperties = {
    borderRadius: 999,
    height: 40,
  };

  return (
    <div
      className="tn-inbox-page"
      style={{
        height: '100%',
        overflow: 'auto',
        fontFamily: FONT_FAMILY,
        color: text,
        boxSizing: 'border-box',
        background: isDarkMode ? '#000000' : '#f4f4f4',
      }}
    >
      <div
        style={{
          width: '100%',
          padding: '24px 28px 40px',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <header
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 22,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 36,
                fontWeight: 650,
                letterSpacing: '-0.03em',
                color: text,
                lineHeight: 1.15,
              }}
            >
              Inbox
            </h1>
            <p style={{ margin: '8px 0 0', color: muted, fontSize: 16, lineHeight: 1.4 }}>
              {counts.total === 0
                ? 'No unread messages synced yet'
                : `${filtered.length} of ${counts.total} unread · ${counts.accounts} account${
                    counts.accounts === 1 ? '' : 's'
                  }`}
            </p>
          </div>
        </header>

        {/* Tabs — fully rounded pills */}
        <nav className="tn-inbox-tabs">
          {tabs.map((tab) => {
            const active = platformTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`tn-inbox-tab${active ? ' is-active' : ''}`}
                onClick={() => setPlatformTab(tab.id)}
              >
                <span className="tn-inbox-tab__label">{tab.label}</span>
                <span className="tn-inbox-tab__count">{tab.count}</span>
              </button>
            );
          })}
        </nav>

        {/* Controls — circular rounded */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Input
            allowClear
            size="large"
            prefix={<SearchOutlined style={{ color: faint, fontSize: 16 }} />}
            placeholder="Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: '1 1 220px',
              maxWidth: 320,
              background: controlBg,
              borderColor: border,
              borderRadius: 999,
              fontSize: 15,
              ...pillControl,
            }}
          />
          <Select
            size="large"
            value={accountFilter}
            onChange={setAccountFilter}
            style={{ ...selectCss, ...pillControl }}
            popupClassName="tn-inbox-rounded-select"
            options={[{ value: 'all', label: 'All accounts' }, ...accountOptions]}
            popupMatchSelectWidth={false}
          />
          <Select
            size="large"
            value={workspaceFilter}
            onChange={setWorkspaceFilter}
            style={{ ...selectCss, ...pillControl }}
            options={[
              { value: 'all', label: 'All workspaces' },
              ...workspaces.map((w) => ({ value: w.id, label: w.name })),
            ]}
            popupMatchSelectWidth={false}
          />
          <Select
            size="large"
            value={sortBy}
            onChange={(v) => setSortBy(v)}
            style={{ ...selectCss, ...pillControl }}
            options={[
              { value: 'newest', label: 'Newest' },
              { value: 'oldest', label: 'Oldest' },
              { value: 'most-unread', label: 'Most unread' },
              { value: 'name-asc', label: 'Name A–Z' },
              { value: 'account', label: 'By account' },
            ]}
            popupMatchSelectWidth={false}
          />
          <Select
            size="large"
            value={groupBy}
            onChange={(v) => setGroupBy(v)}
            style={{ ...selectCss, ...pillControl }}
            options={[
              { value: 'none', label: 'No grouping' },
              { value: 'platform', label: 'Group by platform' },
              { value: 'account', label: 'Group by account' },
              { value: 'workspace', label: 'Group by workspace' },
            ]}
            popupMatchSelectWidth={false}
          />
        </div>

        <style>{`
          .tn-inbox-page .tn-inbox-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-bottom: 18px;
          }
          .tn-inbox-page .tn-inbox-tab {
            appearance: none !important;
            -webkit-appearance: none !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            display: inline-flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 8px !important;
            height: 40px !important;
            min-height: 40px !important;
            max-height: 40px !important;
            padding: 0 16px !important;
            border-radius: 999px !important;
            border: 1px solid ${border} !important;
            background: ${isDarkMode ? '#141414' : '#ffffff'} !important;
            color: ${text} !important;
            cursor: pointer;
            font-family: ${FONT_FAMILY} !important;
            font-size: 15px !important;
            font-weight: 600 !important;
            line-height: 1 !important;
            vertical-align: middle;
            transform: none !important;
          }
          .tn-inbox-page .tn-inbox-tab.is-active {
            border-color: ${isDarkMode ? '#ffffff' : '#111111'};
            background: ${isDarkMode ? '#ffffff' : '#111111'};
            color: ${isDarkMode ? '#111111' : '#ffffff'};
          }
          .tn-inbox-page .tn-inbox-tab__label,
          .tn-inbox-page .tn-inbox-tab__count {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            height: 22px;
            margin: 0;
            padding: 0;
            line-height: 1;
          }
          .tn-inbox-page .tn-inbox-tab__label {
            /* Gilroy glyph ink sits high vs geometric center */
            transform: translateY(2px);
          }
          .tn-inbox-page .tn-inbox-tab__count {
            min-width: 22px;
            padding: 0 7px;
            border-radius: 999px;
            font-size: 12px;
            font-weight: 700;
            color: ${muted};
            background: ${isDarkMode ? '#222222' : '#ebebeb'};
          }
          .tn-inbox-page .tn-inbox-tab.is-active .tn-inbox-tab__count {
            color: ${isDarkMode ? '#ffffff' : '#111111'};
            background: ${isDarkMode ? '#111111' : '#ffffff'};
          }
          .tn-inbox-page .ant-select-selector {
            border-radius: 999px !important;
            height: 40px !important;
            align-items: center !important;
            font-size: 15px !important;
          }
          .tn-inbox-page .ant-input-affix-wrapper {
            border-radius: 999px !important;
            font-size: 15px !important;
          }
          .tn-inbox-page .ant-select-selection-item,
          .tn-inbox-page .ant-select-selection-placeholder {
            font-size: 15px !important;
            line-height: 38px !important;
          }
        `}</style>

        {/* List */}
        <div
          style={{
            background: surface,
            border: `1px solid ${border}`,
            borderRadius: 20,
            overflow: 'hidden',
            minHeight: 320,
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '72px 24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div style={{ color: muted, fontSize: 16, maxWidth: 360, lineHeight: 1.5 }}>
                    {enriched.length === 0 ? (
                      <>
                        Nothing here yet.
                        <br />
                        Open a WhatsApp or Gmail account once to start syncing unread items.
                      </>
                    ) : (
                      'No messages match your filters.'
                    )}
                  </div>
                }
              />
            </div>
          ) : (
            groups.map((group, gi) => (
              <section key={group.key}>
                {group.title ? (
                  <div
                    style={{
                      padding: '12px 18px 10px',
                      fontSize: 13,
                      fontWeight: 650,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: faint,
                      background: isDarkMode ? '#080808' : '#fafafa',
                      borderTop: gi === 0 ? 'none' : `1px solid ${border}`,
                      borderBottom: `1px solid ${border}`,
                    }}
                  >
                    {group.title}
                    <span style={{ fontWeight: 500, marginLeft: 8, color: muted }}>
                      {group.items.length}
                    </span>
                  </div>
                ) : null}

                {group.items.map((item, idx) => {
                  const isHover = hoveredId === item.id;
                  const showDivider = idx < group.items.length - 1;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openItem(item)}
                      onMouseEnter={() => setHoveredId(item.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        display: 'flex',
                        width: '100%',
                        alignItems: 'center',
                        gap: 16,
                        padding: '16px 18px',
                        border: 'none',
                        borderBottom: showDivider ? `1px solid ${border}` : 'none',
                        background: isHover ? rowHover : 'transparent',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: FONT_FAMILY,
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {item.icon ? (
                          <img
                            src={item.icon}
                            alt=""
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              display: 'block',
                              background: isDarkMode ? '#1a1a1a' : '#eee',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              borderRadius: '50%',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isDarkMode ? '#1a1a1a' : '#eee',
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
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            overflow: 'hidden',
                            background: surface,
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
                            size={13}
                          />
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 12,
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 17,
                              fontWeight: 600,
                              color: text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.chatName}
                          </span>
                          <span
                            style={{
                              flexShrink: 0,
                              fontSize: 13,
                              color: faint,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatInboxTime(item.updatedAt)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            color: muted,
                            marginBottom: 4,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.accountLabel}
                          {item.workspace?.name ? ` · ${item.workspace.name}` : ''}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: 14,
                              color: faint,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.preview || 'New message'}
                          </span>
                          <span
                            style={{
                              flexShrink: 0,
                              minWidth: 26,
                              height: 26,
                              padding: '0 8px',
                              borderRadius: 999,
                              background: isDarkMode ? '#ffffff' : '#111111',
                              color: isDarkMode ? '#111111' : '#ffffff',
                              fontSize: 13,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {item.unread > 99 ? '99+' : item.unread}
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </section>
            ))
          )}
        </div>

        <p
          style={{
            margin: '16px 4px 0',
            fontSize: 14,
            color: faint,
            lineHeight: 1.45,
          }}
        >
          Tip: open each WhatsApp or Gmail account once so unread items can appear here.
        </p>
      </div>
    </div>
  );
}
