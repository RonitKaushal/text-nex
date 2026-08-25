import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Spin, Typography, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { APP_BG_GRADIENT, COLORS } from '../constants';
import type { ServiceTab } from '../types';

const { Text } = Typography;

/** Drop Chromium guest after leaving tab — host/sessions stay in main process */
const WEBVIEW_IDLE_UNLOAD_MS = 18_000;

interface BulkWhatsAppPanelProps {
  service: ServiceTab;
  isDarkMode: boolean;
  isActive: boolean;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          preload?: string;
          partition?: string;
          allowpopups?: string;
          webpreferences?: string;
        },
        HTMLElement
      >;
    }
  }
}

const BulkWhatsAppPanel: React.FC<BulkWhatsAppPanelProps> = ({ isActive }) => {
  const webviewRef = useRef<any>(null);
  const bootedRef = useRef(false);
  const [embed, setEmbed] = useState<{
    url: string | null;
    preload: string | null;
    error?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** When false, <webview> is not in the DOM (frees guest RAM) */
  const [showWebview, setShowWebview] = useState(false);

  const boot = useCallback(async (opts?: { force?: boolean }) => {
    if (bootedRef.current && embed?.url && !opts?.force) {
      setShowWebview(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const install = await window.electronAPI?.bulkWhatsAppInstall?.();
      const status = await window.electronAPI?.bulkWhatsAppStatus?.();
      if (install && install.ok === false) {
        setEmbed(null);
        setLoadError(install.error || status?.error || 'Bulk WhatsApp host failed to start');
        return;
      }
      if (!status?.url || !status?.preload) {
        setEmbed(null);
        setLoadError(status?.error || 'Bulk WhatsApp UI not available');
        return;
      }
      if (status.hostStarted === false) {
        setEmbed(null);
        setLoadError(status.error || 'Bulk WhatsApp IPC host not running — restart the app');
        return;
      }
      bootedRef.current = true;
      setEmbed({
        url: status.url,
        preload: status.preload,
        error: status.error,
      });
      setShowWebview(true);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to start Bulk WhatsApp');
      setEmbed(null);
    } finally {
      setLoading(false);
    }
  }, [embed?.url]);

  useEffect(() => {
    if (isActive) {
      setShowWebview(true);
      void boot();
      return;
    }
    const t = window.setTimeout(() => {
      setShowWebview(false);
    }, WEBVIEW_IDLE_UNLOAD_MS);
    return () => window.clearTimeout(t);
  }, [isActive, boot]);

  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv || !embed?.url || !showWebview) return;

    const onFail = (e: any) => {
      setLoadError(e?.errorDescription || e?.errorCode || 'Failed to load Bulk WhatsApp');
    };
    const onFinish = () => setLoadError(null);

    wv.addEventListener('did-fail-load', onFail);
    wv.addEventListener('did-finish-load', onFinish);
    return () => {
      wv.removeEventListener('did-fail-load', onFail);
      wv.removeEventListener('did-finish-load', onFinish);
    };
  }, [embed?.url, showWebview, isActive]);

  if (!isActive && !showWebview && !loading) {
    return <div style={{ height: '100%', background: APP_BG_GRADIENT }} />;
  }

  if (loading && !embed?.url) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: APP_BG_GRADIENT,
        }}
      >
        <Spin size="large" tip="Loading Bulk WhatsApp…" />
      </div>
    );
  }

  if (!embed?.url || loadError) {
    if (!isActive) {
      return <div style={{ height: '100%', background: APP_BG_GRADIENT }} />;
    }
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          background: APP_BG_GRADIENT,
          padding: 24,
        }}
      >
        <Text style={{ color: '#ff7875', textAlign: 'center' }}>
          {loadError || embed?.error || 'Bulk WhatsApp could not open inside TextNexus'}
        </Text>
        <Button
          icon={<ReloadOutlined />}
          type="primary"
          onClick={() => {
            bootedRef.current = false;
            void boot({ force: true });
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (!showWebview) {
    return <div style={{ height: '100%', background: APP_BG_GRADIENT }} />;
  }

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        position: 'relative',
        background: COLORS.APP_BG_BASE,
        display: isActive ? 'block' : 'none',
      }}
    >
      <webview
        ref={webviewRef}
        src={embed.url}
        preload={embed.preload}
        partition="persist:bulk-whatsapp-embed"
        allowpopups="false"
        webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=no,backgroundThrottling=yes"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          display: 'flex',
        }}
      />
    </div>
  );
};

export default BulkWhatsAppPanel;
