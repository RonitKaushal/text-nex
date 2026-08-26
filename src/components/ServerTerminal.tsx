import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Typography, message } from 'antd';
import { ApiOutlined, CloseOutlined, CodeOutlined } from '@ant-design/icons';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { ServiceTab } from '../types';
import ubuntuLogo from '../assets/brands/ubuntu.svg';
import serverLogo from '../assets/brands/server.svg';
import { APP_BG_GRADIENT, COLORS } from '../constants';
import { useServiceChromeOptional } from '../context/ServiceChromeContext';

const { Text, Title } = Typography;

type ConnState = 'idle' | 'connecting' | 'connected' | 'error' | 'closed';

interface ServerTerminalProps {
  service: ServiceTab;
  isDarkMode: boolean;
  isActive: boolean;
}

/** Terminal palette — black background + green text. */
const GREEN_TERM_THEME = {
  background: '#000000',
  foreground: '#33ff66',
  cursor: '#33ff66',
  cursorAccent: '#000000',
  selectionBackground: 'rgba(51,255,102,0.28)',
  black: '#000000',
  red: '#ff5555',
  green: '#33ff66',
  yellow: '#ffff66',
  blue: '#5555ff',
  magenta: '#ff66aa',
  cyan: '#55ffff',
  white: '#c8d0d8',
  brightBlack: '#3a4555',
  brightRed: '#ff6666',
  brightGreen: '#66ff99',
  brightYellow: '#ffff99',
  brightBlue: '#7777ff',
  brightMagenta: '#ff88bb',
  brightCyan: '#88ffff',
  brightWhite: '#ffffff',
};

function brandLogo(iconType: string, customIcon?: string) {
  if (customIcon) return customIcon;
  if (iconType === 'ubuntu') return ubuntuLogo;
  return serverLogo;
}

function looksLikeShellReady(buf: string) {
  // Prompt usually ends with # $ > % after MOTD
  if (/[#$%>]\s*$/.test(buf.slice(-40))) return true;
  // Enough MOTD received
  if (buf.length >= 400) return true;
  if (/welcome to ubuntu/i.test(buf) && /last login/i.test(buf)) return true;
  return false;
}

/** Termius-style connecting overlay — stays until shell is ready */
function ConnectLoader({
  host,
  port,
  logo,
  onClose,
  error,
  onRetry,
  statusText,
}: {
  host: string;
  port: number;
  logo: string;
  onClose: () => void;
  error?: string | null;
  onRetry: () => void;
  statusText?: string;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        height: '100%',
        width: '100%',
        background: APP_BG_GRADIENT,
        display: 'flex',
        flexDirection: 'column',
        padding: 28,
        boxSizing: 'border-box',
        minHeight: 0,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <img
            src={logo}
            alt=""
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            }}
          />
          <div>
            <Title level={4} style={{ margin: 0, color: '#fff' }}>
              {host}
            </Title>
            <Text style={{ color: 'rgba(255,255,255,0.55)' }}>
              SSH {host}:{port}
            </Text>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 0,
        }}
      >
        <div style={{ textAlign: 'center', width: 'min(420px, 90%)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 28,
            }}
          >
            <div
              className="tn-ssh-spin"
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: '#1a73e8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 0 4px rgba(26,115,232,0.25)',
                zIndex: 1,
              }}
            >
              <ApiOutlined style={{ color: '#fff', fontSize: 22 }} />
            </div>
            <div
              style={{
                flex: 1,
                height: 2,
                background: 'rgba(255,255,255,0.2)',
                margin: '0 4px',
                maxWidth: 160,
              }}
            />
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CodeOutlined style={{ color: 'rgba(255,255,255,0.7)', fontSize: 22 }} />
            </div>
          </div>

          <Text style={{ color: error ? '#d9d9d9' : 'rgba(255,255,255,0.75)', fontSize: 15 }}>
            {error || statusText || 'Connecting to server…'}
          </Text>
          {error ? (
            <div style={{ marginTop: 16 }}>
              <Button type="primary" onClick={onRetry} style={{ borderRadius: 10 }}>
                Retry
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div>
        <Button
          icon={<CloseOutlined />}
          onClick={onClose}
          style={{
            background: 'rgba(255,255,255,0.08)',
            borderColor: 'transparent',
            color: '#fff',
            borderRadius: 10,
          }}
        >
          Close
        </Button>
      </div>

      <style>{`
        .tn-ssh-spin {
          animation: tn-ssh-pulse 1.2s ease-in-out infinite;
        }
        @keyframes tn-ssh-pulse {
          0%, 100% { box-shadow: 0 0 0 4px rgba(26,115,232,0.25); }
          50% { box-shadow: 0 0 0 10px rgba(26,115,232,0.12); }
        }
      `}</style>
    </div>
  );
}

