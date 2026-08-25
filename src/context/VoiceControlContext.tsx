import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { message } from 'antd';
import {
  VoiceDictation,
  isVoiceDictationSupported,
} from '../utils/voiceDictation';
import {
  bestNameMatch,
  parseVoiceCommand,
  resolveServiceAlias,
  SERVICE_VOICE_ALIASES,
  type VoiceAction,
} from '../utils/voiceCommands';
import type { ServiceTab, Workspace } from '../types';

export type VoiceControlHandlers = {
  getWorkspaces: () => Workspace[];
  getActiveWorkspaceId: () => string;
  getActiveService: () => ServiceTab | null | undefined;
  openWorkspaceById: (id: string) => void;
  openServiceById: (id: string) => void;
  createWorkspace: (name: string) => boolean;
  openWorkspaceCreator: () => void;
  setWorkspaceCreatorName?: (name: string) => void;
  openAvailableServices: () => void;
  openSettings: () => void;
  openProfile: () => void;
  openSearch: (query?: string) => void;
  reloadActive: () => void;
  goBack: () => void;
  insertText: (text: string, send?: boolean) => Promise<boolean>;
};

interface VoiceControlContextValue {
  isSupported: boolean;
  isListening: boolean;
  interimText: string;
  lastHeard: string;
  toggleListening: () => void;
  startListening: () => void;
  stopListening: () => void;
  registerHandlers: (handlers: VoiceControlHandlers | null) => void;
}

const VoiceControlContext = createContext<VoiceControlContextValue | null>(null);

function serviceCandidates(workspaces: Workspace[]) {
  const list: Array<{ id: string; name: string; aliases: string[] }> = [];
  for (const ws of workspaces) {
    for (const s of ws.services) {
      const aliases = [
        s.iconType,
        s.iconType.replace(/-/g, ' '),
        s.type,
        ...(SERVICE_VOICE_ALIASES[s.iconType] || []),
      ];
      list.push({ id: s.id, name: s.name, aliases });
    }
  }
  return list;
}

/** Phrases loaded into Windows command grammar for reliable recognition. */
function buildVoicePhrases(handlers: VoiceControlHandlers | null): string[] {
  const phrases = new Set<string>([
    'open whatsapp',
    'open gmail',
    'open telegram',
    'open discord',
    'open settings',
    'open profile',
    'available services',
    'add service',
    'go back',
    'show workspaces',
    'reload',
    'refresh',
    'send',
    'send message',
  ]);

  const workspaces = handlers?.getWorkspaces?.() || [];
  for (const ws of workspaces) {
    const name = String(ws.name || '').trim();
    if (name) {
      phrases.add(`open workspace ${name}`.toLowerCase());
      phrases.add(`switch to workspace ${name}`.toLowerCase());
      phrases.add(`open ${name}`.toLowerCase());
    }
    for (const s of ws.services) {
      const sn = String(s.name || '').trim();
      if (sn) {
        phrases.add(`open ${sn}`.toLowerCase());
        phrases.add(`switch to ${sn}`.toLowerCase());
      }
      const icon = String(s.iconType || '').replace(/-/g, ' ').trim();
      if (icon) {
        phrases.add(`open ${icon}`);
        phrases.add(`switch to ${icon}`);
      }
      for (const a of SERVICE_VOICE_ALIASES[s.iconType] || []) {
        phrases.add(`open ${a}`);
        phrases.add(`switch to ${a}`);
      }
    }
  }

  return [...phrases].filter(Boolean).slice(0, 100);
}

