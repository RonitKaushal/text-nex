import { useState, type CSSProperties, type ReactNode } from 'react';
import { InboxOutlined } from '@ant-design/icons';
import { COLORS, APP_BG_GRADIENT } from '../../constants';
import { SERVICE_DND_MIME } from '../../constants/dnd';

interface SplitDropPaneProps {
  children: ReactNode;
  isDarkMode?: boolean;
  onDropService: (serviceId: string) => void;
}

/** Drop target for sidebar → split pane. */
export function SplitDropPane({
  children,
  isDarkMode = true,
  onDropService,
}: SplitDropPaneProps) {
  const [over, setOver] = useState(false);

  const shell: CSSProperties = {
    minWidth: 0,
    minHeight: 0,
    height: '100%',
    width: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    outline: over ? `2px solid ${COLORS.PRIMARY}` : '2px solid transparent',
    outlineOffset: -2,
    transition: 'outline-color 0.15s ease',
    background: isDarkMode ? APP_BG_GRADIENT : '#fff',
    overflow: 'hidden',
  };

  return (
    <div
      style={shell}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes(SERVICE_DND_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const id = e.dataTransfer.getData(SERVICE_DND_MIME);
        if (id) onDropService(id);
      }}
    >
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>{children}</div>

      {over && (
        <div
          style={{
            position: 'absolute',
            inset: 8,
            borderRadius: 12,
            border: `2px dashed ${COLORS.PRIMARY}`,
            background: 'rgba(139, 124, 246, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          <div style={{ textAlign: 'center', color: COLORS.PRIMARY }}>
            <InboxOutlined style={{ fontSize: 28, marginBottom: 8 }} />
            <div style={{ fontWeight: 600, fontSize: 13 }}>Drop to open here</div>
          </div>
        </div>
      )}
    </div>
  );
}
