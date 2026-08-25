import { Typography } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import type { ServiceTab } from '../../types';
import { ServiceLogo } from './ServiceLogo';
import { COLORS, APP_BG_GRADIENT } from '../../constants';
import { SERVICE_DND_MIME } from '../../constants/dnd';

const { Text, Title } = Typography;

interface SplitServicePickerProps {
  services: ServiceTab[];
  /** Service ids already open in other panes — shown as occupied. */
  occupiedIds?: string[];
  isDarkMode?: boolean;
  disabledServices?: Set<string>;
  onSelect: (serviceId: string) => void;
  onDropService?: (serviceId: string) => void;
}

/** Empty pane — pick a service or drag one from the sidebar. */
export function SplitServicePicker({
  services,
  occupiedIds = [],
  isDarkMode = true,
  disabledServices = new Set(),
  onSelect,
  onDropService,
}: SplitServicePickerProps) {
  const muted = isDarkMode ? '#9aa8b8' : '#8c8c8c';
  const text = isDarkMode ? '#e8eaed' : '#1f1f1f';
  const border = isDarkMode ? COLORS.APP_BORDER : '#e8e8e8';
  const occupied = new Set(occupiedIds);

  const available = services.filter(
    (s) => !occupied.has(s.id) && !disabledServices.has(s.id)
  );

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: isDarkMode ? APP_BG_GRADIENT : '#f5f5f5',
        padding: '28px 24px',
        boxSizing: 'border-box',
        overflow: 'auto',
      }}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes(SERVICE_DND_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData(SERVICE_DND_MIME);
        if (id) onDropService?.(id) ?? onSelect(id);
      }}
    >
      <Title
        level={4}
        style={{ color: text, margin: '0 0 6px', fontWeight: 700, letterSpacing: '-0.02em' }}
      >
        Select a service
      </Title>
      <Text style={{ color: muted, fontSize: 13, display: 'block', marginBottom: 20 }}>
        Choose a service for this pane — or drag one from the sidebar.
      </Text>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {services.map((service) => {
          const isOccupied = occupied.has(service.id);
          const disabled = disabledServices.has(service.id);
          const blocked = isOccupied || disabled;

          return (
            <button
              key={service.id}
              type="button"
              disabled={blocked}
              onClick={() => {
                if (!blocked) onSelect(service.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 12,
                border: `1.5px solid ${border}`,
                background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff',
                color: text,
                cursor: blocked ? 'not-allowed' : 'pointer',
                opacity: blocked ? 0.55 : 1,
              }}
            >
              <ServiceLogo
                iconType={service.iconType}
                customIcon={service.customIcon}
                url={service.url}
                size={28}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{service.name}</div>
                <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                  {isOccupied
                    ? 'Already in another pane'
                    : disabled
                      ? 'Disabled'
                      : 'Open in this pane'}
                </div>
              </div>
            </button>
          );
        })}

        {available.length === 0 && (
          <div
            style={{
              padding: 20,
              borderRadius: 12,
              border: `1.5px dashed ${border}`,
              textAlign: 'center',
              color: muted,
            }}
          >
            <GlobalOutlined style={{ fontSize: 22, marginBottom: 8 }} />
            <div style={{ fontSize: 13 }}>
              Add another service to this workspace to split the view.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
