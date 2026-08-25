import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  CheckCircleOutlined,
  LockOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useUnread } from '../context/UnreadContext';
import { ServiceLogo } from '../components/common';
import { COLORS, FONT_FAMILY, MAX_WORKSPACES } from '../constants';
import { storage } from '../utils/storage';
import type { ServiceTab, Workspace } from '../types';
import './Dashboard.css';

const LIVE = '#c8f542';
const PROFILE_FOLDER_GRADIENTS = [
  'linear-gradient(160deg, #2563eb 0%, #60a5fa 48%, #bfdbfe 100%)',
  'linear-gradient(160deg, #e11d48 0%, #fb7185 48%, #fecdd3 100%)',
  'linear-gradient(160deg, #0f766e 0%, #2dd4bf 48%, #99f6e4 100%)',
  'linear-gradient(160deg, #c2410c 0%, #fb923c 48%, #fed7aa 100%)',
  'linear-gradient(160deg, #7c3aed 0%, #a78bfa 48%, #ddd6fe 100%)',
];

interface SessionInfo {
  partition: string;
  serviceName?: string;
  serviceType?: string;
  lastAccessed?: number;
  url?: string;
}

interface DashboardProps {
  isDarkMode: boolean;
  workspaces: Workspace[];
  activeWorkspace: string;
  mountedServiceIds: Set<string>;
  disabledServices: Set<string>;
  onOpenService: (service: ServiceTab) => void;
  onOpenWorkspace: (workspaceId: string) => void;
  onAddWorkspace: () => void;
  onAddService: () => void;
  onOpenSearch: () => void;
  onShowProfile: () => void;
}

function greetingForNow() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatRelative(ts?: number) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  if (diff < 0) return 'just now';
  const sec = Math.floor(diff / 1000);
  if (sec < 45) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatShortRelative(ts?: number) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${Math.max(1, sec)}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.floor(hr / 24)}d`;
}

function displayNameFromProfile(phone?: string | number, email?: string) {
  if (phone !== undefined && phone !== null && String(phone).trim()) {
    const p = String(phone).replace(/^\+/, '');
    return `+${p}`;
  }
  if (email) {
    const local = email.split('@')[0];
    if (local) return local;
  }
  return 'there';
}

function cardStyle(isDarkMode: boolean, extra?: CSSProperties): CSSProperties {
  return {
    background: isDarkMode ? 'rgba(22, 29, 43, 0.68)' : 'rgba(255, 255, 255, 0.7)',
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.86)'}`,
    borderRadius: 18,
    padding: 22,
    boxShadow: isDarkMode
      ? '0 18px 42px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.06)'
      : '0 18px 42px rgba(32, 44, 64, 0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
    backdropFilter: 'blur(22px) saturate(125%)',
    WebkitBackdropFilter: 'blur(22px) saturate(125%)',
    ...extra,
  };
}

