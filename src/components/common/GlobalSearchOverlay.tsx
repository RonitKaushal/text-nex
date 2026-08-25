import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Input, Typography } from 'antd';
import {
  SearchOutlined,
  UserOutlined,
  AppstoreOutlined,
  SettingOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons';
import { ServiceLogo } from './ServiceLogo';
import type { ServiceTab, Workspace } from '../../types';
import { getServiceConfig } from '../../utils/serviceConfig';
import { COLORS } from '../../constants';

const { Text } = Typography;
const MUTED = '#9aa8b8';

export type CommandItem =
  | {
      kind: 'workspace';
      id: string;
      label: string;
      hint: string;
      workspaceId: string;
    }
  | {
      kind: 'service';
      id: string;
      label: string;
      hint: string;
      service: ServiceTab;
      workspaceId: string;
      workspaceName: string;
    }
  | {
      kind: 'action';
      id: string;
      label: string;
      hint: string;
      action: 'profile' | 'settings' | 'add-service' | 'guide';
    };

interface GlobalSearchOverlayProps {
  open: boolean;
  workspaces: Workspace[];
  services: ServiceTab[];
  activeWorkspaceName?: string;
  initialQuery?: string;
  isDarkMode?: boolean;
  onClose: () => void;
  onSelectService: (id: string, workspaceId?: string) => void;
  onSelectWorkspace: (id: string) => void;
  onAction: (action: CommandItem & { kind: 'action' }) => void;
}

export function GlobalSearchOverlay({
  open,
  workspaces,
  services,
  activeWorkspaceName,
  initialQuery = '',
  isDarkMode = true,
  onClose,
  onSelectService,
  onSelectWorkspace,
  onAction,
}: GlobalSearchOverlayProps) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const items = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();

    const workspaceItems: CommandItem[] = workspaces
      .filter((ws) => {
        if (!q) return true;
        return ws.name.toLowerCase().includes(q);
      })
      .map((ws) => ({
        kind: 'workspace' as const,
        id: `ws-${ws.id}`,
        label: ws.name,
        hint: `${ws.services?.length || 0} service${(ws.services?.length || 0) === 1 ? '' : 's'}`,
        workspaceId: ws.id,
      }));

    const serviceItems: CommandItem[] = [];
    const seen = new Set<string>();

    for (const ws of workspaces) {
      for (const s of ws.services || []) {
        if (seen.has(s.id)) continue;
        const cfg = getServiceConfig(s.iconType);
        const hay = `${s.name} ${s.type} ${s.iconType} ${cfg?.name || ''} ${ws.name}`.toLowerCase();
        if (q && !hay.includes(q)) continue;
        seen.add(s.id);
        serviceItems.push({
          kind: 'service',
          id: `svc-${s.id}`,
          label: s.name,
          hint: ws.name,
          service: s,
          workspaceId: ws.id,
          workspaceName: ws.name,
        });
      }
    }

    if (serviceItems.length === 0 && services.length) {
      for (const s of services) {
        if (seen.has(s.id)) continue;
        const cfg = getServiceConfig(s.iconType);
        const hay = `${s.name} ${s.type} ${s.iconType} ${cfg?.name || ''}`.toLowerCase();
        if (q && !hay.includes(q)) continue;
        seen.add(s.id);
        serviceItems.push({
          kind: 'service',
          id: `svc-${s.id}`,
          label: s.name,
          hint: activeWorkspaceName || 'Workspace',
          service: s,
          workspaceId: '',
          workspaceName: activeWorkspaceName || 'Workspace',
        });
      }
    }

    const actions: CommandItem[] = [
      {
        kind: 'action',
        id: 'act-add',
        label: 'Add service',
        hint: 'Catalog',
        action: 'add-service',
      },
      {
        kind: 'action',
        id: 'act-profile',
        label: 'Open Profile',
        hint: 'Account',
        action: 'profile',
      },
      {
        kind: 'action',
        id: 'act-settings',
        label: 'Open Settings',
        hint: 'Account',
        action: 'settings',
      },
      {
        kind: 'action',
        id: 'act-guide',
        label: 'Keyboard shortcuts',
        hint: 'Guide',
        action: 'guide',
      },
    ].filter((a) => {
      if (!q) return true;
      return `${a.label} ${a.hint}`.toLowerCase().includes(q);
    });

    // Prefer workspaces, then services, then actions when searching
    return [
      ...workspaceItems.slice(0, 12),
      ...serviceItems.slice(0, 40),
      ...actions,
    ];
  }, [query, workspaces, services, activeWorkspaceName]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setIndex(0);
      return;
    }
    setIndex(0);
    const t = window.setTimeout(() => inputRef.current?.focus?.(), 40);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (open) setQuery(initialQuery || '');
  }, [open, initialQuery]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIndex((i) => Math.min(items.length - 1, i + 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[index];
        if (!item) return;
        if (item.kind === 'workspace') onSelectWorkspace(item.workspaceId);
        else if (item.kind === 'service')
          onSelectService(item.service.id, item.workspaceId || undefined);
        else onAction(item);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [
    open,
    items,
    index,
    onClose,
    onSelectService,
    onSelectWorkspace,
    onAction,
  ]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${index}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const border = isDarkMode
    ? 'rgba(255, 255, 255, 0.14)'
    : 'rgba(0, 0, 0, 0.08)';
  const panelBg = isDarkMode
    ? 'rgba(10, 21, 36, 0.55)'
    : 'rgba(255, 255, 255, 0.62)';
  const inputBg = isDarkMode
    ? 'rgba(255, 255, 255, 0.08)'
    : 'rgba(255, 255, 255, 0.72)';

  const rowStyle = (active: boolean): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    cursor: 'pointer',
    borderRadius: 10,
    background: active
      ? isDarkMode
        ? 'rgba(139, 124, 246, 0.22)'
        : 'rgba(139, 124, 246, 0.12)'
      : 'transparent',
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10050,
        background: isDarkMode ? 'rgba(0, 8, 18, 0.42)' : 'rgba(15, 23, 42, 0.28)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '72px 24px 24px',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 'min(560px, 92vw)',
          maxHeight: '70vh',
          background: panelBg,
          border: `1px solid ${border}`,
          borderRadius: 18,
          boxShadow: isDarkMode
            ? '0 28px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 28px 80px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
          backdropFilter: 'blur(22px) saturate(160%)',
          WebkitBackdropFilter: 'blur(22px) saturate(160%)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '14px 14px 8px' }}>
          <Input
            ref={inputRef}
            size="large"
            prefix={<SearchOutlined style={{ color: MUTED }} />}
            placeholder="Search workspaces or services…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            allowClear
            style={{
              background: inputBg,
              borderColor: border,
              backdropFilter: 'blur(8px)',
            }}
          />
          <Text
            type="secondary"
            style={{ display: 'block', marginTop: 8, fontSize: 12, paddingLeft: 4 }}
          >
            ↑↓ navigate · Enter open · Esc close · Ctrl+K
          </Text>
        </div>

        <div
          ref={listRef}
          className="tn-global-search-scroll"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '4px 8px 12px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(255,255,255,0.22) transparent',
          }}
        >
          <style>{`
            .tn-global-search-scroll::-webkit-scrollbar {
              width: 6px;
            }
            .tn-global-search-scroll::-webkit-scrollbar-track {
              background: transparent;
            }
            .tn-global-search-scroll::-webkit-scrollbar-thumb {
              background: rgba(255, 255, 255, 0.16);
              border-radius: 999px;
            }
            .tn-global-search-scroll::-webkit-scrollbar-thumb:hover {
              background: rgba(139, 124, 246, 0.45);
            }
          `}</style>
          {items.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: MUTED }}>
              No matches
            </div>
          ) : (
            items.map((item, i) => (
              <div
                key={item.id}
                data-idx={i}
                style={rowStyle(i === index)}
                onMouseEnter={() => setIndex(i)}
                onClick={() => {
                  if (item.kind === 'workspace') onSelectWorkspace(item.workspaceId);
                  else if (item.kind === 'service')
                    onSelectService(item.service.id, item.workspaceId || undefined);
                  else onAction(item);
                }}
              >
                {item.kind === 'workspace' ? (
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: isDarkMode
                        ? 'rgba(139, 124, 246, 0.18)'
                        : COLORS.PRIMARY_SOFT,
                      color: COLORS.PRIMARY,
                    }}
                  >
                    <FolderOpenOutlined style={{ fontSize: 15 }} />
                  </div>
                ) : item.kind === 'service' ? (
                  <ServiceLogo
                    iconType={item.service.iconType}
                    customIcon={item.service.customIcon}
                    url={item.service.url}
                    size={28}
                    style={{ borderRadius: 8 }}
                  />
                ) : item.action === 'profile' ? (
                  <UserOutlined style={{ fontSize: 18, color: COLORS.PRIMARY }} />
                ) : item.action === 'settings' ? (
                  <SettingOutlined style={{ fontSize: 18, color: COLORS.PRIMARY }} />
                ) : (
                  <AppstoreOutlined style={{ fontSize: 18, color: COLORS.PRIMARY }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, color: isDarkMode ? '#fff' : '#141414' }}>
                    {item.label}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {item.kind === 'workspace'
                      ? `Workspace · ${item.hint}`
                      : item.kind === 'service'
                        ? `Service · ${item.hint}`
                        : item.hint}
                  </Text>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
