import { Typography } from 'antd';
import { KeyOutlined } from '@ant-design/icons';
import { COLORS } from '../constants';

const { Title, Text } = Typography;

type ShortcutRow = {
  keys: string[];
  action: string;
  detail?: string;
};

type ShortcutGroup = {
  title: string;
  items: ShortcutRow[];
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'Search',
    items: [
      {
        keys: ['Ctrl', 'K'],
        action: 'Global search',
        detail:
          'Jump to any service, workspace, Profile, Settings, or Add service. Works even when focus is inside WhatsApp / Telegram.',
      },
    ],
  },
  {
    title: 'Switch services',
    items: [
      {
        keys: ['Ctrl', 'Tab'],
        action: 'Open service switcher',
        detail:
          'Hold Ctrl and press Tab. Keep holding Ctrl, press Tab again to move. Release Ctrl to open the selected service (same as Windows Alt+Tab).',
      },
      {
        keys: ['Ctrl', 'Shift', 'Tab'],
        action: 'Previous service',
        detail: 'While the switcher is open, move the highlight backwards.',
      },
      {
        keys: ['Esc'],
        action: 'Cancel switcher / search',
        detail: 'Close the switcher or global search without changing the current service.',
      },
    ],
  },
  {
    title: 'Window',
    items: [
      {
        keys: ['F11'],
        action: 'Fullscreen',
        detail: 'Toggle fullscreen mode on or off.',
      },
    ],
  },
  {
    title: 'SSH / Ubuntu terminal',
    items: [
      {
        keys: ['Ctrl', 'Shift', 'C'],
        action: 'Copy',
        detail: 'Copy selected text from the terminal.',
      },
      {
        keys: ['Ctrl', 'Shift', 'V'],
        action: 'Paste',
        detail: 'Paste into the terminal.',
      },
    ],
  },
];

function KeyCap({ label, isDarkMode }: { label: string; isDarkMode: boolean }) {
  return (
    <kbd
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 28,
        height: 28,
        padding: '0 8px',
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        color: isDarkMode ? '#e8eaed' : '#202124',
        background: isDarkMode ? COLORS.APP_BG_ELEVATED : '#fff',
        border: `1px solid ${isDarkMode ? COLORS.APP_BORDER : '#d9d9d9'}`,
        boxShadow: isDarkMode
          ? '0 1px 0 rgba(0,0,0,0.35)'
          : '0 1px 0 rgba(0,0,0,0.08)',
      }}
    >
      {label}
    </kbd>
  );
}

interface KeyboardShortcutsGuideProps {
  isDarkMode?: boolean;
}

/** Profile → Guide: lists app keyboard shortcuts for users. */
export default function KeyboardShortcutsGuide({
  isDarkMode = true,
}: KeyboardShortcutsGuideProps) {
  const text = isDarkMode ? '#e8eaed' : '#1f1f1f';
  const muted = isDarkMode ? 'rgba(255,255,255,0.55)' : '#8c8c8c';
  const border = isDarkMode ? COLORS.APP_BORDER : '#f0f0f0';
  const cardBg = isDarkMode ? COLORS.APP_BG_PANEL : '#fafafa';

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 22 }}>
        <Title level={4} style={{ color: text, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <KeyOutlined />
          Keyboard shortcuts
        </Title>
        <Text style={{ color: muted, fontSize: 13 }}>
          Quick keys to move around ArcticSwitch. Use Ctrl+Tab like Windows Alt+Tab to jump between WhatsApp, Instagram, and other services.
        </Text>
      </div>

      {SHORTCUT_GROUPS.map((group) => (
        <div key={group.title} style={{ marginBottom: 28 }}>
          <Title level={5} style={{ color: text, marginBottom: 12 }}>
            {group.title}
          </Title>
          <div
            style={{
              borderRadius: 12,
              border: `1px solid ${border}`,
              background: cardBg,
              overflow: 'hidden',
            }}
          >
            {group.items.map((item, index) => (
              <div
                key={`${group.title}-${item.action}`}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 20,
                  padding: '14px 16px',
                  borderTop: index === 0 ? 'none' : `1px solid ${border}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text strong style={{ color: text, display: 'block' }}>
                    {item.action}
                  </Text>
                  {item.detail ? (
                    <Text style={{ color: muted, fontSize: 12, display: 'block', marginTop: 4, lineHeight: 1.45 }}>
                      {item.detail}
                    </Text>
                  ) : null}
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  {item.keys.map((key, i) => (
                    <span key={`${key}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {i > 0 ? (
                        <span style={{ color: muted, fontSize: 12, fontWeight: 600 }}>+</span>
                      ) : null}
                      <KeyCap label={key} isDarkMode={isDarkMode} />
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