function SectionLabel({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        color: muted ? '#8b8b8b' : '#a3a3a3',
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

/** Home overview built only from live workspaces, services, unread, and session timestamps. */
export default function Dashboard({
  isDarkMode,
  workspaces,
  activeWorkspace,
  mountedServiceIds,
  disabledServices,
  onOpenService,
  onOpenWorkspace,
  onAddWorkspace,
  onAddService,
  onOpenSearch,
  onShowProfile,
}: DashboardProps) {
  const { userProfile } = useAuth();
  const { unreadById, totalUnread } = useUnread();
  const [sessionsByPartition, setSessionsByPartition] = useState<Record<string, SessionInfo>>(
    {}
  );

  const allServices = useMemo(
    () => workspaces.flatMap((w) => w.services.map((s) => ({ ...s, workspaceId: s.workspaceId || w.id }))),
    [workspaces]
  );

  const workspaceById = useMemo(() => {
    const map = new Map<string, Workspace>();
    for (const w of workspaces) map.set(w.id, w);
    return map;
  }, [workspaces]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const entries = await Promise.all(
        allServices.map(async (svc) => {
          try {
            const data = (await storage.loadData(`session-${svc.partition}`)) as SessionInfo | null;
            if (data && typeof data === 'object') {
              return [svc.partition, data] as const;
            }
          } catch {
            /* ignore */
          }
          return null;
        })
      );
      if (cancelled) return;
      const next: Record<string, SessionInfo> = {};
      for (const row of entries) {
        if (row) next[row[0]] = row[1];
      }
      setSessionsByPartition(next);
    };
    void load();
    const t = window.setInterval(() => void load(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [allServices]);

  const liveServices = useMemo(
    () =>
      allServices.filter(
        (s) => mountedServiceIds.has(s.id) && !disabledServices.has(s.id)
      ),
    [allServices, mountedServiceIds, disabledServices]
  );

  const unreadItems = useMemo(() => {
    return allServices
      .map((svc) => ({
        service: svc,
        count: unreadById[svc.id] || 0,
        lastAccessed: sessionsByPartition[svc.partition]?.lastAccessed,
      }))
      .filter((x) => x.count > 0)
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));
  }, [allServices, unreadById, sessionsByPartition]);

  const recentSessions = useMemo(() => {
    return allServices
      .map((svc) => ({
        service: svc,
        lastAccessed: sessionsByPartition[svc.partition]?.lastAccessed,
        title: sessionsByPartition[svc.partition]?.url
          ? sessionsByPartition[svc.partition]?.serviceName || svc.name
          : svc.name,
      }))
      .filter((x) => typeof x.lastAccessed === 'number' && (x.lastAccessed as number) > 0)
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      .slice(0, 8);
  }, [allServices, sessionsByPartition]);

  const quickLaunch = useMemo(() => {
    const ranked = [...allServices]
      .filter((s) => !disabledServices.has(s.id))
      .sort((a, b) => {
        const ta = sessionsByPartition[a.partition]?.lastAccessed || 0;
        const tb = sessionsByPartition[b.partition]?.lastAccessed || 0;
        if (tb !== ta) return tb - ta;
        return a.name.localeCompare(b.name);
      });
    return ranked.slice(0, 4);
  }, [allServices, disabledServices, sessionsByPartition]);

  const lockedCount = allServices.filter((s) => s.isLocked || !!s.lockPasswordHash).length;
  const disabledCount = allServices.filter((s) => disabledServices.has(s.id)).length;
  const protectedCount = Math.max(0, allServices.length - disabledCount);
  const name = displayNameFromProfile(userProfile?.phone, userProfile?.email);

  const textPrimary = isDarkMode ? '#f5f5f5' : '#141414';
  const textMuted = isDarkMode ? '#9a9a9a' : '#6b6b6b';

  return (
    <div
      className="tn-dashboard"
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '34px clamp(20px, 4vw, 56px) 48px',
        fontFamily: FONT_FAMILY,
        color: textPrimary,
        boxSizing: 'border-box',
        background: isDarkMode
          ? 'radial-gradient(circle at 8% 0%, rgba(92, 78, 189, 0.22), transparent 30%), radial-gradient(circle at 92% 28%, rgba(20, 184, 166, 0.12), transparent 26%)'
          : 'radial-gradient(circle at 8% 0%, rgba(139, 124, 246, 0.16), transparent 28%), radial-gradient(circle at 92% 28%, rgba(20, 184, 166, 0.12), transparent 25%), #eef2f7',
      }}
    >
      {/* Hero */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          marginBottom: 32,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 240, flex: '1 1 320px' }}>
          <div className={'tn-eyebrow'}>YOUR COMMAND CENTER</div>
          <h1
            style={{
              margin: 0,
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              lineHeight: 1.15,
              color: textPrimary,
            }}
          >
            {greetingForNow()}, <span style={{ color: '#8b7cf6' }}>{name}</span>
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 15, color: textMuted, maxWidth: 520, lineHeight: 1.5 }}>
            Manage {allServices.length} account{allServices.length === 1 ? '' : 's'} across{' '}
            {workspaces.length} isolated workspace{workspaces.length === 1 ? '' : 's'}—without
            switching apps.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={onOpenSearch} style={iconBtn(isDarkMode)} title="Search">
            <SearchOutlined />
          </button>
          <button type="button" onClick={onShowProfile} style={ghostBtn(isDarkMode)}>
            Account
          </button>
          <button
            type="button"
            onClick={onAddWorkspace}
            disabled={workspaces.length >= MAX_WORKSPACES}
            style={primaryBtn(isDarkMode)}
          >
            <PlusOutlined /> New workspace
          </button>
        </div>
      </div>

      {/* Top row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 1.4fr) minmax(200px, 0.9fr) minmax(220px, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
        className="tn-dash-top-grid"
      >
        {/* Active sessions */}
        <section style={cardStyle(isDarkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
            <div>
              <SectionLabel>Active sessions</SectionLabel>
              <div style={{ fontSize: 18, fontWeight: 650, color: textPrimary }}>
                Pick up where you left off
              </div>
            </div>
            <span
              style={{
                alignSelf: 'flex-start',
                background: 'rgba(200, 245, 66, 0.14)',
                color: LIVE,
                border: `1px solid rgba(200, 245, 66, 0.35)`,
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 650,
                whiteSpace: 'nowrap',
              }}
            >
              ● {liveServices.length} live
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 18 }}>
            <span style={{ fontSize: 56, fontWeight: 750, lineHeight: 1, letterSpacing: '-0.04em' }}>
              {liveServices.length}
            </span>
            <span style={{ color: textMuted, fontSize: 14, lineHeight: 1.35 }}>
              account{liveServices.length === 1 ? '' : 's'} open and ready this session
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(liveServices.length > 0 ? liveServices : recentSessions.map((r) => r.service))
              .slice(0, 4)
              .map((svc) => {
                const ws = workspaceById.get(svc.workspaceId);
                const last = sessionsByPartition[svc.partition]?.lastAccessed;
                const isLive = mountedServiceIds.has(svc.id);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => onOpenService(svc)}
                    style={rowBtn()}
                  >
                    <ServiceLogo
                      iconType={svc.iconType}
                      customIcon={svc.customIcon}
                      url={svc.url}
                      size={34}
                    />
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: 14,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {svc.name}
                      </div>
                      <div style={{ fontSize: 12, color: textMuted }}>
                        {ws?.name || 'Workspace'}
                        {isLive ? ' · active now' : last ? ` · ${formatRelative(last)}` : ''}
                      </div>
                    </div>
                    <span style={{ color: LIVE, fontWeight: 600, fontSize: 13 }}>Resume</span>
                  </button>
                );
              })}
            {liveServices.length === 0 && recentSessions.length === 0 && (
              <EmptyHint
                isDarkMode={isDarkMode}
                text={
                  allServices.length === 0
                    ? 'Add an account to start a session.'
                    : 'Open any account to warm a session here.'
                }
                actionLabel={allServices.length === 0 ? 'Browse services' : undefined}
                onAction={allServices.length === 0 ? onAddService : undefined}
              />
            )}
          </div>
        </section>

        {/* Quick launch */}
        <section style={cardStyle(isDarkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <SectionLabel>Quick launch</SectionLabel>
              <div style={{ fontSize: 18, fontWeight: 650 }}>Jump into any account</div>
            </div>
            <button
              type="button"
              onClick={onAddService}
              style={{
                ...iconBtn(isDarkMode),
                width: 34,
                height: 34,
                borderRadius: 10,
              }}
              title="Add account"
            >
              <PlusOutlined />
            </button>
          </div>
          {quickLaunch.length === 0 ? (
            <EmptyHint
              isDarkMode={isDarkMode}
              text="No accounts yet."
              actionLabel="Browse services"
              onAction={onAddService}
            />
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 12,
              }}
            >
              {quickLaunch.map((svc) => {
                const ws = workspaceById.get(svc.workspaceId);
                return (
                  <button
                    key={svc.id}
                    type="button"
                    onClick={() => onOpenService(svc)}
                    style={{
                      background: isDarkMode ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.58)',
                      border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.9)'}`,
                      borderRadius: 14,
                      padding: '16px 10px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 10,
                      color: textPrimary,
                    }}
                  >
                    <ServiceLogo
                      iconType={svc.iconType}
                      customIcon={svc.customIcon}
                      url={svc.url}
                      size={42}
                    />
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {svc.name}
                      </div>
                      <div style={{ fontSize: 11, color: textMuted, marginTop: 2 }}>
                        {ws?.name || 'Workspace'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Needs attention / unread */}
        <section style={cardStyle(isDarkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <SectionLabel>Notifications</SectionLabel>
              <div style={{ fontSize: 18, fontWeight: 650 }}>Everything that needs you</div>
            </div>
            {totalUnread > 0 && (
              <span
                style={{
                  minWidth: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: LIVE,
                  color: '#111',
                  fontWeight: 750,
                  fontSize: 13,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 8px',
                }}
              >
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {unreadItems.slice(0, 5).map(({ service: svc, count, lastAccessed }) => {
              const ws = workspaceById.get(svc.workspaceId);
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => onOpenService(svc)}
                  style={rowBtn()}
                >
                  <ServiceLogo
                    iconType={svc.iconType}
                    customIcon={svc.customIcon}
                    url={svc.url}
                    size={32}
                  />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 650, fontSize: 13.5 }}>
                      {count} new on {svc.name}
                    </div>
                    <div style={{ fontSize: 12, color: textMuted }}>
                      {ws?.name || 'Workspace'}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: textMuted }}>
                    {formatShortRelative(lastAccessed) || '·'}
                  </span>
                </button>
              );
            })}
            {unreadItems.length === 0 && (
              <EmptyHint isDarkMode={isDarkMode} text="You’re caught up — no unread badges." />
            )}
          </div>
        </section>
      </div>

      {/* Workspaces = browser profiles */}
      <section className={`tn-profiles-section ${isDarkMode ? 'tn-profiles-section--dark' : ''}`}>
      <div className="tn-profiles-heading" style={{ marginBottom: 14, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="tn-profiles-kicker">Browser profiles</div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>
            Keep every identity separate
          </h2>
          <p style={{ margin: '6px 0 0', color: textMuted, fontSize: 14 }}>
            Personal, Work, and Creator accounts stay isolated, organized, and ready.
          </p>
        </div>
        <span style={{ color: textMuted, fontSize: 13, alignSelf: 'flex-end' }}>
          {workspaces.length} profile{workspaces.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="tn-profiles-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
          marginBottom: 28,
        }}
      >
        {workspaces.map((ws, idx) => {
          const gradient = PROFILE_FOLDER_GRADIENTS[idx % PROFILE_FOLDER_GRADIENTS.length];
          const services = ws.services;
          const isActiveWs = ws.id === activeWorkspace;
          const subtitle =
            services.length === 0
              ? 'Empty profile'
              : services.length === 1
                ? services[0].name
                : `${services[0].name} & More`;
          const fileLabel = `${services.length.toLocaleString('en-US').replace(/,/g, ' ')} File${
            services.length === 1 ? '' : 's'
          }`;
          return (
            <button
              key={ws.id}
              type="button"
              onClick={() => onOpenWorkspace(ws.id)}
              className={`tn-folder-card${isActiveWs ? ' tn-folder-card--active' : ''}`}
              style={{ backgroundImage: gradient }}
              aria-label={`Open profile ${ws.name}`}
            >
              <div className="tn-folder-card__papers" aria-hidden="true">
                <div className="tn-folder-paper tn-folder-paper--1">
                  <span /><span /><span />
                </div>
                <div className="tn-folder-paper tn-folder-paper--2">
                  <span /><span /><span />
                </div>
                <div className="tn-folder-paper tn-folder-paper--3">
                  <span /><span /><span />
                </div>
              </div>

              <div className="tn-folder-card__front">
                <div className="tn-folder-card__top">
                  <div className="tn-folder-card__titles">
                    <div className="tn-folder-card__title">{ws.name}</div>
                    <div className="tn-folder-card__subtitle">{subtitle}</div>
                  </div>
                  <span className="tn-folder-card__menu" aria-hidden="true">
                    <MoreOutlined />
                  </span>
                </div>
                <div className="tn-folder-card__stats">
                  <svg
                    className="tn-folder-card__file-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <rect x="4.5" y="2.5" width="8" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                    <path
                      d="M3.5 4.5v8a1.5 1.5 0 0 0 1.5 1.5h6"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>{fileLabel}</span>
                </div>
              </div>
            </button>
          );
        })}

        {workspaces.length < MAX_WORKSPACES && (
          <button
            type="button"
            onClick={onAddWorkspace}
            className="tn-folder-card tn-folder-card--create"
            aria-label="Create new browser profile"
          >
            <div className="tn-folder-card__papers" aria-hidden="true">
              <div className="tn-folder-paper tn-folder-paper--1" />
              <div className="tn-folder-paper tn-folder-paper--2" />
              <div className="tn-folder-paper tn-folder-paper--3" />
            </div>
            <div className="tn-folder-card__front">
              <div className="tn-folder-card__top">
                <div className="tn-folder-card__titles">
                  <div className="tn-folder-card__title">New profile</div>
                  <div className="tn-folder-card__subtitle">Create isolated space</div>
                </div>
                <span className="tn-folder-card__menu tn-folder-card__menu--plus" aria-hidden="true">
                  <PlusOutlined />
                </span>
              </div>
              <div className="tn-folder-card__stats">
                <span>Add browser profile</span>
              </div>
            </div>
          </button>
        )}
      </div>
      </section>

      {/* Bottom row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(260px, 1.3fr) minmax(220px, 1fr) minmax(220px, 0.9fr)',
          gap: 16,
        }}
        className="tn-dash-bottom-grid"
      >
        <section style={cardStyle(isDarkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <SectionLabel>Recent sessions</SectionLabel>
              <div style={{ fontSize: 16, fontWeight: 650 }}>Continue browsing</div>
            </div>
            {recentSessions.length > 0 && (
              <button
                type="button"
                onClick={() => recentSessions[0] && onOpenService(recentSessions[0].service)}
                style={ghostBtn(isDarkMode, { padding: '4px 12px', fontSize: 12, height: 30 })}
              >
                Open latest
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {recentSessions.slice(0, 5).map(({ service: svc, lastAccessed }) => {
              const ws = workspaceById.get(svc.workspaceId);
              return (
                <button
                  key={svc.id}
                  type="button"
                  onClick={() => onOpenService(svc)}
                  style={rowBtn()}
                >
                  <ServiceLogo
                    iconType={svc.iconType}
                    customIcon={svc.customIcon}
                    url={svc.url}
                    size={30}
                  />
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: 13.5,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {svc.name}
                    </div>
                    <div style={{ fontSize: 12, color: textMuted }}>
                      {ws?.name || 'Workspace'} / {svc.iconType}
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: textMuted }}>
                    {formatShortRelative(lastAccessed)}
                  </span>
                </button>
              );
            })}
            {recentSessions.length === 0 && (
              <EmptyHint
                isDarkMode={isDarkMode}
                text="Session history appears after you open accounts."
              />
            )}
          </div>
        </section>

        <section style={cardStyle(isDarkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <SectionLabel>Security center</SectionLabel>
              <div style={{ fontSize: 16, fontWeight: 650 }}>Every session under control</div>
            </div>
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircleOutlined />
            </span>
          </div>
          <div style={{ fontSize: 26, fontWeight: 750, marginBottom: 14, letterSpacing: '-0.02em' }}>
            {protectedCount} of {allServices.length} accounts ready
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            <StatLine
              color="#14b8a6"
              label="Password locked"
              value={lockedCount}
              icon={<LockOutlined />}
            />
            <StatLine
              color="#f59e0b"
              label="Disabled / need attention"
              value={disabledCount}
              icon={<SafetyCertificateOutlined />}
            />
          </div>
          <button type="button" onClick={onShowProfile} style={wideBtn(isDarkMode)}>
            Review security
          </button>
        </section>

        <section className="tn-time-saved-card" style={cardStyle(isDarkMode)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <SectionLabel>Time saved</SectionLabel>
              <div style={{ fontSize: 16, fontWeight: 650 }}>Fewer logins. Faster work.</div>
            </div>
            <span
              style={{
                borderRadius: 999,
                padding: '4px 10px',
                fontSize: 12,
                fontWeight: 700,
                background: 'rgba(220, 255, 99, 0.16)',
                color: '#d9fb66',
              }}
            >
              +42 min
            </span>
          </div>
          <div className="tn-time-saved-value">
            <span>4</span><sup>h</sup><span>36</span><sup>m</sup>
          </div>
          <p className="tn-time-saved-copy">saved this week by keeping accounts<br />signed in and ready.</p>
          <div className="tn-time-saved-bars" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6].map((bar) => <span key={bar} className={bar === 4 ? 'is-active' : ''} />)}
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 1100px) {
          .tn-dash-top-grid,
          .tn-dash-bottom-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function EmptyHint({
  isDarkMode,
  text,
  actionLabel,
  onAction,
}: {
  isDarkMode: boolean;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        padding: '18px 14px',
        borderRadius: 14,
        background: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f7f7f7',
        color: isDarkMode ? '#9a9a9a' : '#6b6b6b',
        fontSize: 13,
        textAlign: 'center',
      }}
    >
      <div>{text}</div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          style={{
            marginTop: 10,
            border: 'none',
            background: 'transparent',
            color: COLORS.PRIMARY,
            fontWeight: 650,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

function StatLine({
  color,
  label,
  value,
  icon,
}: {
  color: string;
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span style={{ color, display: 'inline-flex' }}>{icon}</span>
      <span style={{ flex: 1, color: '#9a9a9a' }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: color,
        }}
      />
    </div>
  );
}

function iconBtn(isDarkMode: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#e5e5e5'}`,
    background: isDarkMode ? COLORS.APP_ICON_BTN : '#fff',
    color: isDarkMode ? '#e8e8e8' : '#333',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  };
}

function ghostBtn(isDarkMode: boolean, extra?: CSSProperties): CSSProperties {
  return {
    height: 40,
    borderRadius: 12,
    border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#e5e5e5'}`,
    background: isDarkMode ? 'transparent' : '#fff',
    color: isDarkMode ? '#e8e8e8' : '#333',
    cursor: 'pointer',
    padding: '0 14px',
    fontWeight: 600,
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    ...extra,
  };
}

function primaryBtn(isDarkMode: boolean): CSSProperties {
  return {
    height: 40,
    borderRadius: 12,
    border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.12)' : '#d9d9d9'}`,
    background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#111',
    color: isDarkMode ? '#fff' : '#fff',
    cursor: 'pointer',
    padding: '0 14px',
    fontWeight: 650,
    fontSize: 13,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
  };
}

function wideBtn(isDarkMode: boolean): CSSProperties {
  return {
    width: '100%',
    height: 40,
    borderRadius: 12,
    border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#e5e5e5'}`,
    background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#f5f5f5',
    color: isDarkMode ? '#f0f0f0' : '#222',
    cursor: 'pointer',
    fontWeight: 650,
    fontSize: 13,
  };
}
function rowBtn(): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    padding: '10px 8px',
    borderRadius: 12,
    border: 'none',
    background: 'transparent',
    color: 'inherit',
    cursor: 'pointer',
    outline: 'none',
  };
}

