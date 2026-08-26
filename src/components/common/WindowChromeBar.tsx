import type { CSSProperties } from 'react';
import { Button } from 'antd';
import {
  BorderOutlined,
  CloseOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { APP_TOP_BAR_HEIGHT, COLORS } from '../../constants';

const drag: CSSProperties = { WebkitAppRegion: 'drag' } as CSSProperties;
const noDrag: CSSProperties = { WebkitAppRegion: 'no-drag' } as CSSProperties;

interface WindowChromeBarProps {
  isDarkMode?: boolean;
}

/**
 * Frameless window drag strip + min / max / close (Win/Linux).
 * macOS uses native traffic lights — only a drag region is shown.
 */
export function WindowChromeBar({ isDarkMode = true }: WindowChromeBarProps) {
  const isMac = window.electronAPI?.platform === 'darwin';
  const muted = isDarkMode ? '#c8cdd3' : '#595959';
  const bg = isDarkMode ? '#000000' : '#f0f0f0';
  const border = isDarkMode ? COLORS.APP_BORDER : '#d9d9d9';

  if (isMac) {
    return (
      <div
        style={{
          height: APP_TOP_BAR_HEIGHT,
          flexShrink: 0,
          paddingLeft: 78,
          background: bg,
          borderBottom: `1px solid ${border}`,
          ...drag,
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: APP_TOP_BAR_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'stretch',
        justifyContent: 'flex-end',
        background: bg,
        borderBottom: `1px solid ${border}`,
        ...drag,
      }}
    >
      <div style={{ display: 'flex', height: '100%', ...noDrag }}>
        <Button
          type="text"
          icon={<MinusOutlined />}
          onClick={() => void window.electronAPI?.windowMinimize?.()}
          style={{ width: 46, height: '100%', borderRadius: 0, color: muted }}
          aria-label="Minimize"
        />
        <Button
          type="text"
          icon={<BorderOutlined style={{ fontSize: 12 }} />}
          onClick={() => void window.electronAPI?.windowMaximize?.()}
          style={{ width: 46, height: '100%', borderRadius: 0, color: muted }}
          aria-label="Maximize"
        />
        <Button
          type="text"
          icon={<CloseOutlined />}
          onClick={() => void window.electronAPI?.windowClose?.()}
          style={{ width: 46, height: '100%', borderRadius: 0, color: muted }}
          aria-label="Close"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.color = '#111111';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
            e.currentTarget.style.color = muted;
          }}
        />
      </div>
    </div>
  );
}
