import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Spin, Typography, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { APP_BG_GRADIENT, COLORS } from '../constants';
import type { ServiceTab } from '../types';

const { Text, Title } = Typography;

const WEBVIEW_IDLE_UNLOAD_MS = 18_000;

interface LeadGenPanelProps {
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
          partition?: string;
          allowpopups?: string;
          webpreferences?: string;
        },
        HTMLElement
      >;
    }
  }
}

const LeadGenPanel: React.FC<LeadGenPanelProps> = ({ isActive }) => {
  const webviewRef = useRef<any>(null);
  const bootedRef = useRef(false);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showWebview, setShowWebview] = useState(false);

  const boot = useCallback(async (opts?: { force?: boolean }) => {
    if (bootedRef.current && url && !opts?.force) {
      setShowWebview(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      await window.electronAPI?.leadGenInstall?.();
      const status = await window.electronAPI?.leadGenStatus?.();
      if (!status?.url) {
        setUrl(null);
        setLoadError(status?.error || 'Lead Gen UI not available');
        return;
      }
      bootedRef.current = true;
      setUrl(status.url);
      setShowWebview(true);
    } catch (e: any) {
      setLoadError(e?.message || 'Failed to start Lead Gen');
      setUrl(null);
    } finally {
      setLoading(false);
    }
  }, [url]);

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
    if (!wv || !url || !showWebview) return;

    const onFail = (e: any) => {
      setLoadError(e?.errorDescription || e?.errorCode || 'Failed to load Lead Gen');
    };
    const onFinish = () => setLoadError(null);

    wv.addEventListener('did-fail-load', onFail);
    wv.addEventListener('did-finish-load', onFinish);
    return () => {
      wv.removeEventListener('did-fail-load', onFail);
      wv.removeEventListener('did-finish-load', onFinish);
    };
  }, [url, showWebview, isActive]);

  if (!isActive && !showWebview && !loading) {
    return <div style={{ height: '100%', background: APP_BG_GRADIENT }} />;
  }

  if (loading && !url) {
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
        <Spin size="large" tip="Loading Lead Gen…" />
      </div>
    );
  }

  if (!url || loadError) {
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
        <Title level={4} style={{ color: '#e8eaed', margin: 0 }}>
          Lead Gen unavailable
        </Title>
        <Text style={{ color: COLORS.APP_BORDER ? '#9aa0a6' : undefined, textAlign: 'center' }}>
          {loadError || 'Could not start Lead Gen server'}
        </Text>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
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
        background: '#000000',
        display: isActive ? 'block' : 'none',
      }}
    >
      <webview
        ref={webviewRef}
        src={url}
        style={{ width: '100%', height: '100%', border: 'none' }}
        partition="persist:lead-gen-embed"
        allowpopups="true"
        webpreferences="contextIsolation=yes,nodeIntegration=no,webSecurity=yes,backgroundThrottling=yes"
      />
    </div>
  );
};

export default LeadGenPanel;