interface SshTerminalSessionProps {
  service: ServiceTab;
  sessionId: string;
  isDarkMode: boolean;
  /** True when this terminal pane should be visible (active tab + service active) */
  isVisible: boolean;
}

function SshTerminalSession({
  service,
  sessionId,
  isDarkMode,
  isVisible,
}: SshTerminalSessionProps) {
  const host = service.ssh?.host || '';
  const port = service.ssh?.port || 22;
  const logo = brandLogo(service.iconType, service.customIcon);
  // Treat as "active" for connect/focus when visible
  const isActive = isVisible;

  const [state, setState] = useState<ConnState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);
  /** Hide terminal text until MOTD/prompt is fully buffered */
  const [shellReady, setShellReady] = useState(false);

  const termRef = useRef<HTMLDivElement>(null);
  const termInst = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const bufferRef = useRef('');
  const shellReadyRef = useRef(false);
  const settleTimer = useRef<number | null>(null);
  const connectLockRef = useRef(false);
  const startedRef = useRef(false);

  const markShellReady = useCallback(() => {
    if (shellReadyRef.current) return;
    shellReadyRef.current = true;
    setShellReady(true);
  }, []);

  const resetBuffer = useCallback(() => {
    bufferRef.current = '';
    shellReadyRef.current = false;
    setShellReady(false);
    if (settleTimer.current) {
      window.clearTimeout(settleTimer.current);
      settleTimer.current = null;
    }
  }, []);

  const connect = useCallback(async () => {
    if (connectLockRef.current) return;
    if (!window.electronAPI?.sshConnect || !service.ssh) {
      setError('SSH is only available in the desktop app');
      setState('error');
      return;
    }
    connectLockRef.current = true;
    startedRef.current = true;
    setDismissed(false);
    setError(null);
    resetBuffer();
    setState('connecting');

    termInst.current?.dispose();
    termInst.current = null;
    fitAddon.current = null;

    try {
      const result = await window.electronAPI.sshConnect(sessionId, {
        host: service.ssh.host,
        port: service.ssh.port || 22,
        username: service.ssh.username,
        password: service.ssh.password,
        privateKey: service.ssh.privateKey,
        passphrase: service.ssh.passphrase,
      });

      if (!result?.ok) {
        setError(result?.error || 'Connection failed');
        setState('error');
        startedRef.current = false;
        return;
      }
      setState('connected');
      window.setTimeout(() => {
        if (!shellReadyRef.current) markShellReady();
      }, 4500);
    } finally {
      connectLockRef.current = false;
    }
  }, [service.ssh, sessionId, resetBuffer, markShellReady]);

  // Connect once from idle only (never auto-retry on closed — caused duplicate prompts)
  useEffect(() => {
    if (!isActive || dismissed) return;
    if (startedRef.current || connectLockRef.current) return;
    if (state === 'idle') void connect();
  }, [isActive, dismissed, state, connect]);

  // Buffer SSH output — do not paint until shellReady
  useEffect(() => {
    const unsubStatus = window.electronAPI?.onSshStatus?.((payload) => {
      if (payload.sessionId !== sessionId) return;
      if (payload.status === 'error') {
        setError(payload.error || 'Connection failed');
        setState('error');
        startedRef.current = false;
        resetBuffer();
      } else if (payload.status === 'closed') {
        if (connectLockRef.current) return;
        setState('closed');
        startedRef.current = false;
        resetBuffer();
      } else if (payload.status === 'connected') {
        setState('connected');
      } else if (payload.status === 'connecting') {
        setState('connecting');
      }
    });

    const unsubData = window.electronAPI?.onSshData?.((payload) => {
      if (payload.sessionId !== sessionId) return;

      if (!shellReadyRef.current) {
        bufferRef.current += payload.data;

        if (looksLikeShellReady(bufferRef.current)) {
          markShellReady();
        } else {
          // After first bytes, wait briefly for MOTD to finish streaming
          if (settleTimer.current) window.clearTimeout(settleTimer.current);
          settleTimer.current = window.setTimeout(() => {
            if (bufferRef.current.length > 0) markShellReady();
          }, 900);
        }
        return;
      }

      termInst.current?.write(payload.data);
    });

    return () => {
      unsubStatus?.();
      unsubData?.();
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
    };
  }, [sessionId, markShellReady, resetBuffer]);

  // Create green xterm only when shell is ready, then flush buffer once
  useEffect(() => {
    if (!shellReady || state !== 'connected' || !termRef.current || !isActive) return;

    if (!termInst.current) {
      const term = new Terminal({
        cursorBlink: true,
        cursorStyle: 'block',
        fontSize: 14,
        fontFamily: 'Consolas, "Cascadia Code", "Courier New", monospace',
        theme: GREEN_TERM_THEME,
        allowProposedApi: true,
        scrollback: 8000,
        convertEol: true,
      });
      const fit = new FitAddon();
      const links = new WebLinksAddon();
      term.loadAddon(fit);
      term.loadAddon(links);
      term.open(termRef.current);
      fit.fit();

      // Linux-style terminal clipboard: Ctrl+Shift+C copy, Ctrl+Shift+V paste
      term.attachCustomKeyEventHandler((ev) => {
        if (ev.type !== 'keydown') return true;
        const ctrl = ev.ctrlKey || ev.metaKey;
        if (!ctrl || !ev.shiftKey) return true;

        const key = (ev.key || '').toLowerCase();
        if (key === 'c') {
          const selected = term.getSelection();
          if (selected) {
            void navigator.clipboard.writeText(selected).catch(() => {
              /* ignore */
            });
          }
          ev.preventDefault();
          ev.stopPropagation();
          return false;
        }
        if (key === 'v') {
          void navigator.clipboard
            .readText()
            .then((text) => {
              if (text) void window.electronAPI?.sshWrite?.(sessionId, text);
            })
            .catch(() => {
              /* ignore */
            });
          ev.preventDefault();
          ev.stopPropagation();
          return false;
        }
        return true;
      });

      term.onData((data) => {
        void window.electronAPI?.sshWrite?.(sessionId, data);
      });

      // Flush everything that arrived during loader — no partial flicker
      if (bufferRef.current) {
        term.write(bufferRef.current);
        bufferRef.current = '';
      }

      termInst.current = term;
      fitAddon.current = fit;
      term.focus();

      void window.electronAPI?.sshResize?.(sessionId, {
        cols: term.cols,
        rows: term.rows,
      });
    } else {
      fitAddon.current?.fit();
    }

    const onResize = () => {
      try {
        fitAddon.current?.fit();
        const term = termInst.current;
        if (term) {
          void window.electronAPI?.sshResize?.(sessionId, {
            cols: term.cols,
            rows: term.rows,
          });
        }
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('resize', onResize);
    const ro = new ResizeObserver(onResize);
    if (termRef.current.parentElement) ro.observe(termRef.current.parentElement);

    return () => {
      window.removeEventListener('resize', onResize);
      ro.disconnect();
    };
  }, [shellReady, state, isActive, sessionId]);

  useEffect(() => {
    return () => {
      void window.electronAPI?.sshDisconnect?.(sessionId);
      termInst.current?.dispose();
      termInst.current = null;
      fitAddon.current = null;
    };
  }, [sessionId]);

  useEffect(() => {
    if (isActive && shellReady && state === 'connected') {
      termInst.current?.focus();
      fitAddon.current?.fit();
    }
  }, [isActive, shellReady, state]);

  const handleClose = () => {
    void window.electronAPI?.sshDisconnect?.(sessionId);
    setDismissed(true);
    setState('closed');
    resetBuffer();
    termInst.current?.dispose();
    termInst.current = null;
    message.info('Disconnected');
  };

  if (!service.ssh?.host) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDarkMode ? APP_BG_GRADIENT : '#fff',
          color: isDarkMode ? '#fff' : undefined,
        }}
      >
        <Text>Missing SSH host configuration</Text>
      </div>
    );
  }

  const showLoader =
    dismissed || state === 'error' || state === 'connecting' || state === 'idle' || !shellReady;

  const loaderStatus =
    state === 'connecting' || state === 'idle'
      ? 'Connecting to server…'
      : state === 'connected' && !shellReady
        ? 'Loading terminal…'
        : 'Connecting to server…';

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#000000',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {!showLoader && (
        <div
          style={{
            height: 40,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '0 12px',
            borderBottom: `1px solid ${COLORS.APP_BORDER}`,
            background: COLORS.APP_BG_PANEL,
          }}
        >
          <img src={logo} alt="" style={{ width: 18, height: 18, borderRadius: 4 }} />
          <Text style={{ color: '#33ff66', fontFamily: 'monospace', fontSize: 13 }}>
            {host}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            SSH · {service.ssh.username}@{host}:{port}
          </Text>
          <div style={{ flex: 1 }} />
          <Button size="small" type="text" danger onClick={handleClose}>
            Disconnect
          </Button>
        </div>
      )}

      {/* Hidden until shellReady — prevents half-written MOTD flash */}
      <div
        ref={termRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: showLoader ? 0 : 8,
          width: '100%',
          visibility: showLoader ? 'hidden' : 'visible',
          position: showLoader ? 'absolute' : 'relative',
          opacity: showLoader ? 0 : 1,
        }}
      />

      {showLoader && (
        <ConnectLoader
          host={host}
          port={port}
          logo={logo}
          error={
            state === 'error' ? error : dismissed ? 'Disconnected' : null
          }
          statusText={loaderStatus}
          onClose={handleClose}
          onRetry={() => {
            setDismissed(false);
            startedRef.current = false;
            resetBuffer();
            setState('idle');
            void connect();
          }}
        />
      )}
    </div>
  );
}

