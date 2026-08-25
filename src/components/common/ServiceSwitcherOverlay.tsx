import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Typography } from 'antd';
import { ServiceLogo } from './ServiceLogo';
import { UnreadBadge } from './UnreadBadge';
import type { ServiceTab } from '../../types';
import { COLORS } from '../../constants';

const { Text } = Typography;

interface ServiceSwitcherOverlayProps {
  open: boolean;
  services: ServiceTab[];
  selectedIndex: number;
  isDarkMode?: boolean;
  unreadById?: Record<string, number>;
  onHighlight: (index: number) => void;
  onSelect: (id: string) => void;
  onCancel: () => void;
}

/** Windows Alt+Tab-style centered picker for Ctrl+Tab service switching. */
export function ServiceSwitcherOverlay({
  open,
  services,
  selectedIndex,
  isDarkMode = true,
  unreadById = {},
  onHighlight,
  onSelect,
  onCancel,
}: ServiceSwitcherOverlayProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(t);
  }, [open]);

  // Steal focus from webviews so Ctrl/Tab keyup reaches the host (fixes "release does nothing")
  useEffect(() => {
    if (!open || !visible) return;
    const el = panelRef.current;
    if (!el) return;
    el.focus({ preventScroll: true });
  }, [open, visible]);

  useEffect(() => {
    if (!open) return;

    const commitSelected = () => {
      const service = services[selectedIndexRef.current] ?? services[0];
      if (service) onSelect(service.id);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        commitSelected();
        return;
      }
      // Keep cycling while overlay has focus (backup if main IPC misses a Tab)
      if (e.key === 'Tab' && e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        // Parent still gets Electron IPC cycle; avoid double-cycle here
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Control' || e.key === 'Meta' || e.code === 'ControlLeft' || e.code === 'ControlRight') {
        e.preventDefault();
        e.stopPropagation();
        commitSelected();
        return;
      }
      if (e.key === 'Tab' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        commitSelected();
      }
    };

    const onModifierProbe = (e: MouseEvent) => {
      if (!open) return;
      if (typeof e.getModifierState !== 'function') return;
      // Ctrl already released → open selection (backup when keyup is swallowed)
      if (!e.getModifierState('Control') && !e.getModifierState('Meta')) {
        commitSelected();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    window.addEventListener('mousemove', onModifierProbe, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
      window.removeEventListener('mousemove', onModifierProbe, true);
    };
  }, [open, services, onSelect, onCancel]);

  if (!mounted || services.length === 0) return null;

  const border = isDarkMode
    ? 'rgba(255, 255, 255, 0.14)'
    : 'rgba(0, 0, 0, 0.08)';
  const panelBg = isDarkMode
    ? 'rgba(10, 21, 36, 0.55)'
    : 'rgba(255, 255, 255, 0.62)';
  const muted = isDarkMode ? '#9aa0a6' : '#5f6368';
  const text = isDarkMode ? '#e8eaed' : '#202124';
  const selected = services[selectedIndex] ?? services[0];

  return (
    <>
      <div
        role="presentation"
        onMouseDown={(e) => {
          e.preventDefault();
          onCancel();
        }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 4000,
          background: visible
            ? isDarkMode
              ? 'rgba(0, 8, 18, 0.42)'
              : 'rgba(15, 23, 42, 0.28)'
            : 'rgba(0,0,0,0)',
          backdropFilter: visible ? 'blur(10px)' : undefined,
          WebkitBackdropFilter: visible ? 'blur(10px)' : undefined,
          transition: 'background 0.15s ease',
          WebkitAppRegion: 'no-drag',
        } as CSSProperties}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Switch service"
        tabIndex={-1}
        style={{
          position: 'fixed',
          left: '50%',
          top: '50%',
          zIndex: 4010,
          transform: visible
            ? 'translate(-50%, -50%) scale(1)'
            : 'translate(-50%, -48%) scale(0.96)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.15s ease, opacity 0.15s ease',
          WebkitAppRegion: 'no-drag',
          pointerEvents: 'auto',
          outline: 'none',
        } as CSSProperties}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          style={{
            background: panelBg,
            backdropFilter: 'blur(22px) saturate(160%)',
            WebkitBackdropFilter: 'blur(22px) saturate(160%)',
            border: `1px solid ${border}`,
            borderRadius: 18,
            boxShadow: isDarkMode
              ? '0 28px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)'
              : '0 28px 80px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.7)',
            padding: '18px 20px 16px',
            minWidth: Math.min(560, 88 + services.length * 100),
            maxWidth: 'min(920px, 92vw)',
          }}
        >
          <Text
            style={{
              display: 'block',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              color: muted,
              marginBottom: 14,
            }}
          >
            Switch service
          </Text>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 10,
              maxHeight: '42vh',
              overflowY: 'auto',
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(255,255,255,0.22) transparent',
            }}
          >
            {services.map((service, index) => {
              const isSelected = index === selectedIndex;
              const unread = unreadById[service.id] || 0;
              return (
                <button
                  key={service.id}
                  type="button"
                  onMouseEnter={() => onHighlight(index)}
                  onMouseDown={(e) => {
                    // mousedown: open immediately (don't wait for click / Ctrl still held)
                    e.preventDefault();
                    e.stopPropagation();
                    onHighlight(index);
                    onSelect(service.id);
                  }}
                  style={{
                    appearance: 'none',
                    border: isSelected ? `2px solid ${COLORS.PRIMARY}` : '2px solid transparent',
                    background: isSelected
                      ? isDarkMode
                        ? 'rgba(59, 130, 246, 0.22)'
                        : 'rgba(59, 130, 246, 0.12)'
                      : 'transparent',
                    borderRadius: 12,
                    padding: '12px 14px 10px',
                    width: 96,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.12s ease, border-color 0.12s ease',
                    position: 'relative',
                    overflow: 'visible',
                  }}
                >
                  <div style={{ position: 'relative', width: 44, height: 44 }}>
                    <ServiceLogo
                      iconType={service.iconType}
                      customIcon={service.customIcon}
                      url={service.url}
                      size={44}
                    />
                    <UnreadBadge count={unread} size="sm" />
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: isSelected ? 600 : 500,
                      color: text,
                      textAlign: 'center',
                      lineHeight: 1.25,
                      maxWidth: '100%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {service.name}
                  </span>
                </button>
              );
            })}
          </div>

          <Text
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 14,
              fontSize: 13,
              fontWeight: 600,
              color: text,
            }}
          >
            {selected?.name}
            {(unreadById[selected?.id || ''] || 0) > 0
              ? ` · ${unreadById[selected.id]} unread`
              : ''}
          </Text>
          <Text
            style={{
              display: 'block',
              textAlign: 'center',
              marginTop: 4,
              fontSize: 11,
              color: muted,
            }}
          >
            Ctrl+Tab to cycle · release Ctrl (or both keys) to open · click
          </Text>
        </div>
      </div>
    </>
  );
}
