import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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

type AnchorRect = { top: number; left: number; width: number; bottom: number };

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
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);
  const [ready, setReady] = useState(false);
  const inputRef = useRef<any>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const anchored = !!anchor;

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
      setAnchor(null);
      setReady(false);
      return;
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;

    const measure = () => {
      const el = document.querySelector(
        '[data-tn-global-search-anchor]'
      ) as HTMLElement | null;
      if (!el) {
        setAnchor(null);
        setReady(true);
        return;
      }
      const r = el.getBoundingClientRect();
      setAnchor({
        top: r.top,
        left: r.left,
        width: r.width,
        bottom: r.bottom,
      });
      setReady(true);
    };

    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Keep typing in the title-bar field when anchored; only focus modal input for Ctrl+K / centered mode.
    if (!anchored) {
      const t = window.setTimeout(() => inputRef.current?.focus?.(), 40);
      return () => window.clearTimeout(t);
    }
  }, [open, anchored]);

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

  if (!open || !ready) return null;

  const border = isDarkMode
    ? 'rgba(255, 255, 255, 0.14)'
    : 'rgba(0, 0, 0, 0.08)';
  const panelBg = isDarkMode
    ? 'rgba(14, 14, 14, 0.96)'
    : 'rgba(255, 255, 255, 0.96)';
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
        ? 'rgba(255,255,255,0.16)'
        : 'rgba(0,0,0,0.06)'
      : 'transparent',
  });

  const panelWidth = anchored
    ? Math.min(Math.max(anchor!.width, 360), Math.max(320, window.innerWidth - 24))
    : Math.min(560, window.innerWidth * 0.92);

  const panelLeft = anchored
    ? Math.max(12, Math.min(anchor!.left, window.innerWidth - panelWidth - 12))
    : undefined;

  return (
    <div
      style={{
        position: 'fixed',
        top: anchored ? Math.max(0, Math.floor(anchor!.bottom)) : 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 10050,
        background: anchored
          ? 'rgba(0, 0, 0, 0.28)'
          : isDarkMode
            ? 'rgba(0, 8, 18, 0.42)'
            : 'rgba(15, 23, 42, 0.28)',
        backdropFilter: anchored ? undefined : 'blur(10px)',
        WebkitBackdropFilter: anchored ? undefined : 'blur(10px)',
        display: anchored ? 'block' : 'flex',
        alignItems: anchored ? undefined : 'flex-start',
        justifyContent: anchored ? undefined : 'center',
        padding: anchored ? 0 : '72px 24px 24px',
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        style={{
          position: anchored ? 'absolute' : 'relative',
          top: anchored ? 8 : undefined,
          left: panelLeft,
          width: panelWidth,
          maxHeight: anchored ? 'min(420px, calc(100% - 16px))' : '70vh',
          background: panelBg,
          border: `1px solid ${border}`,
          borderRadius: 14,
          boxShadow: isDarkMode
            ? '0 16px 48px rgba(0,0,0,0.55)'
            : '0 16px 48px rgba(0,0,0,0.16)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {!anchored && (
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
              }}
            />
            <Text
              type="secondary"
              style={{ display: 'block', marginTop: 8, fontSize: 12, paddingLeft: 4 }}
            >
              ↑↓ navigate · Enter open · Esc close · Ctrl+K
            </Text>
          </div>
        )}

        <div
          ref={listRef}
          className="tn-global-search-scroll"
          style={{
            flex: 1,
            overflow: 'auto',
            padding: anchored ? '8px 8px 10px' : '4px 8px 12px',
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
                        ? 'rgba(255,255,255,0.16)'
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