export function VoiceControlProvider({ children }: { children: ReactNode }) {
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [lastHeard, setLastHeard] = useState('');
  const handlersRef = useRef<VoiceControlHandlers | null>(null);
  const engineRef = useRef<VoiceDictation | null>(null);
  /** After bare "create workspace", next utterance is the name */
  const awaitingWorkspaceNameRef = useRef(false);
  /** After bare "type"/"write", next utterance goes into the chat box */
  const awaitingDictationRef = useRef(false);
  /** Avoid double-insert from duplicate recognition of the same phrase */
  const lastDictateRef = useRef<{ text: string; at: number } | null>(null);

  const isSupported = isVoiceDictationSupported();

  const runAction = useCallback(async (action: VoiceAction) => {
    const h = handlersRef.current;
    if (!h) return;

    if (action.type === 'dictate') {
      const key = `${action.send ? 's:' : ''}${action.text.trim().toLowerCase()}`;
      const prev = lastDictateRef.current;
      if (prev && prev.text === key && Date.now() - prev.at < 2500) {
        console.log('[voice] skip duplicate dictate:', action.text);
        return;
      }
      lastDictateRef.current = { text: key, at: Date.now() };
    }

    switch (action.type) {
      case 'openWorkspace': {
        const workspaces = h.getWorkspaces();
        const match = bestNameMatch(
          action.name,
          workspaces.map((w) => ({ id: w.id, name: w.name }))
        );
        if (!match) {
          message.warning(`Voice: workspace "${action.name}" not found`);
          return;
        }
        h.openWorkspaceById(match.id);
        message.success(`Voice: opened workspace ${match.name}`);
        return;
      }
      case 'openService': {
        const workspaces = h.getWorkspaces();
        const aliasKey = resolveServiceAlias(action.name);
        const candidates = serviceCandidates(workspaces);

        let match = bestNameMatch(action.name, candidates);
        if (!match && aliasKey) {
          match = bestNameMatch(aliasKey.replace(/-/g, ' '), candidates);
          if (!match) {
            for (const c of candidates) {
              const svc = workspaces
                .flatMap((w) => w.services)
                .find((s) => s.id === c.id);
              if (svc?.iconType === aliasKey) {
                match = { id: c.id, name: c.name, score: 100 };
                break;
              }
            }
          }
        }

        if (!match) {
          message.warning(
            `Voice: "${action.name}" is not in your workspaces. Try "Available services".`
          );
          return;
        }

        const target = workspaces
          .flatMap((w) => w.services)
          .find((s) => s.id === match!.id);
        if (target && target.workspaceId !== h.getActiveWorkspaceId()) {
          h.openWorkspaceById(target.workspaceId);
        }
        h.openServiceById(match.id);
        message.success(`Voice: opened ${match.name}`);
        return;
      }
      case 'createWorkspace': {
        awaitingWorkspaceNameRef.current = false;
        const ok = h.createWorkspace(action.name);
        if (ok) message.success(`Voice: created workspace "${action.name}"`);
        else message.warning('Voice: could not create workspace (limit or license)');
        return;
      }
      case 'openWorkspaceCreator':
        h.openWorkspaceCreator();
        awaitingWorkspaceNameRef.current = true;
        awaitingDictationRef.current = false;
        message.info('Say the workspace name now…');
        message.open({
          key: 'voice-listening',
          type: 'loading',
          content: 'Say workspace name… e.g. "Sales" or "Personal"',
          duration: 0,
        });
        return;
      case 'openDictation': {
        const active = h.getActiveService();
        if (!active) {
          message.warning('Voice: open a chat first (e.g. WhatsApp), then say "type"');
          return;
        }
        awaitingDictationRef.current = true;
        awaitingWorkspaceNameRef.current = false;
        message.info('Speak your message… say "send" when done');
        message.open({
          key: 'voice-listening',
          type: 'loading',
          content: 'Dictating… speak your message (or "send …" to send)',
          duration: 0,
        });
        return;
      }
      case 'openAvailableServices':
        h.openAvailableServices();
        message.success('Voice: Available Services');
        return;
      case 'openSettings':
        h.openSettings();
        message.success('Voice: Settings');
        return;
      case 'openProfile':
        h.openProfile();
        message.success('Voice: Profile');
        return;
      case 'openSearch':
        h.openSearch(action.query);
        message.success(`Voice: search ${action.query}`);
        return;
      case 'reload':
        h.reloadActive();
        message.success('Voice: reloading');
        return;
      case 'goBack':
        h.goBack();
        message.success('Voice: back');
        return;
      case 'dictate': {
        awaitingDictationRef.current = false;
        const active = h.getActiveService();
        if (!active) {
          message.warning('Voice: open a service first to type');
          return;
        }
        const ok = await h.insertText(action.text, action.send);
        if (!ok) {
          message.warning('Voice: could not find a message box — open a chat first');
          return;
        }
        message.success(action.send ? 'Voice: sent' : 'Voice: typed');
        return;
      }
      case 'sendOnly': {
        awaitingDictationRef.current = false;
        const ok = await h.insertText('', true);
        if (!ok) message.warning('Voice: nothing to send');
        else message.success('Voice: sent');
        return;
      }
      default:
        return;
    }
  }, []);

  useEffect(() => {
    const engine = new VoiceDictation();
    engineRef.current = engine;

    engine.setHandlers({
      onStart: () => {
        setIsListening(true);
        message.open({
          key: 'voice-listening',
          type: 'loading',
          content: 'Listening… say "WhatsApp", "type hello", or "Create workspace"',
          duration: 0,
        });
      },
      onEnd: () => {
        setIsListening(false);
        setInterimText('');
        message.destroy('voice-listening');
      },
      onInterim: (text) => {
        setInterimText(text);
        if (!text) return;
        // Show mic name / Bluetooth tips in the listening toast
        message.open({
          key: 'voice-listening',
          type: 'loading',
          content: text,
          duration: 0,
        });
      },
      onError: (msg) => {
        message.destroy('voice-listening');
        message.error(msg);
        setIsListening(false);
      },
      onFinal: (text) => {
        const cleaned = String(text || '')
          .trim()
          .replace(/[.…!?]+$/g, '');
        if (!cleaned) return;
        setLastHeard(cleaned);
        setInterimText('');

        // After "create workspace", treat next phrase as the name
        if (awaitingWorkspaceNameRef.current) {
          const cancel = /^(cancel|never mind|stop|close)$/i.test(cleaned);
          if (cancel) {
            awaitingWorkspaceNameRef.current = false;
            message.info('Voice: cancelled');
            return;
          }
          const maybeCmd = parseVoiceCommand(cleaned, { preferDictate: false });
          if (
            maybeCmd &&
            maybeCmd.type !== 'createWorkspace' &&
            maybeCmd.type !== 'openWorkspaceCreator'
          ) {
            if (maybeCmd.type === 'openService' || maybeCmd.type === 'goBack') {
              if (/^(open|switch|go)\b/i.test(cleaned)) {
                awaitingWorkspaceNameRef.current = false;
                void runAction(maybeCmd);
                return;
              }
            }
          }
          if (maybeCmd?.type === 'createWorkspace') {
            awaitingWorkspaceNameRef.current = false;
            void runAction(maybeCmd);
            return;
          }
          const name = cleaned
            .replace(/^(named|called|name|workspace)\s+/i, '')
            .trim();
          if (name.length >= 1) {
            awaitingWorkspaceNameRef.current = false;
            handlersRef.current?.setWorkspaceCreatorName?.(name);
            void runAction({ type: 'createWorkspace', name });
            return;
          }
        }

        // After bare "type"/"write", next phrase → chat box
        if (awaitingDictationRef.current) {
          const cancel = /^(cancel|never mind|stop|close)$/i.test(cleaned);
          if (cancel) {
            awaitingDictationRef.current = false;
            message.info('Voice: cancelled dictation');
            return;
          }
          const maybeCmd = parseVoiceCommand(cleaned, { preferDictate: false });
          if (maybeCmd?.type === 'sendOnly') {
            void runAction(maybeCmd);
            return;
          }
          if (maybeCmd?.type === 'dictate') {
            void runAction(maybeCmd);
            return;
          }
          // Escape hatch: open another service / nav commands
          if (
            maybeCmd &&
            (maybeCmd.type === 'openService' ||
              maybeCmd.type === 'goBack' ||
              maybeCmd.type === 'openAvailableServices' ||
              maybeCmd.type === 'openSettings') &&
            /^(open|switch|go|available|settings|back)\b/i.test(cleaned)
          ) {
            awaitingDictationRef.current = false;
            void runAction(maybeCmd);
            return;
          }
          void runAction({ type: 'dictate', text: cleaned, send: false });
          return;
        }

        const hasChat = !!handlersRef.current?.getActiveService();
        const action = parseVoiceCommand(cleaned, {
          preferDictate: hasChat,
        });
        if (!action) {
          console.log('[voice] ignored non-command:', cleaned);
          message.open({
            key: 'voice-listening',
            type: 'loading',
            content: hasChat
              ? 'Listening… say "type hello" or just speak your message'
              : 'Listening… say "WhatsApp", "type hello", or "Create workspace"',
            duration: 0,
          });
          return;
        }
        message.open({
          key: 'voice-heard',
          type: 'info',
          content: `Heard: "${cleaned}"`,
          duration: 2,
        });
        message.open({
          key: 'voice-listening',
          type: 'loading',
          content: 'Listening…',
          duration: 0,
        });
        void runAction(action);
      },
    });

    return () => {
      engine.stop(true);
      engineRef.current = null;
    };
  }, [runAction]);

  const startListening = useCallback(() => {
    if (!isSupported) {
      message.error('Speech recognition is not supported in this build.');
      return;
    }
    if (!window.electronAPI?.voiceSpeechStart) {
      message.error(
        'Voice needs a full app restart. Stop the terminal and run npm run electron-dev again.'
      );
      return;
    }
    const phrases = buildVoicePhrases(handlersRef.current);
    const ok = engineRef.current?.start({ phrases });
    if (ok) setIsListening(true);
  }, [isSupported]);

  const stopListening = useCallback(() => {
    engineRef.current?.stop();
    setIsListening(false);
    setInterimText('');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  const registerHandlers = useCallback((handlers: VoiceControlHandlers | null) => {
    handlersRef.current = handlers;
  }, []);

  // Global shortcut Ctrl+Shift+Space
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        toggleListening();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleListening]);

  const value = useMemo(
    () => ({
      isSupported,
      isListening,
      interimText,
      lastHeard,
      toggleListening,
      startListening,
      stopListening,
      registerHandlers,
    }),
    [
      isSupported,
      isListening,
      interimText,
      lastHeard,
      toggleListening,
      startListening,
      stopListening,
      registerHandlers,
    ]
  );

  return (
    <VoiceControlContext.Provider value={value}>{children}</VoiceControlContext.Provider>
  );
}

export function useVoiceControl() {
  const ctx = useContext(VoiceControlContext);
  if (!ctx) {
    throw new Error('useVoiceControl must be used within VoiceControlProvider');
  }
  return ctx;
}

export function useVoiceControlOptional() {
  return useContext(VoiceControlContext);
}
