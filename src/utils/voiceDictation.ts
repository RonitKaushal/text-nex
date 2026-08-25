/**
 * Speech recognition for TextNexus.
 * Primary: host-window mic capture → WAV → Windows Choices (accurate commands).
 * Avoids webview partition mic fights and live SAPI filler hallucinations.
 */

import { HostMicVoiceEngine } from './voiceCaptureEngine';

export type VoiceDictationHandlers = {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
};

function hasCaptureBridge(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.electronAPI?.voiceRecognizePcm &&
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function hasWindowsSpeechBridge(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.electronAPI?.voiceSpeechStart &&
    window.electronAPI.platform === 'win32'
  );
}

export function isVoiceDictationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  if (hasCaptureBridge()) return true;
  if (hasWindowsSpeechBridge()) return true;
  return !!navigator.mediaDevices?.getUserMedia;
}

export class VoiceDictation {
  private handlers: VoiceDictationHandlers = {};
  private wantListening = false;
  private mode: 'capture' | 'windows' | null = null;
  private capture: HostMicVoiceEngine | null = null;
  private unsubResult: (() => void) | null = null;
  private unsubStatus: (() => void) | null = null;
  private lastErrorAt = 0;

  setHandlers(handlers: VoiceDictationHandlers) {
    this.handlers = handlers;
  }

  get listening() {
    return this.wantListening;
  }

  private emitError(message: string) {
    const now = Date.now();
    if (now - this.lastErrorAt < 2500) return;
    this.lastErrorAt = now;
    this.handlers.onError?.(message);
  }

  private clearWindowsSubs() {
    this.unsubResult?.();
    this.unsubStatus?.();
    this.unsubResult = null;
    this.unsubStatus = null;
  }

  private startCapture(phrases?: string[]): boolean {
    this.mode = 'capture';
    this.wantListening = true;
    this.capture = new HostMicVoiceEngine();
    this.capture.setHandlers({
      onStart: () => this.handlers.onStart?.(),
      onEnd: () => {
        if (this.mode !== 'capture') return;
        this.wantListening = false;
        this.handlers.onEnd?.();
      },
      onInterim: (t) => {
        if (this.mode === 'capture') this.handlers.onInterim?.(t);
      },
      onFinal: (t) => {
        if (this.mode === 'capture') this.handlers.onFinal?.(t);
      },
      onError: (m) => {
        this.wantListening = false;
        this.mode = null;
        this.emitError(m);
        this.handlers.onEnd?.();
      },
    });
    void this.capture.start({ phrases });
    return true;
  }

  private startWindows(phrases?: string[]): boolean {
    const api = window.electronAPI;
    if (!api?.voiceSpeechStart) return false;

    this.mode = 'windows';
    this.wantListening = true;
    this.clearWindowsSubs();

    this.unsubResult =
      api.onVoiceSpeechResult?.((data) => {
        const text = String(data?.text || '').trim();
        if (text) this.handlers.onFinal?.(text);
      }) || null;

    this.unsubStatus =
      api.onVoiceSpeechStatus?.((data) => {
        const status = data?.status;
        if (status === 'listening') {
          this.handlers.onStart?.();
          if (data?.message) this.handlers.onInterim?.(data.message);
          return;
        }
        if (status === 'mic-info' || status === 'hint') {
          this.handlers.onInterim?.(data?.message || '');
          return;
        }
        if (status === 'error') {
          this.wantListening = false;
          this.clearWindowsSubs();
          this.emitError(data?.message || 'Windows speech failed.');
          this.handlers.onEnd?.();
          return;
        }
        if (status === 'stopped') {
          this.wantListening = false;
          this.clearWindowsSubs();
          this.handlers.onEnd?.();
        }
      }) || null;

    void api.voiceSpeechStart({ phrases: phrases || [] }).then((result) => {
      if (!result?.ok) {
        this.wantListening = false;
        this.clearWindowsSubs();
        this.emitError(result?.error || 'Could not start Windows speech');
        this.handlers.onEnd?.();
        return;
      }
      this.handlers.onStart?.();
    });

    return true;
  }

  start(langOrOptions?: string | { lang?: string; phrases?: string[] }) {
    this.stop(true);

    const options =
      typeof langOrOptions === 'string'
        ? { lang: langOrOptions }
        : langOrOptions || {};

    if (hasCaptureBridge()) {
      return this.startCapture(options.phrases);
    }

    // Old build without voiceRecognizePcm — ask for restart, or SAPI live
    if (hasWindowsSpeechBridge()) {
      this.emitError(
        'Restart the app once (Ctrl+C → npm run electron-dev) for the new voice engine.'
      );
      return this.startWindows(options.phrases);
    }

    this.emitError('Speech recognition is not supported in this build.');
    return false;
  }

  stop(silent = false) {
    this.wantListening = false;

    if (this.mode === 'capture') {
      this.capture?.stop(true);
      this.capture = null;
      this.mode = null;
      if (!silent) this.handlers.onEnd?.();
      return;
    }

    if (this.mode === 'windows') {
      this.clearWindowsSubs();
      void window.electronAPI?.voiceSpeechStop?.();
      this.mode = null;
      if (!silent) this.handlers.onEnd?.();
      return;
    }

    this.mode = null;
    if (!silent) this.handlers.onEnd?.();
  }
}