/** Multi-tab SSH host — each New Tab opens a fresh independent terminal session. */
export default function ServerTerminal({
  service,
  isDarkMode,
  isActive,
}: ServerTerminalProps) {
  const chrome = useServiceChromeOptional();
  const host = service.ssh?.host || 'server';
  const sshHomeUrl = `ssh://${host}`;

  useEffect(() => {
    if (!isActive || !chrome) return;
    chrome.registerServiceHome(service.id, sshHomeUrl, 'Terminal 1');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- register once per active service
  }, [isActive, service.id, sshHomeUrl]);

  const tabs =
    chrome?.browserTabs && chrome.browserTabs.length > 0
      ? chrome.browserTabs
      : [{ id: `tab-${service.id}-home`, url: sshHomeUrl, title: 'Terminal 1', kind: 'ssh' as const }];

  const activeTabId = chrome?.activeBrowserTabId || tabs[0]?.id;

  if (!service.ssh?.host) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isDarkMode ? APP_BG_GRADIENT : '#fff',
          color: isDarkMode ? '#fff' : undefined,
        }}
      >
        <Text>Missing SSH host configuration</Text>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', width: '100%', position: 'relative', minHeight: 0 }}>
      {tabs.map((tab) => {
        const sessionId = `${service.id}::${tab.id}`;
        const visible = isActive && tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            style={{
              position: 'absolute',
              inset: 0,
              display: visible ? 'flex' : 'none',
              flexDirection: 'column',
              minHeight: 0,
            }}
          >
            <SshTerminalSession
              service={service}
              sessionId={sessionId}
              isDarkMode={isDarkMode}
              isVisible={visible}
            />
          </div>
        );
      })}
    </div>
  );
}
