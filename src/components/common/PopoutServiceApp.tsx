import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Button, Spin, Tooltip, Typography } from 'antd';
import {
  CloseOutlined,
  BorderOutlined,
  MinusOutlined,
  ReloadOutlined,
  ImportOutlined,
  SplitCellsOutlined,
} from '@ant-design/icons';
import GenericWebView from '../GenericWebView';
import { ServiceLogo } from './ServiceLogo';
import { APP_TOP_BAR_HEIGHT, APP_SIDEBAR_BG, COLORS } from '../../constants';
import type { PopoutServicePayload, ServiceTab } from '../../types';

const { Text } = Typography;

const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties;
const drag: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties;

function parseServiceIdFromHash() {
  const hash = window.location.hash || '';
  const m = hash.match(/#\/popout\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : '';
}

/** Detached service window — dark chrome + Bring back (Wavebox-style). */
export function PopoutServiceApp() {
  const serviceId = useMemo(() => parseServiceIdFromHash(), []);
  const [payload, setPayload] = useState<PopoutServicePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [muted] = useState('#9aa0a6');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await window.electronAPI?.getPopoutPayload?.(serviceId);
      if (!cancelled) {
        setPayload(data || null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [serviceId]);

  const service: ServiceTab | null = payload
    ? {
        id: payload.serviceId,
        name: payload.name,
        type: payload.iconType,
        iconType: payload.iconType,
        url: payload.url,
        partition: payload.partition,
        customIcon: payload.customIcon,
        workspaceId: 'popout',
      }
    : null;

  const bringBack = () => {
    void window.electronAPI?.bringBackService?.(serviceId);
  };

  const reload = () => {
    void window.electronAPI?.reloadService?.(serviceId);
    window.location.reload();
  };

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: APP_SIDEBAR_BG,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!service) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: APP_SIDEBAR_BG,
          color: '#fff',
        }}
      >
        Service not found
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: APP_SIDEBAR_BG,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          height: APP_TOP_BAR_HEIGHT,
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '0 0 0 12px',
          background: APP_SIDEBAR_BG,
          borderBottom: `1px solid ${COLORS.APP_BORDER}`,
          flexShrink: 0,
          color: '#e8eaed',
          ...drag,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...noDrag }}>
          <ServiceLogo
            iconType={service.iconType}
            customIcon={service.customIcon}
            url={service.url}
            size={18}
          />
          <Text strong style={{ color: '#e8eaed', fontSize: 13 }}>
            {service.name}
          </Text>
        </div>

        <div style={{ flex: 1 }} />

        <Tooltip title="Bring back into main window">
          <Button
            type="default"
            size="small"
            icon={<ImportOutlined />}
            onClick={bringBack}
            style={{
              ...noDrag,
              height: 30,
              borderRadius: 6,
              background: COLORS.APP_BG_ELEVATED,
              borderColor: COLORS.APP_BORDER,
              color: '#e8eaed',
              fontWeight: 500,
            }}
          >
            Bring back
          </Button>
        </Tooltip>

        <Tooltip title="Split view">
          <Button
            type="text"
            icon={<SplitCellsOutlined />}
            style={{ ...noDrag, color: muted, width: 34, height: 34 }}
            disabled
          />
        </Tooltip>

        <Tooltip title="Reload">
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={reload}
            style={{ ...noDrag, color: muted, width: 34, height: 34 }}
          />
        </Tooltip>

        <div style={{ display: 'flex', height: '100%', ...noDrag }}>
          <Button
            type="text"
            icon={<MinusOutlined />}
            onClick={() => void window.electronAPI?.windowMinimize?.()}
            style={{ width: 42, height: '100%', borderRadius: 0, color: muted }}
          />
          <Button
            type="text"
            icon={<BorderOutlined style={{ fontSize: 12 }} />}
            onClick={() => void window.electronAPI?.windowMaximize?.()}
            style={{ width: 42, height: '100%', borderRadius: 0, color: muted }}
          />
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={() => void window.electronAPI?.windowClose?.()}
            style={{ width: 42, height: '100%', borderRadius: 0, color: muted }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#e81123';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = muted;
            }}
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <GenericWebView service={service} isDarkMode isActive />
      </div>
    </div>
  );
}
