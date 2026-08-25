/**
 * Capture speech in the Electron host window (not webview partitions),
 * then send PCM to main for Windows Choices recognition on a WAV file.
 */

import { pickPreferredMicDeviceId } from './voiceMic';

export type CaptureHandlers = {
  onFinal?: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (message: string) => void;
  onStart?: () => void;
  onEnd?: () => void;
};

const TARGET_RATE = 16000;
const SPEECH_RMS = 0.009;
const SILENCE_MS_TO_CUT = 950;
const MIN_SPEECH_MS = 400;
const MAX_UTTERANCE_MS = 4500;

function downsample(input: Float32Array, inRate: number, outRate: number): Float32Array {
  if (inRate === outRate) return input;
  const ratio = inRate / outRate;
  const outLen = Math.max(1, Math.floor(input.length / ratio));
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const src = i * ratio;
    const i0 = Math.floor(src);
    const i1 = Math.min(i0 + 1, input.length - 1);
    const frac = src - i0;
    out[i] = input[i0] * (1 - frac) + input[i1] * frac;
  }
  return out;
}

/** Normalize quiet Bluetooth levels before Int16 conversion. */
function floatTo16BitPCM(input: Float32Array): Int16Array {
  let peak = 0.0001;
  for (let i = 0; i < input.length; i++) {
    const a = Math.abs(input[i]);
    if (a > peak) peak = a;
  }
  const gain = Math.min(12, 0.85 / peak);
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i] * gain));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function rms(buf: Float32Array): number {
  if (!buf.length) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

function mergeFloat32(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Float32Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export class HostMicVoiceEngine {
  private handlers: CaptureHandlers = {};
  private wantListening = false;
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private muteGain: GainNode | null = null;
  private chunks: Float32Array[] = [];
  private speaking = false;
  private silenceMs = 0;
  private speechMs = 0;
  private busy = false;
  private micLabel = '';
  private phrases: string[] = [];

  setHandlers(handlers: CaptureHandlers) {
    this.handlers = handlers;
  }

  get listening() {
    return this.wantListening;
  }

  async start(options?: { phrases?: string[] }): Promise<boolean> {
    this.stop(true);
    this.wantListening = true;
    this.phrases = Array.isArray(options?.phrases) ? options!.phrases! : [];

    if (!window.electronAPI?.voiceRecognizePcm) {
      this.handlers.onError?.(
        'Voice needs a full app restart (new mic capture). Stop terminal and run npm run electron-dev.'
      );
      this.wantListening = false;
      return false;
    }

    try {
      const mic = await pickPreferredMicDeviceId();
      this.micLabel = mic.label;
      this.handlers.onInterim?.(`Using mic: ${mic.label}`);

      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: mic.deviceId
          ? {
              deviceId: { ideal: mic.deviceId },
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            }
          : {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
            },
      });

      if (!this.wantListening) {
        this.cleanupMedia();
        return false;
      }

      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.audioCtx = new Ctx();
      const inRate = this.audioCtx.sampleRate;
      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);
      this.chunks = [];
      this.speaking = false;
      this.silenceMs = 0;
      this.speechMs = 0;

      this.processor.onaudioprocess = (ev) => {
        if (!this.wantListening || this.busy) return;
        const input = ev.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input.length);
        copy.set(input);
        const level = rms(copy);
        const frameMs = (copy.length / inRate) * 1000;

        if (level >= SPEECH_RMS) {
          if (!this.speaking) {
            this.speaking = true;
            this.chunks = [];
            this.speechMs = 0;
            this.handlers.onInterim?.('Hearing…');
          }
          this.chunks.push(copy);
          this.speechMs += frameMs;
          this.silenceMs = 0;
          if (this.speechMs >= MAX_UTTERANCE_MS) {
            void this.flushUtterance(inRate);
          }
        } else if (this.speaking) {
          this.chunks.push(copy);
          this.silenceMs += frameMs;
          if (
            this.silenceMs >= SILENCE_MS_TO_CUT &&
            this.speechMs >= MIN_SPEECH_MS
          ) {
            void this.flushUtterance(inRate);
          }
        }
      };

      this.source.connect(this.processor);
      this.muteGain = this.audioCtx.createGain();
      this.muteGain.gain.value = 0;
      this.processor.connect(this.muteGain);
      this.muteGain.connect(this.audioCtx.destination);

      this.handlers.onStart?.();
      this.handlers.onInterim?.(
        `Listening on: ${this.micLabel} — say WhatsApp, then pause`
      );
      return true;
    } catch (err) {
      this.wantListening = false;
      this.cleanupMedia();
      this.handlers.onError?.(
        err instanceof Error ? err.message : 'Microphone access failed'
      );
      this.handlers.onEnd?.();
      return false;
    }
  }

  private async flushUtterance(inRate: number) {
    if (this.busy || !this.chunks.length) {
      this.speaking = false;
      this.chunks = [];
      this.silenceMs = 0;
      this.speechMs = 0;
      return;
    }
    this.busy = true;
    const merged = mergeFloat32(this.chunks);
    this.chunks = [];
    this.speaking = false;
    this.silenceMs = 0;
    this.speechMs = 0;

    try {
      this.handlers.onInterim?.('Recognizing…');
      const audio16k = downsample(merged, inRate, TARGET_RATE);
      const pcm = floatTo16BitPCM(audio16k);
      const result = await window.electronAPI!.voiceRecognizePcm!({
        pcm: Array.from(pcm),
        sampleRate: TARGET_RATE,
        phrases: this.phrases,
      });

      const text = String(result?.text || '').trim();
      const raw = String(result?.raw || '').trim();
      if (text && this.wantListening) {
        this.handlers.onFinal?.(text);
        this.handlers.onInterim?.(
          `Listening on: ${this.micLabel} — say WhatsApp or type hello`
        );
      } else if (this.wantListening) {
        this.handlers.onInterim?.(
          raw
            ? `Heard "${raw}"`
            : `No match — speak louder, then pause`
        );
      }
    } catch (err) {
      console.warn('[voice:capture]', err);
      this.handlers.onInterim?.('Recognition failed — try again');
    } finally {
      this.busy = false;
    }
  }

  private cleanupMedia() {
    try {
      this.processor?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.source?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      this.muteGain?.disconnect();
    } catch {
      /* ignore */
    }
    this.processor = null;
    this.source = null;
    this.muteGain = null;
    if (this.audioCtx) {
      void this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  stop(silent = false) {
    this.wantListening = false;
    this.cleanupMedia();
    this.chunks = [];
    this.speaking = false;
    if (!silent) this.handlers.onEnd?.();
  }
}
